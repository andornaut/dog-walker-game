import { describe, expect, it } from "vitest";

import { ENCOUNTERS } from "../data/encounters";
import type { DogId, EncounterId } from "../data/types";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { affectedDogs, hitLabel, opensCard } from "./encounters";

const pack = testState({ duchess: 5, koda: 5, pierre: 5 });
const everyDog: DogId[] = ["duchess", "koda", "pierre"];

describe("affectedDogs", () => {
  it.each<[string, RunState, DogId[]]>([
    ["every walking dog", pack, everyDog],
    ["no fired dog", testState({ duchess: 5, koda: "fired", pierre: 5 }), ["duchess", "pierre"]],
  ])("is %s", (_, state, affected) => {
    expect(affectedDogs(state)).toEqual(affected);
  });
});

describe("hitLabel", () => {
  it.each(Object.keys(ENCOUNTERS) as EncounterId[])("labels %s from its data", (id) => {
    const encounter = ENCOUNTERS[id];
    expect(hitLabel(encounter)).toBe("hitLabel" in encounter ? encounter.hitLabel : null);
  });
});

describe("opensCard", () => {
  it.each<[string, EncounterId, DogId[], RunState, boolean]>([
    ["no card with no dog affected", "squirrel", [], pack, false],
    ["a thief card for the pack", "thief", everyDog, pack, true],
    [
      "no card for an encounter the pack is immune to",
      "thief",
      ["duchess"],
      testState({ duchess: 5 }, { immunities: [{ encounter: "thief" }] }),
      false,
    ],
  ])("opens %s", (_, id, affected, state, opens) => {
    expect(opensCard(affected, state, id)).toBe(opens);
  });
});
