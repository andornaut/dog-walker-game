import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { placeholders } from "../text/lines";
import { HELP_BODY_FIELDS, helpBody, type HelpBodyField, helpBodyValues } from "./helpBody";

const { debuffs, tuning, world } = gameData;
const debuffSeconds = Object.values(debuffs).map(({ seconds }) => tuning.seconds[seconds]);

describe("helpBodyValues", () => {
  it.each<[HelpBodyField, string]>([
    ["bigHearts", String(tuning.hearts.maxBySize.big)],
    ["bumpHearts", String(tuning.hearts.bump)],
    [
      "debuffSeconds",
      Math.min(...debuffSeconds) === Math.max(...debuffSeconds)
        ? String(Math.min(...debuffSeconds))
        : `${Math.min(...debuffSeconds)} to ${Math.max(...debuffSeconds)}`,
    ],
    ["dodgeIn", String(Math.round(1 / tuning.probability.smallDodgeChance))],
    ["mediumHearts", String(tuning.hearts.maxBySize.medium)],
    ["smallHearts", String(tuning.hearts.maxBySize.small)],
    ["tip", `$${tuning.money.tip}`],
    ["treatHearts", String(tuning.hearts.treat)],
    ["walkLength", String(world.walkLength)],
    ["world", world.name],
  ])("fills {%s} with %s", (field, expected) => {
    expect(helpBodyValues(gameData)[field]).toBe(expected);
  });
});

describe("helpBody", () => {
  it.each(gameData.help.map((page) => [page.title, page] as const))(
    "fills every name in %s's body, using only the listed ones",
    (_, page) => {
      expect(
        placeholders(page.body).filter(
          (name) => !(HELP_BODY_FIELDS as readonly string[]).includes(name),
        ),
      ).toEqual([]);
      expect(helpBody(gameData, page)).not.toMatch(/[{}]/);
    },
  );
});
