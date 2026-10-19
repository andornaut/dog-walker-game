import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { newPlayerSave } from "../save/fixtures";
import { homeSections, startReady } from "./sections";

describe("a first visit", () => {
  it.each([
    { dogs: [], ready: false },
    { dogs: ["koda"], ready: true },
  ] as const)("is ready to start with $dogs.length dogs: the saved walker counts", (row) => {
    const sections = homeSections(gameData, newPlayerSave.owned, {
      loadout: { dogs: row.dogs as readonly DogId[], gear: null },
      walker: newPlayerSave.walker,
    });
    expect(sections.walker.state).toBe("complete");
    expect(startReady(sections)).toBe(row.ready);
  });
});
