import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { homeSections, startReady, walkerPicked } from "./sections";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;
const owned = { dogSlots: 1 };
const nothing = { dogs: [], gear: null } as const;

describe("walkerPicked", () => {
  it.each([
    ["waits for a new player to tap a face", 0, false, false],
    ["takes a new player's tapped face", 0, true, true],
    ["counts the saved walker as picked once the player has walked", 1, false, true],
  ])("%s", (_name, walks, tapped, expected) => {
    expect(walkerPicked(walks, tapped)).toBe(expected);
  });
});

describe("homeSections", () => {
  it("asks for what each required section lacks, and leaves gear neutral", () => {
    const sections = homeSections(data, owned, { loadout: nothing, walker: null });
    expect(sections.walker).toEqual({
      heading: text.sectionWalker,
      note: text.sectionWalkerPrompt,
      state: "incomplete",
    });
    expect(sections.dogs).toEqual({
      heading: text.sectionDogs,
      note: text.sectionDogsPrompt,
      state: "incomplete",
    });
    expect(sections.gear).toEqual({ heading: text.sectionGear, note: "", state: "neutral" });
  });

  it("names each choice once made: the walker, the pack count and the gear item", () => {
    const loadout = { dogs: ["koda"], gear: "whistle" } as const;
    const sections = homeSections(data, { dogSlots: 2 }, { loadout, walker: "casey" });
    expect(sections.walker).toMatchObject({ note: "Casey", state: "complete" });
    expect(sections.dogs).toMatchObject({ note: "Pack 1/2", state: "complete" });
    expect(sections.gear).toMatchObject({ note: "Whistle", state: "complete" });
  });
});

describe("startReady", () => {
  const ready = (walker: WalkerId | null, dogs: readonly DogId[]) =>
    startReady(homeSections(data, owned, { loadout: { dogs, gear: null }, walker }));

  it("needs both a walker and a dog, and never gear", () => {
    expect(ready(null, [])).toBe(false);
    expect(ready("casey", [])).toBe(false);
    expect(ready(null, ["koda"])).toBe(false);
    expect(ready("casey", ["koda"])).toBe(true);
  });
});
