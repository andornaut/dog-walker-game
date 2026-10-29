import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { insetRect, type Rect, rectsOverlap } from "../lib/rect";
import { defined } from "../testing/defined";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { TEXT_SCALE } from "../ui/textFit";
import {
  BADGE_STRIP,
  badgeNameTops,
  badgeStripHits,
  badgeStripRows,
  CELEBRATION_PANEL,
  panelBadgeStrip,
} from "./badgesView";
import {
  END_LAYOUT,
  endBadgeRows,
  endBadgeStrip,
  endPanelFits,
  endPanelLayout,
  grantedQuipLines,
  quipNameX,
  type QuipRow,
  quipRowHeight,
  quipTextY,
  sideTotalAmountY,
} from "./endLayout";
import { endTargetAt } from "./endView";

const { badges, breakdown, panel: most, quips, side } = END_LAYOUT;
const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");
const FONTS = { body: BODY, title: TITLE };

// Fees, tips and card costs always show, the other earnings only sometimes, so a breakdown
// runs from 3 lines to one per kind of earnings but one, since the Walk bonus (a finished walk)
// and cash lost (every owner fired you) never show together; a walk has one owner's row per
// dog, up to a slot each.
const EARNINGS_KINDS = Object.keys(gameData.menuText.end.earnings).length;
const BREAKDOWN_LINES = Array.from({ length: EARNINGS_KINDS - 3 }, (_, i) => i + 3);
// Every count of breakdown lines and owners' rows, the owners all happy or all firing you.
const cases = BREAKDOWN_LINES.flatMap((lines) =>
  Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) =>
    [false, true].map((fired) => [lines, i + 1, fired] as const),
  ).flat(),
);
// The panel stacks its rows the same way at every count, so the fewest and the most rows.
const panelCases = cases.filter(([, rows]) => rows === 1 || rows === SCREEN_CONFIG.dogSlotCount);
const quipRows = (count: number, fired: boolean, lines: readonly number[]): QuipRow[] =>
  Array.from({ length: count }, (_, i) => ({ fired, lines: lines[i] ?? 1 }));
// Every count of badges a walk's strip lays out in full rows, from one.
const BADGE_COUNTS = Array.from(
  { length: BADGE_STRIP.perRow * BADGE_STRIP.maxRows },
  (_, i) => i + 1,
);

describe("the side column's total row", () => {
  const amountY = sideTotalAmountY(BODY, TITLE);

  it("ends TOTAL's capitals and the walk's total's on one row at 2x", () => {
    expect(amountY + BODY.capHeight * 2).toBe(side.totalY + TITLE.capHeight * 2);
  });

  it("ends under the lowest ink of TOTAL and the walk's total at 2x", () => {
    const lowest = Math.max(
      side.totalY + inkRowsFromCapTop(TITLE) * 2,
      amountY + inkRowsFromCapTop(BODY) * 2,
    );
    expect(side.totalY + side.totalHeight).toBe(lowest);
  });
});

describe("endPanelLayout", () => {
  it.each(panelCases)(
    "fits %i breakdown lines and %i owners' rows (fired: %s), each row under the last",
    (lines, rows, fired) => {
      const { panel, rows: placed } = endPanelLayout(FONTS, lines, quipRows(rows, fired, []));
      // The breakdown's last line's ink and the side column's total stay over the rule.
      const listInk = breakdown.top + (lines - 1) * breakdown.pitch + inkRowsFromCapTop(BODY) * 2;
      const above = Math.max(listInk, side.totalY + side.totalHeight);
      const rule = (placed[0]?.top ?? 0) - 8;
      const last = placed.at(-1);
      expect(rule).toBeGreaterThan(above);
      expect(rule - above).toBeLessThanOrEqual(8);
      expect(panel.y + panel.height).toBe((last?.top ?? 0) + (last?.height ?? 0) + 8);
      expect(endPanelFits(1, panel)).toBe(true);
      const two = endPanelLayout(FONTS, lines, quipRows(rows, fired, [2, 2, 2])).rows;
      two.slice(1).forEach((row, i) => {
        const above = two[i];
        expect(row.top).toBe((above?.top ?? 0) + (above?.height ?? 0) + quips.gap);
      });
    },
  );

  it("keeps the tallest panel above the badges", () => {
    expect(most.y + most.height).toBeLessThanOrEqual(badges.y);
  });
});

