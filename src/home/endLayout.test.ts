import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { insetRect, type Rect } from "../lib/rect";
import { defined } from "../testing/defined";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { TEXT_SCALE } from "../ui/textFit";
import {
  BADGE_STRIP,
  badgeNameTops,
  badgeStripHits,
  CELEBRATION_PANEL,
  panelBadgeStrip,
} from "./badgesView";
import {
  END_LAYOUT,
  endPanelFits,
  endPanelLayout,
  grantedQuipLines,
  quipNameX,
  type QuipRow,
  quipRowHeight,
  quipTextY,
  sideTotalAmountY,
} from "./endLayout";

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
      expect(endPanelFits(true, panel)).toBe(true);
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
  it.each(cases.flatMap((each) => [true, false].map((shown) => [...each, shown] as const)))(
    "grants second lines from the top while the panel fits: %i lines, %i rows, fired %s, badges %s",
    (lines, rows, fired, shown) => {
      const wanted = quipRows(rows, fired, [2, 2, 2]);
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
      expect(grantedQuipLines(FONTS, false, lines, quipRows(rows, fired, [2, 2, 2]))).toEqual(
        Array<number>(rows).fill(2),
      );
    },
  );

  it("keeps the badge strip's area above the button", () => {
    expect(badges.y + badges.height).toBeLessThanOrEqual(END_LAYOUT.button.y);
  });
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

  it("keeps the end screen's strip above its button", () => {
    expect(badges.y + badges.height).toBeLessThanOrEqual(END_LAYOUT.button.y);
  });
});

describe("a badge strip's tap targets", () => {
  // As many badges as fit the strip with a target at least MIN_TAP_SIZE wide each.
  const fullest = Math.floor((badges.width - BADGE_STRIP.inset * 2) / MIN_TAP_SIZE);
  const counts = Array.from({ length: fullest }, (_, i) => i + 1);
  const within = (outer: Rect, inner: Rect) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  const nameInkBottom =
    defined(badgeNameTops(BADGE_STRIP.nameLines, badges.y).at(-1)) +
    inkRowsFromCapTop(BODY) * TEXT_SCALE;

  it.each(counts)(
    "gives each of %i badges a target at least the minimum, inside the panel's frame",
    (count) => {
      const inner = insetRect(BADGE_STRIP.frame, badges);
      for (const hit of badgeStripHits(badges, count)) {
        expect(hit.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
        expect(hit.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
        expect(within(inner, hit)).toBe(true);
      }
    },
  );

  it.each(counts)("covers each of %i badges and its name, edge to edge", (count) => {
    const hits = badgeStripHits(badges, count);
    const strip = panelBadgeStrip(badges, count);
    const half = BADGE_STRIP.badgeSize / 2;
    hits.forEach((hit, i) => {
      const { centreX } = defined(strip.slots[i]);
      const badge = {
        height: BADGE_STRIP.badgeSize,
        width: BADGE_STRIP.badgeSize,
        x: centreX - half,
        y: badges.y + BADGE_STRIP.badgeTop,
      };
      expect(within(hit, badge)).toBe(true);
      if (strip.named) {
        expect(hit.y + hit.height).toBeGreaterThanOrEqual(nameInkBottom);
      }
      const next = hits[i + 1];
      if (next !== undefined) {
        expect(next.x).toBe(hit.x + hit.width);
      }
    });
  });
});
