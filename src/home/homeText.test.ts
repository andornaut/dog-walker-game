import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HOME_TEXT_FIELDS, homeLine, placeholders } from "./homeText";

describe("the home text", () => {
  it("uses only the names each line is given", () => {
    for (const [key, allowed] of Object.entries(HOME_TEXT_FIELDS)) {
      const line = gameData.homeText[key as keyof typeof HOME_TEXT_FIELDS];
      for (const name of placeholders(line)) {
        expect(allowed as readonly string[], `${key}: {${name}}`).toContain(name);
      }
    }
  });

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
