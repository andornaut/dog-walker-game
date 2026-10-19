import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import type { Condition, DogId, EncounterId } from "../data/types";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { evaluateCondition } from "./conditions";
import { affectedDogs, hitLabel, opensCard } from "./encounters";

const data = { dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
const pack = testState({ duchess: 5, koda: 5, pierre: 5 });
const everyDog: DogId[] = ["duchess", "koda", "pierre"];

describe("affectedDogs", () => {
  // Duchess is small, Koda big and Pierre medium. 0.3 is under the medium and big catch
  // chance (0.5) but over the small one (0.25).
  it.each<[string, EncounterId, number, RunState, DogId[]]>([
    ["an area roll catches each dog by its size", "skunk", 0.3, pack, ["koda", "pierre"]],
    ["an area roll under every chance catches all", "puddle", 0.1, pack, everyDog],
    ["an area roll over every chance catches none", "puddle", 0.6, pack, []],
    ["a trait encounter takes only that trait", "squirrel", 0, pack, ["koda"]],
    ["an every-dog encounter takes all", "otherDog", 0, pack, everyDog],
    [
      "a picnic takes the food-driven dogs",
      "picnic",
      0,
      testState({ biscuit: 5, koda: 5, nugget: 5 }),
      ["biscuit", "nugget"],
    ],
    ["a picnic takes none without food-driven dogs", "picnic", 0, pack, []],
    ["the goose takes all", "goose", 0, pack, everyDog],
    ["the petunias take all", "petunias", 0, pack, everyDog],
    ["the trash takes all", "trash", 0, pack, everyDog],
    ["the cafe takes all", "cafe", 0, pack, everyDog],
    ["the lemonade takes all", "lemonade", 0, pack, everyDog],
  ])("%s", (_, id, roll, state, affected) => {
    expect(affectedDogs(data, () => roll, state, id)).toEqual(affected);
  });
});

describe("hitLabel", () => {
  it.each<[EncounterId, string | null]>([
    ["goose", "HONK!"],
    ["lemonade", "LEMONADE!"],
    ["lostWallet", null],
    ["photoOp", null],
  ])("labels %s %s", (id, label) => {
    expect(hitLabel(ENCOUNTERS[id])).toBe(label);
  });
});

describe("opensCard", () => {
  it.each<[string, EncounterId, DogId[], RunState, boolean]>([
    ["no card with no dog affected", "squirrel", [], pack, false],
    ["no thief card when the pack has a big dog", "thief", ["koda", "pierre"], pack, false],
    [
      "a thief card with no big dog",
      "thief",
      ["duchess", "pierre"],
      testState({ duchess: 5, pierre: 5 }),
      true,
    ],
    ["the goose's card even with a big dog", "goose", everyDog, pack, true],
    [
      "no card for an encounter the pack is immune to",
      "thief",
      ["duchess"],
      testState({ duchess: 5 }, { immunities: [{ encounter: "thief" }] }),
      false,
    ],
  ])("opens %s", (_, id, affected, state, opens) => {
    expect(opensCard(data, affected, state, id)).toBe(opens);
  });
});

describe("evaluateCondition", () => {
  it.each<[Condition, DogId, boolean]>([
    [{ kind: "packHasSize", size: "big" }, "koda", true],
    [{ kind: "packHasSize", size: "big" }, "duchess", false],
    [{ kind: "packHasTrait", trait: "fancy" }, "duchess", true],
    [{ kind: "packHasTrait", trait: "chaser" }, "duchess", false],
  ])("checks %o against %s: %s", (condition, dog, holds) => {
    expect(evaluateCondition(DOGS, condition, [dog])).toBe(holds);
  });
});
