import { type FieldTable, strayNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { HOME_TEXT_FIELDS } from "../home/homeText";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { RUN_TEXT_FIELDS } from "../hud/runText";
import { gameData } from "./";

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
