import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { TEXT_SCALE } from "../layout/textFit";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk, inkWidth } from "../testing/fontInk";
import { fillLine, wrapWords } from "../text/lines";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { badgeWall } from "./badgesView";
import { MENU_TEXT_FIELDS } from "./menuText";
import {
  DETAIL_TEXT_WIDTH,
  detailLineY,
  DOG_COLUMNS,
  type DogColumn,
  dogColumnRights,
  STATS_LAYOUT,
  STATS_TABS,
  statsTabRects,
} from "./statsLayout";

const BODY = fontFileMetrics("font-body");
const BADGES = badgeWall(gameData, { achievements: {} });

// The tabs span the panel's columns, side by side, over its top; each label fits its tab.
describe("the tabs", () => {
  const tabs = statsTabRects();

  it("fits every tab label", () => {
    for (const [tab, i] of STATS_TABS.map((tab, i) => [tab, i] as const)) {
      const label = gameData.menuText.stats.tabs[tab];
      const style = { letterSpacing: 0, scale: TEXT_SCALE };
      expect(inkWidth("font-title", style, label.toUpperCase())).toBeLessThan(tabs[i]?.width ?? 0);
    }
  });
});
// A wall cell's last line, at the cell's scale, keeps its lowest ink inside the row.
describe("a wall badge's text", () => {
  it("leaves the last line's lowest ink inside the row", () => {
    const { lineHeight, lines, scale, y } = STATS_LAYOUT.wallText;
    const inkBottom = y + (lines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    expect(inkBottom).toBeLessThanOrEqual(STATS_LAYOUT.wall.rowHeight);
  });
});

// The open badge holds its name in the title font, its goal and its line at 2x, the line's
// lowest ink inside the panel.
describe("the open badge", () => {
  const { detail, detailText } = STATS_LAYOUT;
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));
  const words = gameData.menuText.stats;

  it("holds every badge", () => {
    for (const [, badge] of BADGES.map((badge) => [badge.name, badge] as const)) {
      const title = { letterSpacing: 0, scale: 2 };
      const room = detail.width - 2 * detailText.x;
      expect(inkWidth("font-title", title, badge.name.toUpperCase())).toBeLessThanOrEqual(room);
      const goal = wrapWords(width, DETAIL_TEXT_WIDTH, badge.goal);
      const text = fillLine(MENU_TEXT_FIELDS.stats, words, "badgeLine", { line: badge.badgeLine });
      const line = wrapWords(width, DETAIL_TEXT_WIDTH, text);
      expect(Math.max(...[...goal, ...line].map(width))).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH);
      const lastTop = detailLineY(BODY, goal.length) + (line.length - 1) * BODY.lineHeight * 2;
      const inkBottom = lastTop + inkRowsFromCapTop(BODY) * 2;
      expect(inkBottom).toBeLessThanOrEqual(detail.height - detailText.foot);
    }
  });
});

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
  it("keeps every number heading a gap clear of the one before", () => {
    for (const [before, column] of DOG_COLUMNS.flatMap((column, i) => {
      const before = DOG_COLUMNS[i - 1];
      return before === undefined ? [] : [[before, column] as const];
    })) {
      expect(rights[before] + dogColumns.gap).toBeLessThanOrEqual(rights[column] - width(column));
    }
  });

  it("keeps the Dog heading and the longest dog name a gap clear of the first number column", () => {
    for (const right of [dogHeadingRight, namesRight]) {
      expect(right + dogColumns.gap).toBeLessThanOrEqual(firstLeft);
    }
  });
});
