import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { fillLine } from "../lib/lines";
import { insetRect, type Rect, rectsOverlap } from "../lib/rect";
import { cents } from "../lib/units";
import { defined } from "../testing/defined";
import { fontFileMetrics, fontInkRows, inkWidth, placedInk } from "../testing/fontInk";
import { decodePng } from "../testing/png";
import { inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import { fittingText, TEXT_SCALE, TEXT_STYLE, textOnLines } from "../ui/textFit";
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
  QUIP_LINES,
  QUIP_TEXT_ROOM,
  quipBubbleHeight,
  quipCapsTop,
  quipInkTop,
  quipNameX,
  type QuipRow,
  quipRowHeight,
  quipTextY,
  sideTotalAmountY,
  sideTotalBand,
} from "./endLayout";
import { endTargetAt } from "./endView";
import { signedShortDollarText } from "./home";
import { MENU_TEXT_FIELDS } from "./menuText";

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

// TOTAL's band, round TOTAL and a walk's total: nothing, a short and a long one, a loss and the
// short form from a thousand dollars.
describe("the side column's total band", () => {
  const { band } = side;
  const amountY = sideTotalAmountY(BODY, TITLE);
  const amounts = [0, 400, 14_800, -1500, 123_400].map((amount) =>
    signedShortDollarText(cents(amount)),
  );
  const label = gameData.menuText.end.total;
  const labelInk = placedInk("font-title", TEXT_STYLE, label);
  // The band round a total whose ink ends at the side column's right.
  const placed = () => sideTotalBand(BODY, TITLE, side.right);

  it("pads TOTAL's ink and the total's by padX columns either side", () => {
    const { fill } = placed();
    expect(side.x + labelInk.left - fill.x).toBe(band.padX);
    expect(fill.x + fill.width - side.right).toBe(band.padX);
  });

  // The row's ink, TOTAL's and the amount's, from its highest row to its lowest.
  const rowInk = (amount: string) => {
    const title = fontInkRows("font-title", TEXT_STYLE, label);
    const body = fontInkRows("font-body", TEXT_STYLE, amount);
    return {
      bottom: Math.max(side.totalY + title.bottom, amountY + body.bottom),
      top: Math.min(side.totalY + title.top, amountY + body.top),
    };
  };

  it.each(amounts)("holds the row's ink with %s at least padY rows inside the fill", (amount) => {
    const { fill } = placed();
    const ink = rowInk(amount);
    expect(ink.top - fill.y).toBeGreaterThanOrEqual(band.padY);
    expect(fill.y + fill.height - ink.bottom).toBeGreaterThanOrEqual(band.padY);
  });

  // Over the $ every total starts with, and under the row's lowest ink, descenders included.
  it("pads the row's highest ink and its fonts' lowest by exactly padY rows", () => {
    const { fill } = placed();
    expect(Math.min(...amounts.map((amount) => rowInk(amount).top)) - fill.y).toBe(band.padY);
    expect(fill.y + fill.height - (side.totalY + side.totalHeight)).toBe(band.padY);
  });

  it("draws a lip row under the fill and an outline round both", () => {
    const { fill, lip, outline } = placed();
    expect(lip).toEqual({ ...fill, height: 1, y: fill.y + fill.height });
    expect(outline).toEqual({
      height: fill.height + lip.height + 2,
      width: fill.width + 2,
      x: fill.x - 1,
      y: fill.y - 1,
    });
  });

  it("keeps the band under the zone count's ink and inside the panel's frame", () => {
    const { outline } = placed();
    expect(outline.y).toBeGreaterThan(side.pipsY + inkRowsFromCapTop(BODY) * 2);
    expect(outline.x + outline.width).toBeLessThanOrEqual(most.x + most.width - 2);
  });

  // The rule over the owners' rows sits at least 2 clear rows under the band at every count of
  // breakdown lines.
  it.each(BREAKDOWN_LINES)(
    "ends the band 2 rows over the rule under %i breakdown lines",
    (lines) => {
      const { outline } = placed();
      const { rows } = endPanelLayout(FONTS, lines, quipRows(1, false, []));
      const rule = (rows[0]?.top ?? 0) - quips.rule.above;
      expect(rule - (outline.y + outline.height)).toBeGreaterThanOrEqual(2);
    },
  );
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
  const { bubble, face, nameY, textX, well } = quips;
  const bodyInk = inkRowsFromCapTop(BODY);

  // ui-quip's cream rows down its middle column: its frame is every row above and below them.
  it("takes the bubble's frame rows from ui-quip", () => {
    const png = decodePng(readFileSync("public/art/images/ui-quip.png"));
    const column = Math.floor(png.width / 2);
    const colour = (row: number) => {
      const at = (row * png.width + column) * 4;
      return png.data.subarray(at, at + 4).join();
    };
    const cream = colour(Math.floor(png.height / 2));
    const rows = Array.from({ length: png.height }, (_, row) => colour(row) === cream);
    const frame = { bottom: png.height - 1 - rows.lastIndexOf(true), top: rows.indexOf(true) };
    expect(frame).toEqual(bubble.frame);
  });

  // Closing lines from the data, wrapped as the end screen wraps them: each kind of row's
  // widest line alone, and with its shortest after it, which takes two lines. A fired row's
  // header names the owner with the widest header.
  const width = (font: string, text: string) => inkWidth(font, TEXT_STYLE, text);
  const wrap = (text: string) =>
    fittingText(
      textOnLines(QUIP_LINES),
      (style, line) => inkWidth("font-body", style, line),
      QUIP_TEXT_ROOM,
      text,
    ).lines;
  const header = Object.values(gameData.dogs)
    .map(({ owner }) =>
      fillLine(MENU_TEXT_FIELDS.end, gameData.menuText.end, "firedYou", { owner: owner.name }),
    )
    .sort((a, b) => width("font-title", b) - width("font-title", a))[0];
  const rows = (["happier", "fired"] as const).flatMap((moment) => {
    const said = Object.values(gameData.quips)
      .flatMap((moments) => moments[moment])
      .sort((a, b) => width("font-body", b) - width("font-body", a));
    const widest = said[0] ?? "";
    return [widest, `${widest} ${said.at(-1) ?? ""}`].map((text) => {
      const shown = wrap(text);
      return { fired: moment === "fired", lines: shown.length, shown, text };
    });
  });

  it("covers a one-line and a two-line closing line on each kind of row", () => {
    expect(rows.map(({ fired, lines }) => ({ fired, lines }))).toEqual([
      { fired: false, lines: 1 },
      { fired: false, lines: 2 },
      { fired: true, lines: 1 },
      { fired: true, lines: 2 },
    ]);
  });

  // The block runs from the first line's highest letter ink to the closing line's lowest ink as
  // the font metrics give them, so every line in a font sits alike, and holds the text's ink.
  it.each(rows)(
    "centres $text down the bubble's cream, any odd row under it",
    ({ fired, lines, shown }) => {
      const row = { fired, lines };
      const height = quipBubbleHeight(FONTS, row);
      const textY = quipTextY(FONTS, row);
      const blockTop = quipInkTop(FONTS, row);
      const blockBottom = textY + inkRowsOfLines(BODY, lines) * TEXT_SCALE;
      const above = blockTop - bubble.frame.top;
      const below = height - bubble.frame.bottom - blockBottom;
      expect(above).toBeGreaterThanOrEqual(bubble.pad);
      expect([0, 1]).toContain(below - above);
      const first = fired
        ? fontInkRows("font-title", TEXT_STYLE, header ?? "")
        : fontInkRows("font-body", TEXT_STYLE, shown[0] ?? "");
      const last = fontInkRows("font-body", TEXT_STYLE, shown.at(-1) ?? "");
      expect(quipCapsTop(FONTS, row) + first.top).toBeGreaterThanOrEqual(blockTop);
      const lastTop = textY + (lines - 1) * BODY.lineHeight * TEXT_SCALE;
      expect(lastTop + last.bottom).toBeLessThanOrEqual(blockBottom);
    },
  );

  // A one-line happy row's bubble is the well's height; any other grows down to hold its text.
  it.each(rows)(
    "starts $text's bubble on the well's top, at least the well's height",
    ({ fired, lines }) => {
      const row = { fired, lines };
      const height = quipBubbleHeight(FONTS, row);
      expect(height).toBeGreaterThanOrEqual(well.size);
      expect(height === well.size).toBe(!fired && lines === 1);
      expect(well.y).toBe(0);
    },
  );

  it.each(rows)(
    "ends $text's row under its bubble and the name's lowest ink",
    ({ fired, lines }) => {
      const row = { fired, lines };
      expect(well.y + well.size).toBeLessThanOrEqual(nameY);
      expect(quipRowHeight(FONTS, row)).toBe(
        Math.max(quipBubbleHeight(FONTS, row), nameY + bodyInk),
      );
    },
  );

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
