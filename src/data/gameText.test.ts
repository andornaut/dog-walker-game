import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HOME_TEXT_FIELDS } from "../home/homeText";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { RUN_TEXT_FIELDS } from "../hud/runText";
import { type FieldTable, strayNames } from "../lib/lines";

describe("the game's text", () => {
  it("uses only the names each home, menu and run line is given", () => {
    for (const [, table, text] of [
      ["home", HOME_TEXT_FIELDS, gameData.homeText],
      ["menu", MENU_TEXT_FIELDS, gameData.menuText],
      ["run", RUN_TEXT_FIELDS, gameData.runText],
    ] satisfies readonly [string, FieldTable, object][]) {
      expect(strayNames(table, text)).toEqual([]);
    }
  });
});
