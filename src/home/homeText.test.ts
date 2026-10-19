import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { homeLine, placeholders } from "./homeText";

describe("the home text", () => {
  it("puts no names in the walker's bubble", () => {
    for (const line of Object.values(gameData.homeText.bubble)) {
      expect(placeholders(line), line).toEqual([]);
    }
  });
});

describe("homeLine", () => {
  it("fills every name, wherever it appears", () => {
    const text = { ...gameData.homeText, dogCantAfford: "{dog}: save {amount}, {dog}!" };
    expect(homeLine(text, "dogCantAfford", { amount: "$480", dog: "Nugget" })).toBe(
      "Nugget: save $480, Nugget!",
    );
  });
});
