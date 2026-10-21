import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import type { DebuffId, DogId, EncounterId } from "../data/types";
import { WORLD } from "../data/world";
import type { Choice } from "../rules/choices";
import { testState } from "../testing/runState";
import {
  activeStatuses,
  type DogStatusId,
  startStatuses,
  statusesKey,
  statusesOf,
  type StatusMark,
} from "./statuses";

const data = { encounters: ENCOUNTERS };
const at = { timeMs: 5000, zone: WORLD.firstZone, zoneIndex: 1 };
const PAIR: DogId[] = ["koda", "nugget"];

function card(encounter: EncounterId, affected: readonly DogId[]) {
  return { affected, source: { affected, encounter, kind: "encounter" } as const };
}

// Every option of every card, with the debuffs it applies, and Skip, which applies none.
const OPTION_ROWS = (Object.keys(ENCOUNTERS) as EncounterId[]).flatMap((encounter) => {
  const { resolution } = ENCOUNTERS[encounter];
  const options = resolution.kind === "card" ? resolution.options : [];
  return [
    ...options.map(({ effects, name }, choice) => ({
      choice: choice as Choice,
      debuffs: effects.flatMap((effect): DebuffId[] =>
        effect.kind === "debuff" ? [effect.debuff] : [],
      ),
      encounter,
      name,
    })),
    ...(options.length === 0
      ? []
      : [{ choice: "skip" as Choice, debuffs: [] as DebuffId[], encounter, name: "Skip" }]),
  ];
});
const held = (debuffs: readonly DebuffId[]) =>
  debuffs.map((debuff) => ({ debuff, secondsLeft: 20, untilZone: 0 }));

describe("startStatuses", () => {
  it.each(OPTION_ROWS)(
    "puts $encounter's $name debuffs on every dog the card affected",
    ({ choice, debuffs, encounter }) => {
      const marks = startStatuses(data, card(encounter, PAIR), at, choice, []);
      expect(marks.map(({ dog, status }) => `${dog}:${status}`)).toEqual(
        debuffs.flatMap((debuff) => PAIR.map((dog) => `${dog}:${debuff}`)),
      );
    },
  );

  it("restarts a dog's status in place and drops marks from earlier zones", () => {
    const earlier: StatusMark[] = [
      { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 1 },
      { dog: "nugget", startMs: 1000, status: "stinky", zoneIndex: 1 },
      { dog: "biscuit", startMs: 900, status: "muddy", zoneIndex: 0 },
    ];
    const rinse = OPTION_ROWS.find(
      ({ debuffs, encounter }) => encounter === "skunk" && debuffs.includes("stinky"),
    );
    expect(rinse).toBeDefined();
    expect(startStatuses(data, card("skunk", ["koda"]), at, rinse?.choice ?? 0, earlier)).toEqual([
      { dog: "nugget", startMs: 1000, status: "stinky", zoneIndex: 1 },
      { dog: "koda", startMs: 5000, status: "stinky", zoneIndex: 1 },
    ]);
  });
});

describe("activeStatuses", () => {
  const marks: StatusMark[] = [
    { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 0 },
    { dog: "koda", startMs: 2000, status: "muddy", zoneIndex: 0 },
    { dog: "nugget", startMs: 3000, status: "muddy", zoneIndex: 0 },
  ];

  it("shows the statuses whose debuffs the pack holds, newest first", () => {
    const run = testState({ koda: 5, nugget: 5 }, { debuffs: held(["muddy"]) });
    expect(activeStatuses(run, marks).map(({ dog, status }) => `${dog}:${status}`)).toEqual([
      "nugget:muddy",
      "koda:muddy",
    ]);
  });

  it.each(Object.keys(DEBUFFS) as DogStatusId[])(
    "shows %s only while the pack has the debuff",
    (debuff) => {
      const mark: StatusMark = { dog: "koda", startMs: 0, status: debuff, zoneIndex: 0 };
      expect(activeStatuses(testState({ koda: 5 }), [mark])).toEqual([]);
      expect(activeStatuses(testState({ koda: 5 }, { debuffs: held([debuff]) }), [mark])).toEqual([
        mark,
      ]);
    },
  );

  it("ends every status with its zone, and shows none on a fired dog", () => {
    const debuffs = held(["muddy", "stinky"]);
    const nextZone = testState({ koda: 5, nugget: 5 }, { debuffs, zoneIndex: 1 });
    expect(activeStatuses(nextZone, marks)).toEqual([]);
    const fired = testState({ koda: "fired", nugget: 5 }, { debuffs });
    expect(activeStatuses(fired, marks).map((mark) => mark.dog)).toEqual(["nugget"]);
  });
});

describe("statusesOf and statusesKey", () => {
  const active: StatusMark[] = [
    { dog: "nugget", startMs: 3000, status: "muddy", zoneIndex: 0 },
    { dog: "koda", startMs: 2000, status: "muddy", zoneIndex: 0 },
    { dog: "koda", startMs: 1000, status: "stinky", zoneIndex: 0 },
  ];

  it("lists a dog's statuses in the order given, newest first", () => {
    expect(statusesOf(active, "koda")).toEqual(["muddy", "stinky"]);
    expect(statusesOf(active, "biscuit")).toEqual([]);
  });

  it("changes when a status starts or ends, not when only the time moves", () => {
    expect(statusesKey(active)).toBe("nugget:muddy,koda:muddy,koda:stinky");
    expect(statusesKey(active.slice(1))).not.toBe(statusesKey(active));
  });
});
