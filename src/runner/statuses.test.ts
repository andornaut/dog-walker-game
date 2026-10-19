import { describe, expect, it } from "vitest";

import { ENCOUNTERS } from "../data/encounters";
import type { DogId, EncounterId } from "../data/types";
import type { Choice } from "../rules/choices";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import {
  activeStatuses,
  dogDepthStep,
  startStatuses,
  STATUS_OVERLAY_LIFT,
  statusesKey,
  statusesOf,
  type StatusMark,
  statusOverlayKey,
} from "./statuses";

const data = { encounters: ENCOUNTERS };
const at = { timeMs: 5000, zoneIndex: 1 };

function card(encounter: EncounterId, affected: readonly DogId[]) {
  return { affected, source: { affected, encounter, kind: "encounter" } as const };
}

function optionIndex(encounter: EncounterId, name: string): number {
  const { resolution } = ENCOUNTERS[encounter];
  const index =
    resolution.kind === "card"
      ? resolution.options.findIndex((option) => option.name === name)
      : -1;
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

const started = (encounter: EncounterId, affected: readonly DogId[], choice: Choice) =>
  startStatuses(data, card(encounter, affected), at, choice, []);

describe("startStatuses", () => {
  it("makes the dogs a skunk caught Stinky on Quick rinse, the option with the debuff", () => {
    expect(started("skunk", ["koda", "nugget"], optionIndex("skunk", "Quick rinse"))).toEqual([
      { dog: "koda", startMs: 5000, status: "stinky", zoneIndex: 1 },
      { dog: "nugget", startMs: 5000, status: "stinky", zoneIndex: 1 },
    ]);
    expect(started("skunk", ["koda"], optionIndex("skunk", "Full groom"))).toEqual([]);
    expect(started("skunk", ["koda"], optionIndex("skunk", "Hold your nose"))).toEqual([]);
  });

  it("soaks the dogs a puddle caught on Splash through, and not on Towel off", () => {
    expect(started("puddle", ["pierre"], optionIndex("puddle", "Splash through"))).toEqual([
      { dog: "pierre", startMs: 5000, status: "soaked", zoneIndex: 1 },
    ]);
    expect(started("puddle", ["pierre"], optionIndex("puddle", "Towel off"))).toEqual([]);
  });

  it("spooks every dog after a thief, whichever option, but not on Skip", () => {
    for (const name of ["Chase them off", "Let it go"]) {
      const marks = started("thief", ["koda", "biscuit"], optionIndex("thief", name));
      expect(marks.map((mark) => [mark.dog, mark.status])).toEqual([
        ["koda", "spooked"],
        ["biscuit", "spooked"],
      ]);
    }
    expect(started("thief", ["koda"], "skip")).toEqual([]);
  });

  it("starts nothing for other encounters, forced stops and upgrade offers", () => {
    expect(started("squirrel", ["koda"], 0)).toEqual([]);
    const stop: CardSource = { kind: "forcedStop", stop: "stopSign" };
    expect(startStatuses(data, { affected: ["koda"], source: stop }, at, 0, [])).toEqual([]);
  });

  it("restarts a dog's status in place and drops marks from earlier zones", () => {
    const earlier: StatusMark[] = [
      { dog: "koda", startMs: 1000, status: "soaked", zoneIndex: 1 },
      { dog: "nugget", startMs: 1000, status: "soaked", zoneIndex: 1 },
      { dog: "biscuit", startMs: 900, status: "spooked", zoneIndex: 0 },
    ];
    const splash = optionIndex("puddle", "Splash through");
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
  const stinkyRun = testState({ koda: 5, nugget: 5 }, { debuffs: [{ debuff: "stinky" }] });

  it("shows Soaked and Spooked for the visible seconds of run time, newest first", () => {
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
    const run = testState({ nugget: 5 });
    expect(statusesOf(activeStatuses(10, run, 2000, sameTime), "nugget")).toEqual([
      "spooked",
      "soaked",
    ]);
  });

  it("shows Stinky only while the pack has the debuff", () => {
    const clean = testState({ koda: 5, nugget: 5 });
    expect(activeStatuses(10, clean, 60_000, marks)).toEqual([]);
    expect(activeStatuses(10, stinkyRun, 60_000, marks).map((mark) => mark.status)).toEqual([
      "stinky",
    ]);
  });

  it("ends every status with its zone, and shows none on a fired dog", () => {
    const nextZone = testState({ koda: 5, nugget: 5 }, { zoneIndex: 1 });
    expect(activeStatuses(10, nextZone, 2500, marks)).toEqual([]);
    const fired = testState({ koda: "fired", nugget: 5 }, { debuffs: [{ debuff: "stinky" }] });
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

describe("dogDepthStep", () => {
  it("reads the step from the dog's variant, or from its scale when drawn scaled", () => {
    expect(dogDepthStep("dog-koda", 1)).toBe(1);
    expect(dogDepthStep("dog-koda@75", 1)).toBe(0.75);
    expect(dogDepthStep("dog-nugget@50", 1)).toBe(0.5);
    expect(dogDepthStep("dog-koda", 0.75)).toBe(0.75);
    expect(dogDepthStep("dog-koda", 0.5)).toBe(0.5);
  });
});

describe("status overlays", () => {
  it("draw fx-status-<status>, 6, 4 and 3px below the top row at the three steps", () => {
    expect(statusOverlayKey("stinky")).toBe("fx-status-stinky");
    expect(STATUS_OVERLAY_LIFT).toEqual({ 0.5: 3, 0.75: 4, 1: 6 });
  });
});
