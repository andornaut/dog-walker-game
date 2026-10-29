import { placeholders } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HELP_BODY_FIELDS, helpBody, helpBodyValues } from "./helpBody";

const { tuning } = gameData;

describe("helpBodyValues", () => {
  it("fills the dodge chance as one in n", () => {
    const values = helpBodyValues(gameData);
    expect(values.dodgeIn).toBe(String(Math.round(1 / tuning.probability.smallDodgeChance)));
  });
});

describe("helpBody", () => {
  it("fills every name in every page's body, using only the listed ones", () => {
    for (const [, page] of gameData.help.map((page) => [page.title, page] as const)) {
      expect(
        placeholders(page.body).filter(
          (name) => !(HELP_BODY_FIELDS as readonly string[]).includes(name),
        ),
      ).toEqual([]);
      expect(helpBody(gameData, page)).not.toMatch(/[{}]/);
    }
  });
});
