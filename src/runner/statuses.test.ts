import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS } from "../data/needs";
import type { CardOption, DebuffId, DogId, EncounterId, ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { SCALE_STEPS } from "../layout/projection";
import type { Choice } from "../rules/choices";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import {
  activeStatuses,
  dogDepthStep,
  type DogStatusId,
  markOverlayKey,
  shownStatus,
  startStatuses,
  STATUS_OVERLAY_LIFT,
  type StatusData,
  statusesKey,
  statusesOf,
  type StatusMark,
  statusOverlayKey,
  statusOverlayLift,
} from "./statuses";

const data = { encounters: ENCOUNTERS, forcedStops: FORCED_STOPS, needCards: NEED_CARDS };
const at = { timeMs: 5000, zone: WORLD.firstZone, zoneIndex: 1 };

function card(encounter: EncounterId, affected: readonly DogId[]) {
  return { affected, source: { affected, encounter, kind: "encounter" } as const };
}

const started = (encounter: EncounterId, affected: readonly DogId[], choice: Choice) =>
  startStatuses(data, card(encounter, affected), at, choice, []);

describe("startStatuses", () => {
  // Every option of the encounter's card, and Skip.
  const choicesOf = (encounter: EncounterId): { choice: Choice; name: string }[] => {
    const { resolution } = ENCOUNTERS[encounter];
    const options = resolution.kind === "card" ? resolution.options : [];
    return [
      ...options.map(({ name }, choice) => ({ choice, name })),
      { choice: "skip", name: "Skip" },
    ];
  };

  it.each<{
    affected: DogId[];
    encounter: EncounterId;
    startsOn: string[];
    status: DogStatusId | "nothing";
  }>([
    {
      affected: ["koda", "nugget"],
      encounter: "skunk",
      startsOn: ["Quick rinse"],
      status: "stinky",
    },
    { affected: ["pierre"], encounter: "puddle", startsOn: ["Splash through"], status: "soaked" },
    { affected: ["koda"], encounter: "squirrel", startsOn: [], status: "nothing" },
  ])(
    "starts $status after a $encounter on $startsOn, and nothing on its other options or Skip",
    ({ affected, encounter, startsOn, status }) => {
      const choices = choicesOf(encounter);
      expect(choices.map(({ name }) => name)).toEqual(expect.arrayContaining(startsOn));
      for (const { choice, name } of choices) {
        const expected =
          status !== "nothing" && startsOn.includes(name)
            ? affected.map((dog) => ({ dog, startMs: 5000, status, zoneIndex: 1 }))
            : [];
        expect(started(encounter, affected, choice), name).toEqual(expected);
      }
    },
  );

  it("starts nothing for a forced stop option without a debuff", () => {
    const stop: CardSource = { kind: "forcedStop", stop: "stopSign" };
    expect(startStatuses(data, { affected: ["koda"], source: stop }, at, 0, [])).toEqual([]);
  });

  // Each debuff on an option of every kind of card that has options: the option starts it on
  // the dogs the card affected.
  const withDebuff = (debuff: DebuffId): StatusData => {
    const effects = [{ debuff, kind: "debuff" } as const];
    // The first option applies the debuff too.
    const option = <T extends { readonly options: readonly CardOption[] }>(source: T): T => ({
      ...source,
      options: source.options.map((entry, index) =>
        index === 0 ? { ...entry, effects: [...entry.effects, ...effects] } : entry,
      ) as unknown as T["options"],
    });
    return {
      ...data,
      encounters: {
        ...ENCOUNTERS,
        thief: { ...ENCOUNTERS.thief, resolution: option(ENCOUNTERS.thief.resolution) },
      },
      forcedStops: { ...FORCED_STOPS, stopSign: option(FORCED_STOPS.stopSign) },
    };
  };
  const sources: CardSource[] = [
    { affected: ["koda", "biscuit"], encounter: "thief", kind: "encounter" },
    { kind: "forcedStop", stop: "stopSign" },
  ];
  it.each(
    (Object.keys(DEBUFFS) as DebuffId[]).flatMap((debuff) =>
      sources.map((source) => ({ debuff, kind: source.kind, source })),
    ),
  )("starts $debuff from a $kind option that applies it", ({ debuff, source }) => {
    const affected: DogId[] = ["koda", "biscuit"];
    const marks = startStatuses(withDebuff(debuff), { affected, source }, at, 0, []);
    expect(marks).toEqual(
      affected.map((dog) => ({ dog, startMs: 5000, status: debuff, zoneIndex: 1 })),
    );
  });

  // A Splash skin in the zone with its own soaked overlay; the other zone has no skin.
  const MUD = "fx-status-soaked-mud";
  const skinned = {
    ...data,
    encounters: {
      ...ENCOUNTERS,
      puddle: {
        ...ENCOUNTERS.puddle,
        skins: { [at.zone]: { art: "splash-mud", name: "Mud patch", statusArt: MUD } },
      },
    },
  };
  const splash = (zone: ZoneId) =>
    startStatuses(skinned, card("puddle", ["koda"]), { ...at, zone }, 0, []);
  const otherZone = WORLD.zones.map(({ id }) => id).find((id) => id !== at.zone) ?? at.zone;

  it.each<[string, () => StatusMark[], string | undefined]>([
    ["remembers the skin's status art in its zone", () => splash(at.zone), MUD],
    [
      "keeps the base overlay where the encounter wears no skin",
      () => splash(otherZone),
      undefined,
    ],
  ])("%s", (_, marks, art) => {
    expect(marks().map((mark) => mark.art)).toEqual([art]);
  });

  it("restarts a dog's status in place and drops marks from earlier zones", () => {
    const earlier: StatusMark[] = [
      { dog: "koda", startMs: 1000, status: "soaked", zoneIndex: 1 },
      { dog: "nugget", startMs: 1000, status: "soaked", zoneIndex: 1 },
      { dog: "biscuit", startMs: 900, status: "spooked", zoneIndex: 0 },
    ];
    const splash = choicesOf("puddle").findIndex(({ name }) => name === "Splash through");
    expect(startStatuses(data, card("puddle", ["koda"]), at, splash, earlier)).toEqual([
      { dog: "nugget", startMs: 1000, status: "soaked", zoneIndex: 1 },
      { dog: "koda", startMs: 5000, status: "soaked", zoneIndex: 1 },
    ]);
  });
});

describe("activeStatuses", () => {
  const marks: StatusMark[] = [
    { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 0 },
    { dog: "koda", startMs: 2000, status: "soaked", zoneIndex: 0 },
    { dog: "nugget", startMs: 3000, status: "spooked", zoneIndex: 0 },
  ];
  const stinkyRun = testState(
    { koda: 5, nugget: 5 },
    { debuffs: [{ debuff: "stinky" }, { debuff: "spooked", secondsLeft: 1 }] },
  );

  it("shows Soaked for the visible seconds of run time and the held debuffs, newest first", () => {
    expect(activeStatuses(10, stinkyRun, 11_999, marks).map((mark) => mark.status)).toEqual([
      "spooked",
      "soaked",
      "stinky",
    ]);
    expect(activeStatuses(10, stinkyRun, 12_000, marks).map((mark) => mark.status)).toEqual([
      "spooked",
      "stinky",
    ]);
  });

  it("puts the later of two statuses started at the same time first", () => {
    const sameTime: StatusMark[] = [
      { dog: "nugget", startMs: 2000, status: "soaked", zoneIndex: 0 },
      { dog: "nugget", startMs: 2000, status: "spooked", zoneIndex: 0 },
    ];
    const run = testState({ nugget: 5 }, { debuffs: [{ debuff: "spooked" }] });
    expect(statusesOf(activeStatuses(10, run, 2000, sameTime), "nugget")).toEqual([
      "spooked",
      "soaked",
    ]);
  });

  it.each(Object.keys(DEBUFFS) as DebuffId[])(
    "shows %s only while the pack has the debuff, however long ago it started",
    (debuff) => {
      const mark: StatusMark = { dog: "koda", startMs: 0, status: debuff, zoneIndex: 0 };
      const clean = testState({ koda: 5 });
      const held = testState({ koda: 5 }, { debuffs: [{ debuff }] });
      expect(activeStatuses(10, clean, 60_000, [mark])).toEqual([]);
      expect(activeStatuses(10, held, 60_000, [mark])).toEqual([mark]);
    },
  );

  it("ends every status with its zone, and shows none on a fired dog", () => {
    const nextZone = testState({ koda: 5, nugget: 5 }, { zoneIndex: 1 });
    expect(activeStatuses(10, nextZone, 2500, marks)).toEqual([]);
    const fired = testState({ koda: "fired", nugget: 5 }, { debuffs: stinkyRun.debuffs });
    expect(activeStatuses(10, fired, 3500, marks).map((mark) => mark.dog)).toEqual(["nugget"]);
  });
});

describe("statusesOf and statusesKey", () => {
  const active: StatusMark[] = [
    { dog: "nugget", startMs: 3000, status: "spooked", zoneIndex: 0 },
    { dog: "koda", startMs: 2000, status: "soaked", zoneIndex: 0 },
    { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 0 },
  ];

  it("lists a dog's statuses in the order given, newest first", () => {
    expect(statusesOf(active, "koda")).toEqual(["soaked", "stinky"]);
    expect(statusesOf(active, "biscuit")).toEqual([]);
  });

  it("changes when a status starts or ends, not when only the time moves", () => {
    expect(statusesKey(active)).toBe("nugget:spooked,koda:soaked,koda:stinky");
    expect(statusesKey(active.slice(1))).not.toBe(statusesKey(active));
  });
});

describe("shownStatus", () => {
  const active: StatusMark[] = [
    { dog: "koda", startMs: 4000, status: "soaked", zoneIndex: 0 },
    { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 0 },
  ];

  it("shows each of a dog's statuses for a second in turn, the most recent first", () => {
    expect([4000, 4999, 5000, 6000].map((t) => shownStatus(active, t, "koda")?.status)).toEqual([
      "soaked",
      "soaked",
      "stinky",
      "soaked",
    ]);
  });

  it("shows a lone status throughout, and nothing for a dog without one", () => {
    expect(shownStatus(active.slice(1), 9000, "koda")?.status).toBe("stinky");
    expect(shownStatus(active, 4000, "nugget")).toBeUndefined();
  });
});

describe("markOverlayKey", () => {
  const mark: StatusMark = { dog: "koda", startMs: 0, status: "soaked", zoneIndex: 0 };
  const mud = { ...mark, art: "fx-status-soaked-mud" };
  const base = statusOverlayKey("soaked");

  it.each<[string, () => string, string]>([
    ["draws the skin's overlay once loaded", () => markOverlayKey(() => true, mud), mud.art],
    [
      "draws the status's own while the skin's is missing",
      () => markOverlayKey(() => false, mud),
      base,
    ],
    [
      "draws the status's own for a mark with no skin",
      () => markOverlayKey(() => true, mark),
      base,
    ],
  ])("%s", (_, key, expected) => {
    expect(key()).toBe(expected);
  });
});

describe("dogDepthStep", () => {
  it("reads the step from the variant's suffix, exact for @88 and @62, or else the drawn scale", () => {
    const cases = [
      ["dog-koda", 1, 1],
      ["dog-koda@75", 1, 0.75],
      ["dog-nugget@50", 1, 0.5],
      ["dog-koda@88", 1, 0.875],
      ["dog-koda@62", 1, 0.625],
      ["dog-koda", 0.875, 0.875],
      ["dog-koda", 0.75, 0.75],
      ["dog-koda", 0.5, 0.5],
    ] as const;
    expect(cases.map(([key, scale]) => [key, scale, dogDepthStep(key, scale)])).toEqual(cases);
  });
});

describe("status overlays", () => {
  it("draw fx-status-<status>", () => {
    expect(statusOverlayKey("stinky")).toBe("fx-status-stinky");
  });

  // The full-size lift at each depth step, rounded down, so a smaller step never lifts more.
  it.each(SCALE_STEPS)("draw below the top row by the lift at step %d", (step) => {
    expect(statusOverlayLift(step)).toBe(Math.floor(STATUS_OVERLAY_LIFT * step));
    expect(statusOverlayLift(step)).toBeLessThanOrEqual(STATUS_OVERLAY_LIFT);
  });
});
