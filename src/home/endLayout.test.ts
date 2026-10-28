import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { fillLine } from "../lib/lines";
import { defined } from "../testing/defined";
import { fontFileMetrics, inkWidth, narrowestGlyphGap } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import {
  fitsRoom,
  fittingText,
  TEXT_FIT_STYLES,
  TEXT_SCALE,
  type TextFitStyle,
  WRAPPING_TEXT_FIT_STYLES,
} from "../ui/textFit";
import {
  BADGE_STRIP,
  badgeNameTops,
  type BadgeRowNames,
  badgeRowNames,
  badgeStrip,
  CELEBRATION_PANEL,
} from "./badgesView";
import {
  breakdownLabelRoom,
  END_LAYOUT,
  endPanelFits,
  endPanelLayout,
  grantedQuipLines,
  QUIP_TEXT_ROOM,
  quipNameX,
  type QuipRow,
  quipRowHeight,
  quipTextY,
  SIDE_LABEL_ROOM,
  sideTotalAmountY,
  sideTotalLabelRoom,
} from "./endLayout";
import { signedDollarText } from "./home";
import { MENU_TEXT_FIELDS } from "./menuText";

const { badges, breakdown, panel: most, quips, side } = END_LAYOUT;
const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");

// Text as each font draws it: the title font in capitals, typographic marks made plain.
const FONTS = { body: "font-body", title: "font-title" } as const;
type Role = keyof typeof FONTS;
const shown = (role: Role, text: string) =>
  role === "title" ? plainMarks(text).toUpperCase() : plainMarks(text);
const width = (role: Role) => (style: TextFitStyle, line: string) =>
  inkWidth(FONTS[role], style, line);

// Text set in the first of styles that fits room, as fitPixelText sets it, or undefined when no
// style fits it.
function fitted(role: Role, styles: readonly TextFitStyle[], room: number, text: string) {
  const set = fittingText(styles, width(role), room, shown(role, text));
  return fitsRoom(width(role), room, set) ? set : undefined;
}

// Fees, tips and card costs always show, the other earnings only sometimes, so a breakdown
// runs from 3 lines to one per kind of earnings; a walk has one owner's row per dog, up to a
// slot each.
const EARNINGS_KINDS = Object.keys(gameData.menuText.end.earnings).length;
const BREAKDOWN_LINES = Array.from({ length: EARNINGS_KINDS - 2 }, (_, i) => i + 3);
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
      const { panel, rows: placed } = endPanelLayout(BODY, lines, quipRows(rows, fired, []));
      // The breakdown's last line's ink and the side column's total stay over the rule.
      const listInk = breakdown.top + (lines - 1) * breakdown.pitch + inkRowsFromCapTop(BODY) * 2;
      const above = Math.max(listInk, side.totalY + side.totalHeight);
      const rule = (placed[0]?.top ?? 0) - 8;
      const last = placed.at(-1);
      expect(rule).toBeGreaterThan(above);
      expect(rule - above).toBeLessThanOrEqual(8);
      expect(panel.y + panel.height).toBe((last?.top ?? 0) + (last?.height ?? 0) + 8);
      expect(endPanelFits(panel)).toBe(true);
      const two = endPanelLayout(BODY, lines, quipRows(rows, fired, [2, 2, 2])).rows;
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
  it.each(cases)(
    "grants second lines from the top while the panel fits: %i lines, %i rows, fired %s",
    (lines, rows, fired) => {
      const wanted = quipRows(rows, fired, [2, 2, 2]);
      const granted = grantedQuipLines(BODY, lines, wanted);
      const layout = (given: readonly number[]) =>
        endPanelLayout(BODY, lines, quipRows(rows, fired, given));
      expect(endPanelFits(layout(granted).panel)).toBe(true);
      // Every row granted one line could not have had two.
      granted.forEach((given, i) => {
        if (given === 1) {
          const more = granted.map((each, j) => (j === i ? 2 : each));
          expect(endPanelFits(layout(more).panel)).toBe(false);
        }
      });
      expect([...granted].sort((a, b) => b - a)).toEqual(granted);
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
    const height = quipRowHeight(BODY, row);
    const textTop = quipTextY(BODY, row, height);
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
  const nameWidth = (name: string) => inkWidth("font-body", { letterSpacing: 0, scale: 1 }, name);
  const widestName = Object.values(gameData.dogs)
    .map(({ owner }) => owner.name)
    .sort((a, b) => nameWidth(b) - nameWidth(a))
    .slice(0, 1);
  it.each(widestName.map((name) => [name] as const))(
    "sets %s under the well, inside the frame and clear of the bubble",
    (name) => {
      const width = inkWidth("font-body", { letterSpacing: 0, scale: 1 }, name);
      const left = quipNameX(width);
      expect(left).toBeGreaterThan(bubble.x + bubble.width);
      expect(left + width).toBeLessThanOrEqual(most.x + most.width - 2);
    },
  );
});

const QUIPS = Object.values(gameData.quips).flatMap((moments) => Object.values(moments).flat());
const ALL_STYLES = [...TEXT_FIT_STYLES, ...WRAPPING_TEXT_FIT_STYLES];

