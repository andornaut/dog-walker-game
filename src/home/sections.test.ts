import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { TEST_TUNING } from "../testing/tuning";
import { homeLine } from "./homeText";
import { homeSections } from "./sections";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;

describe("homeSections", () => {
  // Nothing chosen is neutral and something chosen is complete, for every section.
  it("shows each section neutral with nothing chosen and complete with something chosen", () => {
    for (const { dogs, expected, gear, walker } of [
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
    ] as const) {
      const loadout = { dogs, gear };
      const sections = homeSections(data, { dogSlots: [1, 3] }, { loadout, walker });
      expect(sections).toEqual({
        dogs: { heading: text.sectionDogs, ...expected.dogs },
        pocket: { heading: text.pocket.title, ...expected.pocket },
        walker: { heading: text.sectionWalker, ...expected.walker },
      });
    }
  });
});
