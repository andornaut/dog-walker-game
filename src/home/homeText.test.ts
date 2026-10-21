import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { placeholders } from "../text/lines";

describe("the home text", () => {
  it("puts no names in the walker's bubble", () => {
    for (const line of Object.values(gameData.homeText.bubble)) {
      expect(placeholders(line), line).toEqual([]);
    }
  });
});
