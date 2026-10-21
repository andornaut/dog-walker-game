import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { placeholders } from "../text/lines";
import { HELP_BODY_FIELDS, helpBody, helpBodyValues } from "./helpBody";

const { debuffs, tuning } = gameData;
const debuffSeconds = Object.values(debuffs).map(({ seconds }) => tuning.seconds[seconds]);

describe("helpBodyValues", () => {
  it("fills the debuff seconds as one value or a range, and the dodge chance as one in n", () => {
    const values = helpBodyValues(gameData);
    const [least, most] = [Math.min(...debuffSeconds), Math.max(...debuffSeconds)];
    expect(values.debuffSeconds).toBe(least === most ? String(least) : `${least} to ${most}`);
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
