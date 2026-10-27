import { describe, expect, it } from "vitest";

import { ENCOUNTERS } from "../data/encounters";
import type { DogId, EncounterId } from "../data/types";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { affectedDogs, hitLabel, opensCard } from "./encounters";

const pack = testState({ duchess: 5, kilo: 5, pierre: 5 });
const everyDog: DogId[] = ["duchess", "kilo", "pierre"];

describe("affectedDogs", () => {
  it("classifies each encounter", () => {
    for (const [, state, affected] of [
      ["every walking dog", pack, everyDog],
      ["no fired dog", testState({ duchess: 5, kilo: "fired", pierre: 5 }), ["duchess", "pierre"]],
    ] satisfies readonly [string, RunState, DogId[]][]) {
      expect(affectedDogs(state)).toEqual(affected);
    }
  });
});

describe("hitLabel", () => {
  it("labels each encounter from its data", () => {
    for (const id of Object.keys(ENCOUNTERS) as EncounterId[]) {
      const encounter = ENCOUNTERS[id];
      expect(hitLabel(encounter)).toBe("hitLabel" in encounter ? encounter.hitLabel : null);
    }
  });
});

describe("opensCard", () => {
  it("opens each encounter's card or applies it", () => {
    for (const [, id, affected, state, opens] of [
      ["no card with no dog affected", "squirrel", [], pack, false],
      ["a thief card for the pack", "thief", everyDog, pack, true],
      [
        "no card for an encounter the pack is immune to",
        "thief",
        ["duchess"],
        testState(
          { duchess: 5 },
          {
            immunities: [{ encounter: "thief", source: { kind: "upgrade", upgrade: "raincoats" } }],
          },
        ),
        false,
      ],
    ] satisfies readonly [string, EncounterId, DogId[], RunState, boolean][]) {
      expect(opensCard(affected, state, id)).toBe(opens);
    }
  });
});