describe("grantedQuipLines", () => {
  // No badges, one row of them and two rows (or one where two leave the panel no room).
  const counts = [0, 1, BADGE_STRIP.perRow + 1];
  it.each(cases.flatMap((each) => counts.map((count) => [...each, count] as const)))(
    "grants second lines from the top while the panel fits: %i lines, %i rows, fired %s, %i badges",
    (lines, rows, fired, count) => {
      const wanted = quipRows(rows, fired, [2, 2, 2]);
      const shown = endBadgeRows(FONTS, lines, wanted, count);
      const granted = grantedQuipLines(FONTS, shown, lines, wanted);
      const layout = (given: readonly number[]) =>
        endPanelLayout(FONTS, lines, quipRows(rows, fired, given));
      expect(endPanelFits(shown, layout(granted).panel)).toBe(true);
      // Every row granted one line could not have had two.
      granted.forEach((given, i) => {
        if (given === 1) {
          const more = granted.map((each, j) => (j === i ? 2 : each));
          expect(endPanelFits(shown, layout(more).panel)).toBe(false);
        }
      });
      expect([...granted].sort((a, b) => b - a)).toEqual(granted);
    },
  );

  // With no badge to show, the panel grows into the badge strip's area, so every row gets two.
  it.each(cases)(
    "grants every row two lines with no badges: %i lines, %i rows, fired %s",
    (lines, rows, fired) => {
      expect(grantedQuipLines(FONTS, 0, lines, quipRows(rows, fired, [2, 2, 2]))).toEqual(
        Array<number>(rows).fill(2),
      );
    },
  );

  it.each([0, 1, BADGE_STRIP.maxRows])(
    "keeps the badge strip's area above the button with %i rows of badges",
    (rows) => {
      const strip = endBadgeStrip(rows);
      expect(strip.y + strip.height).toBeLessThanOrEqual(END_LAYOUT.button.y);
    },
  );
});

describe("endBadgeRows", () => {
  const { maxRows, perRow } = BADGE_STRIP;
  const counts = [1, perRow, perRow + 1, perRow * maxRows];
  it.each(cases.flatMap((each) => counts.map((count) => [...each, count] as const)))(
    "ends the panel above the strip: %i lines, %i owners' rows, fired %s, %i badges",
    (lines, rows, fired, count) => {
      const owners = quipRows(rows, fired, []);
      const { panel } = endPanelLayout(FONTS, lines, owners);
      const badgeRows = endBadgeRows(FONTS, lines, owners, count);
      expect(endPanelFits(badgeRows, panel)).toBe(true);
      // One row stands in for more only where more would not fit.
      expect(badgeRows === badgeStripRows(count) || !endPanelFits(maxRows, panel)).toBe(true);
    },
  );

  // A walk shows Start cash only when it starts with money, a dev start's while the start purse
  // is 0, so a walk's breakdown has every line but that one at most.
  const walkLines = EARNINGS_KINDS - (gameData.tuning.money.startPurse === 0 ? 2 : 1);
  it.each(panelCases.filter(([lines]) => lines <= walkLines))(
    "gives a walk's badges two rows under %i breakdown lines and %i owners' rows (fired: %s)",
    (lines, rows, fired) => {
      const owners = quipRows(rows, fired, []);
      expect(endBadgeRows(FONTS, lines, owners, perRow + 1)).toBe(maxRows);
    },
  );
});

// An owner's row, mirrored: the bubble at the left, the face's well right of the bubble's
// tail, and the owner's name under the well inside the panel's frame.
describe("an owner's row", () => {
  const { bubble, face, headerY, nameY, textX, well } = quips;
  const bodyInk = inkRowsFromCapTop(BODY);
  const titleInk = inkRowsFromCapTop(fontFileMetrics("font-title"));
  const rows = [false, true].flatMap((fired) => [1, 2].map((lines) => ({ fired, lines })));

  it.each(rows)("holds its text, its well and the name under it: %o", (row) => {
    const height = quipRowHeight(FONTS, row);
    const textTop = quipTextY(FONTS, row, height);
    const textBottom = textTop + (row.lines - 1) * BODY.lineHeight * 2 + bodyInk * 2;
    expect(textBottom + bubble.padBottom).toBeLessThanOrEqual(height);
    if (row.fired) {
      expect(textTop).toBeGreaterThan(headerY + titleInk * 2);
    } else {
      // Centred down the bubble.
      expect(Math.abs(height - textBottom - textTop)).toBeLessThanOrEqual(1);
    }
    expect(well.y + well.size).toBeLessThanOrEqual(nameY);
    expect(nameY + bodyInk).toBeLessThanOrEqual(height);
  });

  it("puts the bubble at the left and the well at the right, inside the panel's frame", () => {
    expect(bubble.x).toBeGreaterThanOrEqual(most.x + 2);
    expect(textX).toBeGreaterThan(bubble.x);
    expect(bubble.x + bubble.width).toBeLessThan(well.x);
    expect(well.x + well.size).toBeLessThanOrEqual(most.x + most.width - 2);
    expect(face.x).toBeGreaterThanOrEqual(well.x);
    expect(face.y).toBeGreaterThanOrEqual(well.y);
  });

  // The widest owner's name, centred under the well, reaches nearest the bubble and the frame.
  const nameWidth = (name: string) => inkWidth("font-body", { scale: 1 }, name);
  const widestName = Object.values(gameData.dogs)
    .map(({ owner }) => owner.name)
    .sort((a, b) => nameWidth(b) - nameWidth(a))
    .slice(0, 1);
  it.each(widestName.map((name) => [name] as const))(
    "sets %s under the well, inside the frame and clear of the bubble",
    (name) => {
      const width = inkWidth("font-body", { scale: 1 }, name);
      const left = quipNameX(width);
      expect(left).toBeGreaterThan(bubble.x + bubble.width);
      expect(left + width).toBeLessThanOrEqual(most.x + most.width - 2);
    },
  );
});

