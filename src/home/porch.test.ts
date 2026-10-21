import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { porchOwners } from "./porch";

describe("porchOwners", () => {
  const starters = (Object.keys(gameData.dogs) as DogId[]).filter(
    (dog) => gameData.dogs[dog].unlock === "start",
  );

  it("has the starter owners wait with their dogs before the first walk", () => {
    expect(porchOwners(gameData, newPlayerSave.stats, [])).toEqual(
      starters.map((dog) => ({ dog, withDog: true })),
    );
  });

  it("leaves an owner waiting without the dog the player picked", () => {
    const owners = porchOwners(gameData, newPlayerSave.stats, starters.slice(0, 1));
    expect(owners.map(({ withDog }) => withDog)).toEqual(starters.map((_, i) => i !== 0));
  });

  it("has nobody waiting once a walk has ended", () => {
    expect(porchOwners(gameData, veteranSave().stats, [])).toEqual([]);
  });
});
