import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HOME_TEXT_FIELDS } from "../home/homeText";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { RUN_TEXT_FIELDS } from "../hud/runText";
import { type FieldTable, fillLine, strayNames } from "./lines";

describe("the game's text", () => {
  it.each<[string, FieldTable, object]>([
    ["home", HOME_TEXT_FIELDS, gameData.homeText],
    ["menu", MENU_TEXT_FIELDS, gameData.menuText],
    ["run", RUN_TEXT_FIELDS, gameData.runText],
  ])("uses only the names each %s line is given", (_, table, text) => {
    expect(strayNames(table, text)).toEqual([]);
  });
});

describe("strayNames", () => {
  it.each<[string, FieldTable, object, string[]]>([
    ["a listed name", { a: ["dog"] }, { a: "{dog}!" }, []],
    ["an unlisted name", { a: ["dog"] }, { a: "{dog} {gear}" }, ["a: {gear}"]],
    ["a line its table leaves out", {}, { a: "{dog}" }, ["a: {dog}"]],
    [
      "a line in a group",
      { g: { a: [] } },
      { g: { a: "{x}", b: "{y}" } },
      ["g.a: {x}", "g.b: {y}"],
    ],
  ])("reports %s", (_, table, text, stray) => {
    expect(strayNames(table, text)).toEqual(stray);
  });
});

describe("fillLine", () => {
  it("fills every name, wherever it appears", () => {
    const table = { line: ["owner"] } as const;
    expect(fillLine(table, { line: "{owner}, {owner}!" }, "line", { owner: "Rosa" })).toBe(
      "Rosa, Rosa!",
    );
  });
});
