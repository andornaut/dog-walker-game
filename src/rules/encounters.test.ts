import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import type { Condition, DogId, EncounterId, Size } from "../data/types";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { evaluateCondition } from "./conditions";
import { affectedDogs, hitLabel, hoppingDogs, opensCard } from "./encounters";

const data = { dogs: DOGS, encounters: ENCOUNTERS };
const pack = testState({ duchess: 5, koda: 5, pierre: 5 });
const everyDog: DogId[] = ["duchess", "koda", "pierre"];

describe("affectedDogs", () => {
  it.each<[string, EncounterId, RunState, DogId[]]>([
    ["a trait encounter takes only that trait", "squirrel", pack, ["koda"]],
    ["an every-dog encounter takes all", "otherDog", pack, everyDog],
    [
      "a picnic takes the food-driven dogs",
      "picnic",
      testState({ biscuit: 5, koda: 5, nugget: 5 }),
      ["biscuit", "nugget"],
    ],
    ["a picnic takes none without food-driven dogs", "picnic", pack, []],
    ["the goose takes all", "goose", pack, everyDog],
    ["the petunias take all", "petunias", pack, everyDog],
    ["the trash takes all", "trash", pack, everyDog],
    ["the cafe takes all", "cafe", pack, everyDog],
    ["the lemonade takes all", "lemonade", pack, everyDog],
  ])("%s", (_, id, state, affected) => {
    expect(affectedDogs(data, state, id)).toEqual(affected);
  });
});

describe("an area effect", () => {
  // The skunk, catching only the sizes given.
  const catching = (catches: readonly Size[]) =>
    ({
      dogs: DOGS,
      encounters: {
        ...ENCOUNTERS,
        skunk: { ...ENCOUNTERS.skunk, affects: { catches, kind: "caught" } },
      },
    }) as const;

  // Duchess is small, Koda big and Pierre medium.
  it.each<[Size[], DogId[], DogId[]]>([
    [["big"], ["koda"], ["duchess", "pierre"]],
    [["big", "medium"], ["koda", "pierre"], ["duchess"]],
    [["big", "medium", "small"], everyDog, []],
  ])("catching %j catches %j, and %j hop over it", (catches, caught, hopping) => {
    expect(affectedDogs(catching(catches), pack, "skunk")).toEqual(caught);
    expect(hoppingDogs(catching(catches), pack, "skunk")).toEqual(hopping);
  });

  it("has no dog hop an encounter that is not an area effect", () => {
    expect(hoppingDogs(data, pack, "otherDog")).toEqual([]);
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