// The end screen closes on each owner's fired or happier line. Every quip is checked, so a
// screen that shows the others in the same bubble is covered too.
describe("an owner's closing line", () => {
  it("sets every quip inside its bubble in every row, with any count of breakdown lines", () => {
    const offenders = BREAKDOWN_LINES.flatMap((lines) =>
      QUIPS.filter((quip) => {
        const wanted = fittingText(
          WRAPPING_TEXT_FIT_STYLES,
          width("body"),
          QUIP_TEXT_ROOM,
          shown("body", quip),
        );
        // Fired rows: the tallest, so the fewest second lines.
        const count = SCREEN_CONFIG.dogSlotCount;
        const wants = Array<number>(count).fill(wanted.lines.length);
        const granted = grantedQuipLines(BODY, lines, quipRows(count, true, wants));
        return (
          !endPanelFits(endPanelLayout(BODY, lines, quipRows(count, true, granted)).panel) ||
          granted.some((given) => {
            const styles = given > 1 ? WRAPPING_TEXT_FIT_STYLES : TEXT_FIT_STYLES;
            const set = fitted("body", styles, QUIP_TEXT_ROOM, quip);
            return set === undefined || set.lines.length > given;
          })
        );
      }).map((quip) => `${lines} lines: ${quip}`),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps a pixel between every quip's glyphs at every style", () => {
    const offenders = ALL_STYLES.flatMap((style) =>
      QUIPS.filter((quip) => narrowestGlyphGap("font-body", style, plainMarks(quip)) < 1).map(
        (quip) => `${JSON.stringify(style)}: ${quip}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("moves glyphs by whole screen pixels at every style", () => {
    expect(
      ALL_STYLES.filter((style) => !Number.isInteger(style.letterSpacing * style.scale)),
    ).toEqual([]);
  });
});

describe("the end screen's text", () => {
  const words = gameData.menuText.end;

  // A fired row's line saying the owner fired you, over the closing line.
  it("sets every fired row's header inside its bubble", () => {
    const owners = Object.values(gameData.dogs).map((dog) => dog.owner.name);
    const headings = owners.map((owner) =>
      fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner }),
    );
    expect(
      headings.filter((heading) => !fitted("title", TEXT_FIT_STYLES, QUIP_TEXT_ROOM, heading)),
    ).toEqual([]);
  });

  it("sets the side column's label at 2x", () => {
    expect(fitted("body", TEXT_FIT_STYLES, SIDE_LABEL_ROOM, words.zonesWalked)?.style.scale).toBe(
      2,
    );
  });

  // Each label keeps clear of a four-figure amount, gained or lost, at 2x: the breakdown's in
  // the body font, and TOTAL in the title font beside the walk's total in the side column. The
  // wider of the two amounts leaves the least room.
  const amountWidth = (role: Role, amount: string) =>
    width(role)({ letterSpacing: 0, scale: 2 }, shown(role, amount));
  const amounts = [9_999_00, -9_999_00]
    .map((amount) => signedDollarText(amount))
    .sort((a, b) => amountWidth("body", b) - amountWidth("body", a))
    .slice(0, 1);
  const labels = [
    ...Object.values(words.earnings).map(
      (label) =>
        [
          label,
          "body",
          (amount: string) => breakdownLabelRoom(amountWidth("body", amount)),
        ] as const,
    ),
    [
      words.total,
      "title",
      (amount: string) => sideTotalLabelRoom(amountWidth("body", amount)),
    ] as const,
  ];
  it.each(
    labels.flatMap(([label, role, room]) =>
      amounts.map((amount) => [label, amount, role, room] as const),
    ),
  )("sets %s beside %s", (label, amount, role, room) => {
    expect(fitted(role, TEXT_FIT_STYLES, room(amount), label)).toBeDefined();
  });
});

describe("a badge strip's names", () => {
  const names = gameData.achievements.map(({ name }) => plainMarks(name));
  const strip = { maxNamed: BADGE_STRIP.maxNamed, width: badges.width - 8, x: badges.x + 4 };
  const counts = Array.from({ length: strip.maxNamed }, (_, i) => i + 1);
  const slotWidth = (count: number) => defined(badgeStrip(strip, count).slots[0]).width;
  const bodyWidth = width("body");
  const AT_2X = { letterSpacing: 0, scale: TEXT_SCALE };
  const fits = (count: number, set: BadgeRowNames) =>
    set.style.scale === TEXT_SCALE &&
    set.lines.every(
      (lines) =>
        lines.length <= BADGE_STRIP.nameLines &&
        lines.every((line) => bodyWidth(set.style, line) <= slotWidth(count) - 4),
    );

  // In the fullest named row, whose slots are the narrowest: a name that wraps onto 2 lines
  // there wraps onto no more in a wider slot.
  it.each(names)("sets %s at 2x on at most 2 lines in the fullest named row", (name) => {
    expect(fits(strip.maxNamed, badgeRowNames(bodyWidth, slotWidth(strip.maxNamed), [name]))).toBe(
      true,
    );
  });

  // Every name sits on the row's one style, the closer glyphs only when a name needs them.
  it.each(counts)("sets a row of %i of the widest names in one style at 2x", (count) => {
    const wide = (name: string) => bodyWidth(AT_2X, name);
    const widest = [...names].sort((a, b) => wide(b) - wide(a)).slice(0, count);
    expect(fits(count, badgeRowNames(bodyWidth, slotWidth(count), widest))).toBe(true);
  });

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
