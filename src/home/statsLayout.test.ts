import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { scrollMax } from "../input/listScroll";
import { fillLine, wrapWords } from "../lib/lines";
import { veteranSave } from "../save/fixtures";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk, inkWidth } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_SCALE } from "../ui/textFit";
import { badgeWall } from "./badgesView";
import { MENU_TEXT_FIELDS } from "./menuText";
import {
  badgesBottom,
  DETAIL_TEXT_WIDTH,
  detailLineY,
  DOG_STATS,
  dogBlockTop,
  dogsBottom,
  STATS_LAYOUT,
  STATS_TABS,
  statsScrollbar,
  statsTabRects,
  walksBottom,
} from "./statsLayout";
import { overallRows } from "./statsView";

const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");
const BADGES = badgeWall(gameData, { achievements: {} });
const words = gameData.menuText.stats;

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
// A wall cell's last line keeps its lowest ink inside the row.
describe("a wall badge's text", () => {
  it("leaves the last line's lowest ink inside the row", () => {
    const { lineHeight, lines, y } = STATS_LAYOUT.wallText;
    const lowest = y + (lines - 1) * lineHeight + inkRowsFromCapTop(BODY) * TEXT_SCALE;
    expect(lowest).toBeLessThanOrEqual(STATS_LAYOUT.wall.rowHeight);
  });
});

// The open badge holds its name in the title font, its goal and its line at 2x, the line's
// lowest ink inside the panel.
describe("the open badge", () => {
  const { detail, detailText } = STATS_LAYOUT;
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));

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

const { dogs, panel, rows, scrollbar, view, wall, wallText } = STATS_LAYOUT;
const STYLE = { letterSpacing: 0, scale: TEXT_SCALE };
// The least gap between a label's ink and its value's, and between any ink and the scrollbar.
const GAP = 4;
const BAR_LEFT = scrollbar.x - GAP;
// The lowest ink of a body line whose capitals' top is at y.
const inkBottom = (y: number) => y + inkRowsFromCapTop(BODY) * TEXT_SCALE;
const bodyRight = (x: number, text: string) => x + fontInk("font-body", STYLE, text).right;
const titleRight = (x: number, text: string) =>
  x + fontInk("font-title", STYLE, text.toUpperCase()).right;
const valueLeft = (value: string) => rows.right - inkWidth("font-body", STYLE, value);

// The Walks tab's rows with the widest figures: four-digit counts and dollars, and three-digit
// firings by the owner with the widest name.
const save = veteranSave();
const widest = (texts: readonly string[]) =>
  texts.reduce((a, b) =>
    inkWidth("font-body", STYLE, b) > inkWidth("font-body", STYLE, a) ? b : a,
  );
const ownerName = widest(Object.values(gameData.dogs).map(({ owner }) => owner.name));
const walksRows = Object.values(overallRows(gameData, save.stats))
  .flat()
  .map(({ label, value }) => {
    if (label === words.overall.timesFired) {
      return {
        label,
        value: fillLine(MENU_TEXT_FIELDS.stats, words, "timesFiredBy", {
          count: "999",
          owner: ownerName,
        }),
      };
    }
    return { label, value: value.startsWith("$") ? "$9,999" : "9999" };
  });
const dogStatRows = DOG_STATS.map((stat) => ({ label: words.dogColumns[stat], value: "9999" }));

describe("the Walks and Dogs tabs' rows", () => {
  it.each([...walksRows, ...dogStatRows].map((row) => [row.label, row.value] as const))(
    "keeps %s a gap clear of its value, %s",
    (label, value) => {
      expect(bodyRight(rows.left, label) + GAP).toBeLessThanOrEqual(valueLeft(value));
    },
  );
});

describe("the Dogs tab's blocks", () => {
  it.each(Object.values(gameData.dogs).map(({ name }) => [name] as const))(
    "fits %s's name beside its face, clear of the scrollbar",
    (name) => {
      expect(titleRight(rows.left + dogs.nameDx, name)).toBeLessThanOrEqual(BAR_LEFT);
    },
  );

  // Each block: the face left of the name, the face and the name's ink over the rows, the
  // last row's ink over the rule above the next block.
  it("keeps each block's face, name, rows and rule in order", () => {
    const top = dogBlockTop(0);
    const nameInk = top + dogs.nameY + inkRowsFromCapTop(TITLE) * TEXT_SCALE;
    const lastRowInk = inkBottom(top + dogs.rowsY + (DOG_STATS.length - 1) * rows.pitch);
    expect(dogs.faceSize).toBeLessThanOrEqual(dogs.nameDx);
    expect(Math.max(top + dogs.faceSize, nameInk)).toBeLessThan(top + dogs.rowsY);
    expect(lastRowInk).toBeLessThan(dogBlockTop(1) - dogs.ruleAbove);
  });
});

// Nothing drawn on a tab reaches the scrollbar, which sits inside the panel's frame.
describe("the scrollbar", () => {
  it.each<[string, number]>([
    ["the rows' values", rows.right],
    ["a dog block's rule", rows.right + dogs.ruleDx],
    ["the badge rows", wall.x + wall.width],
    ["a badge's text", wall.x + wallText.x + wallText.width],
  ])("stays clear of %s", (_, right) => {
    expect(right).toBeLessThanOrEqual(BAR_LEFT);
  });

  it("sits at the view's right edge, as tall as the view", () => {
    const bar = statsScrollbar(100, 0);
    expect(bar?.track).toEqual({
      height: view.height,
      width: scrollbar.trackWidth,
      x: view.x + view.width - scrollbar.trackWidth,
      y: view.y,
    });
    expect(view.x + view.width).toBeLessThanOrEqual(panel.x + panel.width - 2);
  });
});

// Each tab as long as it gets, with every dog owned: scrolled to its end, its last row's ink
// is in the view; the Walks tab fits without scrolling.
describe("each tab's scroll", () => {
  const dogCount = Object.keys(gameData.dogs).length;
  const badgeCount = BADGES.length;
  const { outcomes, overall } = overallRows(gameData, save.stats);
  const walks = [overall.length, outcomes.length];
  const { rowsY, sectionGap, top } = STATS_LAYOUT.walks;
  const walksHeight = walks.reduce((sum, n) => sum + rowsY + n * rows.pitch + sectionGap, 0);
  it.each<[string, number, number, boolean]>([
    ["Walks", walksBottom(walks), inkBottom(top + walksHeight - sectionGap - rows.pitch), false],
    [
      "Dogs",
      dogsBottom(dogCount),
      inkBottom(dogBlockTop(dogCount - 1) + dogs.rowsY + (DOG_STATS.length - 1) * rows.pitch),
      true,
    ],
    ["Badges", badgesBottom(badgeCount), wall.y + badgeCount * wall.rowHeight, true],
  ])("%s: brings its last row into view", (_, bottom, lastInk, scrolls) => {
    const max = scrollMax(view, bottom);
    expect(max > 0).toBe(scrolls);
    expect(lastInk - max).toBeLessThanOrEqual(view.y + view.height);
    expect(bottom - max).toBeLessThanOrEqual(view.y + view.height);
  });
});
