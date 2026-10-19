import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { evaluateCondition } from "./conditions";
import { affectedDogs, opensCard } from "./encounters";

const data = { dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
const pack = testState({ duchess: 5, koda: 5, pierre: 5 });

describe("affectedDogs", () => {
  it("rolls each dog against its size's catch chance for an area effect", () => {
    // 0.3 is under the medium and big chance (0.5) but over the small chance (0.25).
    expect(affectedDogs(data, () => 0.3, pack, "skunk")).toEqual(["koda", "pierre"]);
    expect(affectedDogs(data, () => 0.1, pack, "puddle")).toEqual(["duchess", "koda", "pierre"]);
    expect(affectedDogs(data, () => 0.6, pack, "puddle")).toEqual([]);
  });

  it("affects only dogs with the encounter's trait, or every dog", () => {
    expect(affectedDogs(data, () => 0, pack, "squirrel")).toEqual(["koda"]);
    expect(affectedDogs(data, () => 0, pack, "otherDog")).toEqual(["duchess", "koda", "pierre"]);
  });
});

describe("opensCard", () => {
  it("opens no card when no dog is affected", () => {
    expect(opensCard(data, [], pack, "squirrel")).toBe(false);
  });

  it("opens no thief card when the pack has a big dog", () => {
    expect(opensCard(data, ["koda", "pierre"], pack, "thief")).toBe(false);
    const noBigDog = testState({ duchess: 5, pierre: 5 });
    expect(opensCard(data, ["duchess", "pierre"], noBigDog, "thief")).toBe(true);
  });

  it("opens no card for an encounter the pack is immune to", () => {
    const whistle = testState({ duchess: 5 }, { immunities: ["thief"] });
    expect(opensCard(data, ["duchess"], whistle, "thief")).toBe(false);
  });
});

describe("evaluateCondition", () => {
  it("checks the pack for a size or a trait", () => {
    expect(evaluateCondition(DOGS, { kind: "packHasSize", size: "big" }, ["koda"])).toBe(true);
    expect(evaluateCondition(DOGS, { kind: "packHasSize", size: "big" }, ["duchess"])).toBe(false);
    expect(evaluateCondition(DOGS, { kind: "packHasTrait", trait: "fancy" }, ["duchess"])).toBe(
      true,
    );
    expect(evaluateCondition(DOGS, { kind: "packHasTrait", trait: "chaser" }, [])).toBe(false);
  });
});
