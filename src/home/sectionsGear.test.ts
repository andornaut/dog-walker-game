import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { homeSections } from "./sections";

const data = { ...gameData, tuning: TEST_TUNING };

describe("homeSections gear", () => {
  it.each<[string, WalkerId | null, DogId[], GearId | null, "complete" | "neutral", string]>([
    ["nothing picked", null, [], null, "neutral", ""],
    ["only the walker", "casey", [], null, "neutral", ""],
    ["only a dog", null, ["koda"], null, "neutral", ""],
    ["the walker and a dog", "casey", ["koda"], null, "complete", ""],
    ["gear before the required picks", null, [], "whistle", "complete", "Whistle"],
    ["everything", "casey", ["koda"], "whistle", "complete", "Whistle"],
  ])("with %s is %s", (_, walker, dogs, gear, state, note) => {
    const sections = homeSections(data, { dogSlots: 1 }, { loadout: { dogs, gear }, walker });
    expect(sections.gear).toEqual({ heading: data.homeText.sectionGear, note, state });
  });
});
