import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { newPlayerSave, STARTER_DOGS, veteranSave } from "../testing/saves";
import { HOME_LAYOUT } from "./homeLayout";
import { porchOwners } from "./porch";

describe("porchOwners", () => {
  it("has the starter owners wait before the first walk, without a picked dog, and nobody after", () => {
    expect(porchOwners(gameData, newPlayerSave.stats, [])).toEqual(
      STARTER_DOGS.map((dog) => ({ dog, withDog: true })),
    );
    const owners = porchOwners(gameData, newPlayerSave.stats, STARTER_DOGS.slice(0, 1));
    expect(owners.map(({ withDog }) => withDog)).toEqual(STARTER_DOGS.map((_, i) => i !== 0));
    expect(porchOwners(gameData, veteranSave().stats, [])).toEqual([]);
  });

  it.each(STARTER_DOGS)("gives starter %s a spot at the gate", (dog) => {
    expect(HOME_LAYOUT.porchSpots).toHaveProperty(dog);
  });
});
