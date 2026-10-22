import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { scrollMax } from "../input/listScroll";
import { fillLine, wrapWords } from "../lib/lines";
import { cents, read } from "../rules/units";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk, inkWidth } from "../testing/fontInk";
import { veteranSave } from "../testing/saves";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_SCALE } from "../ui/textFit";
import {
  BADGE_STRIP,
  badgeProgress,
  badgeWall,
  wallCell,
  wallCellLineCount,
  wallRects,
} from "./badgesView";
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
  wallRowHeight,
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
// A wall row holds its badge and its text: the badge with room over and under it, and the
// last line's lowest ink inside the row.
describe("a wall row", () => {
  const { badgeTop } = STATS_LAYOUT.wall;
  const { lineHeight, lines, y } = STATS_LAYOUT.wallText;
  it.each(Array.from({ length: lines }, (_, i) => [i + 1] as const))(
    "holds the badge and %i lines of text",
    (count) => {
      const height = wallRowHeight(count);
      const lowest = y + (count - 1) * lineHeight + inkRowsFromCapTop(BODY) * TEXT_SCALE;
      expect(lowest).toBeLessThan(height);
      expect(2 * badgeTop + BADGE_STRIP.badgeSize).toBeLessThanOrEqual(height);
    },
  );
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

// The Walks tab's rows with the widest figures: four-digit counts and dollars, three-digit
// firings by the owner with the widest name, and the best walk's first dog as every dog. The
// best walk's later dogs have no label, so the first dog's row covers them.
const save = veteranSave();
const widest = (texts: readonly string[]) =>
  texts.reduce((a, b) =>
    inkWidth("font-body", STYLE, b) > inkWidth("font-body", STYLE, a) ? b : a,
  );
const ownerName = widest(Object.values(gameData.dogs).map(({ owner }) => owner.name));
const walksRows = Object.values(overallRows(gameData, save.stats))
  .flat()
  .filter(({ label }) => label !== "")
  .flatMap(({ label, value }) => {
    if (label === words.overall.timesFired) {
      return [
        {
          label,
          value: fillLine(MENU_TEXT_FIELDS.stats, words, "timesFiredBy", {
            count: "999",
            owner: ownerName,
          }),
        },
      ];
    }
    if (label === words.overall.bestRunDogs) {
      return Object.values(gameData.dogs).map(({ name }) => ({ label, value: name }));
    }
    return [{ label, value: value.startsWith("$") ? "$9,999" : "9999" }];
  });
// The badge wall's rows with every badge locked and showing the veteran save's progress.
const bodyInk = (line: string) => inkWidth("font-body", STYLE, line);
const wallCells = BADGES.map((badge) =>
  wallCell(wallText, bodyInk, badge, badgeProgress(gameData, save, badge)),
);
const wallRows = wallRects(
  wall,
  wallCells.map((cell) => wallRowHeight(wallCellLineCount(cell))),
);
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

// Each tab as long as it gets, with every dog owned and a best walk with the fullest pack:
// scrolled to its end, its last row's ink is in the view; the Walks tab fits without
// scrolling.
describe("each tab's scroll", () => {
  const dogIds = Object.keys(gameData.dogs) as DogId[];
  const dogCount = dogIds.length;
  const lastRow = wallRows.at(-1) ?? wall;
  const lastCell = wallCells.at(-1);
  const lastLines = lastCell === undefined ? 1 : wallCellLineCount(lastCell);
  const fullPack = dogIds.slice(0, read(gameData.tuning, "counts", "packSizeMax"));
  const bestWalk = { dogs: fullPack, earnedCents: cents(999_900), zonesFinished: 4 };
  const { outcomes, overall } = overallRows(gameData, { ...save.stats, bestWalk });
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
    [
      "Badges",
      badgesBottom(wallRows),
      inkBottom(lastRow.y + wallText.y + (lastLines - 1) * wallText.lineHeight),
      true,
    ],
  ])("%s: brings its last row into view", (_, bottom, lastInk, scrolls) => {
    const max = scrollMax(view, bottom);
    expect(max > 0).toBe(scrolls);
    expect(lastInk - max).toBeLessThanOrEqual(view.y + view.height);
    expect(bottom - max).toBeLessThanOrEqual(view.y + view.height);
  });
});
