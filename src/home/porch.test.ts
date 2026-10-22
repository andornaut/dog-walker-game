import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { newPlayerSave, veteranSave } from "../testing/saves";
import { porchOwners } from "./porch";

describe("porchOwners", () => {
  const starters = (Object.keys(gameData.dogs) as DogId[]).filter(
    (dog) => gameData.dogs[dog].unlock === "start",
  );

  it("has the starter owners wait before the first walk, without a picked dog, and nobody after", () => {
    expect(porchOwners(gameData, newPlayerSave.stats, [])).toEqual(
      starters.map((dog) => ({ dog, withDog: true })),
    );
    const owners = porchOwners(gameData, newPlayerSave.stats, starters.slice(0, 1));
    expect(owners.map(({ withDog }) => withDog)).toEqual(starters.map((_, i) => i !== 0));
    expect(porchOwners(gameData, veteranSave().stats, [])).toEqual([]);
  });
});