// A badge strip's names wrap at 2x onto up to its lines (every name fits them:
// ui/textRoles.test.ts).
describe("a badge strip's names", () => {
  // The title, the badges and a 2-line name each keep their ink inside the panel's 2px frame,
  // in order down the strip: the end screen's and a celebration's over the home screen.
  it.each([
    ["the end screen", badges.height],
    ["a celebration", CELEBRATION_PANEL.badgesHeight],
  ] as const)("keeps %s's strip inside its panel", (_, height) => {
    const titleInk = BADGE_STRIP.titleY + inkRowsFromCapTop(TITLE) * TEXT_SCALE;
    const badgeBottom = BADGE_STRIP.badgeTop + BADGE_STRIP.badgeSize;
    const tops = badgeNameTops(BADGE_STRIP.nameLines, 0);
    const nameInk = (tops.at(-1) ?? 0) + inkRowsFromCapTop(BODY) * TEXT_SCALE;
    expect(titleInk).toBeLessThanOrEqual(BADGE_STRIP.badgeTop);
    expect(tops[0]).toBeGreaterThan(badgeBottom);
    expect(nameInk).toBeLessThanOrEqual(height - 2);
  });

  // The last of the most rows' badges keeps inside the frame, on the end screen and a
  // celebration.
  it.each([
    ["the end screen", endBadgeStrip(BADGE_STRIP.maxRows).height],
    ["a celebration", CELEBRATION_PANEL.badgesHeight],
  ] as const)("keeps %s's last row of badges inside its panel", (_, height) => {
    const { maxRows, perRow } = BADGE_STRIP;
    const rect = { height, width: CELEBRATION_PANEL.width, x: 0, y: 0 };
    const last = defined(panelBadgeStrip(rect, maxRows, perRow * maxRows).slots.at(-1));
    expect(last.top + BADGE_STRIP.badgeSize).toBeLessThanOrEqual(height - BADGE_STRIP.frame);
  });
});

describe("a badge strip's tap targets", () => {
  const { badgeSize, frame, nameLines } = BADGE_STRIP;
  const half = badgeSize / 2;
  const within = (outer: Rect, inner: Rect) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  // The end screen's strip of count badges, in the rows they take.
  const laid = (count: number) => {
    const rows = badgeStripRows(count);
    const rect = endBadgeStrip(rows);
    const hits = badgeStripHits(rect, rows, count);
    return { hits, rect, strip: panelBadgeStrip(rect, rows, count) };
  };

  it.each(BADGE_COUNTS)(
    "gives each of %i badges a target at least the minimum, inside the panel's frame",
    (count) => {
      const { hits, rect } = laid(count);
      const inner = insetRect(frame, rect);
      for (const hit of hits) {
        expect(hit.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
        expect(hit.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
        expect(within(inner, hit)).toBe(true);
      }
    },
  );

  it.each(BADGE_COUNTS)("covers each of %i badges and its name, edge to edge", (count) => {
    const { hits, rect, strip } = laid(count);
    const nameInkBottom =
      defined(badgeNameTops(nameLines, rect.y).at(-1)) + inkRowsFromCapTop(BODY) * TEXT_SCALE;
    hits.forEach((hit, i) => {
      const { centreX, top } = defined(strip.slots[i]);
      const badge = { height: badgeSize, width: badgeSize, x: centreX - half, y: rect.y + top };
      expect(within(hit, badge)).toBe(true);
      if (strip.named) {
        expect(hit.y + hit.height).toBeGreaterThanOrEqual(nameInkBottom);
      }
      // The next target is beside it in its row, or starts the row under it.
      const next = hits[i + 1];
      if (next !== undefined) {
        expect(next.y === hit.y ? next.x : next.y).toBe(
          next.y === hit.y ? hit.x + hit.width : hit.y + hit.height,
        );
      }
      hits.slice(i + 1).forEach((other) => {
        expect(rectsOverlap(hit, other)).toBe(false);
      });
    });
  });

  it.each(BADGE_COUNTS)("centres each row of %i badges on the strip", (count) => {
    const { hits, rect } = laid(count);
    const centre = rect.x + rect.width / 2;
    for (const top of new Set(hits.map(({ y }) => y))) {
      const row = hits.filter(({ y }) => y === top);
      const left = defined(row[0]).x;
      const right = defined(row.at(-1)).x + defined(row.at(-1)).width;
      expect(Math.abs(left + right - 2 * centre)).toBeLessThanOrEqual(1);
    }
  });

  it.each(BADGE_COUNTS)("opens each of %i badges' cards from its badge", (count) => {
    const { hits, rect, strip } = laid(count);
    const screen = { badgeHits: hits, button: END_LAYOUT.button, cardOpen: false };
    strip.slots.forEach(({ centreX, top }, badge) => {
      expect(endTargetAt(screen, centreX, rect.y + top + half)).toEqual({ badge });
    });
  });
});
