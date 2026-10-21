import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { homeLine } from "./homeText";
import { homeSections, startReady } from "./sections";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;
const owned = { dogSlots: 1 };

describe("homeSections", () => {
  // Nothing chosen is neutral and something chosen is complete, for every section.
  it.each([
    {
      dogs: [],
      expected: {
        dogs: { note: homeLine(text, "packCount", { count: "0", max: "2" }), state: "neutral" },
        pocket: { note: text.pocket.note, state: "neutral" },
        walker: { note: text.sectionWalkerPrompt, state: "neutral" },
      },
      gear: null,
      walker: null,
    },
    {
      dogs: ["koda"],
      expected: {
        dogs: { note: homeLine(text, "packCount", { count: "1", max: "2" }), state: "complete" },
        pocket: { note: data.shopGear.luckyCollar.name, state: "complete" },
        walker: { note: "Casey", state: "complete" },
      },
      gear: "luckyCollar",
      walker: "casey",
    },
  ] as const)(
    "walker $walker, $dogs.length dogs, gear $gear",
    ({ dogs, expected, gear, walker }) => {
      const loadout = { dogs, gear };
      const sections = homeSections(data, { dogSlots: 2 }, { loadout, walker });
      expect(sections).toEqual({
        dogs: { heading: text.sectionDogs, ...expected.dogs },
        pocket: { heading: text.pocket.title, ...expected.pocket },
        walker: { heading: text.sectionWalker, ...expected.walker },
      });
    },
  );
});

describe("startReady", () => {
  const ready = (walker: WalkerId | null, dogs: readonly DogId[]) =>
    startReady(homeSections(data, owned, { loadout: { dogs, gear: null }, walker }));

  // An empty Pocket never holds the walk back.

  it.each([
    { dogs: [], expected: false, walker: null },
    { dogs: [], expected: false, walker: "casey" },
    { dogs: ["koda"], expected: false, walker: null },
    { dogs: ["koda"], expected: true, walker: "casey" },
  ] as const)("walker $walker with $dogs.length dogs: $expected", ({ dogs, expected, walker }) => {
    expect(ready(walker, dogs)).toBe(expected);
  });
});
