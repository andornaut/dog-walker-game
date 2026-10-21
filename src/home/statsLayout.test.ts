import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { TEXT_SCALE } from "../layout/textFit";
import { fontInk, inkWidth } from "../testing/fontInk";
import { DOG_COLUMNS, type DogColumn, dogColumnRights, STATS_LAYOUT } from "./statsLayout";

const { dogColumns, dogRow, rows } = STATS_LAYOUT;
const headings = gameData.menuText.stats.dogColumns;
const STYLE = { letterSpacing: 0, scale: TEXT_SCALE };

// The Dogs tab as drawn, each number column as wide as its heading's ink in the body font, and
// the Dog heading in the title font's capitals.
const width = (column: DogColumn) => inkWidth("font-body", STYLE, headings[column]);
const rights = dogColumnRights(width);
const firstLeft = Math.min(...DOG_COLUMNS.map((column) => rights[column] - width(column)));
const dogHeadingRight = rows.left + fontInk("font-title", STYLE, headings.dog.toUpperCase()).right;
const namesRight =
  dogRow.nameX +
  Math.max(
    ...Object.values(gameData.dogs).map(({ name }) => fontInk("font-body", STYLE, name).right),
  );

describe("the Dogs tab's columns", () => {
  it.each(
    DOG_COLUMNS.flatMap((column, i) => {
      const before = DOG_COLUMNS[i - 1];
      return before === undefined ? [] : [[before, column] as const];
    }),
  )("keeps the %s heading a gap clear of the %s heading", (before, column) => {
    expect(rights[before] + dogColumns.gap).toBeLessThanOrEqual(rights[column] - width(column));
  });

  it.each([
    ["the Dog heading", dogHeadingRight],
    ["the longest dog name", namesRight],
  ])("keeps %s a gap clear of the first number column", (_, right) => {
    expect(right + dogColumns.gap).toBeLessThanOrEqual(firstLeft);
  });

  it("puts each name clear of its face", () => {
    expect(dogRow.faceX + dogRow.faceSize).toBeLessThan(dogRow.nameX);
  });
});
