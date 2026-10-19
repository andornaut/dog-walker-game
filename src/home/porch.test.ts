import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { porchOwners } from "./porch";

describe("porchOwners", () => {
  it("has the three starter owners wait with their dogs before the first walk", () => {
    expect(porchOwners(gameData, newPlayerSave.stats, [])).toEqual([
      { dog: "biscuit", withDog: true },
      { dog: "duchess", withDog: true },
      { dog: "koda", withDog: true },
    ]);
  });

  it("leaves an owner waiting without the dog the player picked", () => {
    const owners = porchOwners(gameData, newPlayerSave.stats, ["koda"]);
    expect(owners.map(({ withDog }) => withDog)).toEqual([true, true, false]);
  });

  it("has nobody waiting once a walk has ended", () => {
    expect(porchOwners(gameData, veteranSave().stats, [])).toEqual([]);
  });
});
