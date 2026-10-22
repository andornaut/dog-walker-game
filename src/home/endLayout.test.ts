import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { fillLine } from "../lib/lines";
import { cents } from "../rules/units";
import { fontFileMetrics, inkWidth, narrowestGlyphGap } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import {
  fittingText,
  TEXT_FIT_STYLES,
  type TextFitStyle,
  WRAPPING_TEXT_FIT_STYLES,
} from "../ui/textFit";
import { badgeNameFit, badgeNameTops, badgeStrip, CELEBRATION_PANEL } from "./badgesView";
import {
  breakdownLabelRoom,
  END_BADGE_NAME_LINES,
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
} from "./endLayout";
import { dollarText, signedDollarText } from "./home";
import { MENU_TEXT_FIELDS } from "./menuText";

const { badges, breakdown, panel: most, quips, side } = END_LAYOUT;
const BODY = fontFileMetrics("font-body");

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
  const fits =
    set.lines.length <= (set.style.lines ?? 1) &&
    set.lines.every((line) => width(role)(set.style, line) <= room);
  return fits ? set : undefined;
}

// Fees, tips and card costs always show, lucky finds and the starting money only sometimes;
// a walk has one owner's row per dog, up to a slot each.
const BREAKDOWN_LINES = [3, 4, 5];
// Every count of breakdown lines and owners' rows, the owners all happy or all firing you.
const cases = BREAKDOWN_LINES.flatMap((lines) =>
  Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) =>
    [false, true].map((fired) => [lines, i + 1, fired] as const),
  ).flat(),
);
const quipRows = (count: number, fired: boolean, lines: readonly number[]): QuipRow[] =>
  Array.from({ length: count }, (_, i) => ({ fired, lines: lines[i] ?? 1 }));

describe("endPanelLayout", () => {
  it.each(cases)(
    "fits %i breakdown lines and %i owners' rows (fired: %s), each row under the last",
    (lines, rows, fired) => {
      const placed = endPanelLayout(BODY, lines, quipRows(rows, fired, [])).rows;
      const { panel } = endPanelLayout(BODY, lines, quipRows(rows, fired, []));
      const totalBottom = breakdown.top + lines * breakdown.pitch + 8 + 10;
      const rule = (placed[0]?.top ?? 0) - 8;
      const last = placed.at(-1);
      expect(rule).toBeGreaterThan(Math.max(totalBottom, side.iconY + 16));
      expect(rule - Math.max(totalBottom, side.iconY + 16)).toBeLessThanOrEqual(8);
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

  it.each(Object.values(gameData.dogs).map(({ owner }) => [owner.name] as const))(
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

  it("sets the side column's labels at 2x and a six-figure bank beside the money icon", () => {
    for (const label of [words.zonesWalked, words.bank]) {
      expect(fitted("body", TEXT_FIT_STYLES, SIDE_LABEL_ROOM, label)?.style.scale, label).toBe(2);
    }
    const bank = dollarText(cents(99_999_999));
    expect(fitted("title", TEXT_FIT_STYLES, SIDE_LABEL_ROOM - side.bankDx, bank)).toBeDefined();
  });

  // Each label keeps clear of a four-figure amount, gained or lost, at 2x.
  it("sets every breakdown label beside a four-figure amount", () => {
    const amounts = [9_999_00, -9_999_00].map((amount) => signedDollarText(amount));
    const labels: [Role, string][] = [
      ...Object.values(words.earnings).map((label): [Role, string] => ["body", label]),
      ["title", words.total],
    ];
    const offenders = labels.flatMap(([role, label]) =>
      amounts
        .filter((amount) => {
          const amountWidth = width(role)({ letterSpacing: 0, scale: 2 }, shown(role, amount));
          return !fitted(role, TEXT_FIT_STYLES, breakdownLabelRoom(amountWidth), label);
        })
        .map((amount) => `${label} beside ${amount}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("the end screen's badges", () => {
  const names = gameData.achievements.map(({ name }) => name);
  const strip = { maxNamed: 3, width: badges.width - 8, x: badges.x + 4 };
  const counts = Array.from({ length: strip.maxNamed }, (_, i) => i + 1);
  const firstSlot = (count: number) => {
    const slot = badgeStrip(strip, count).slots[0];
    if (slot === undefined) {
      throw new Error("no slot");
    }
    return slot;
  };

  it("sets every badge's name under its badge, with any count named", () => {
    const offenders = counts.flatMap((count) => {
      const fit = badgeNameFit(END_BADGE_NAME_LINES, firstSlot(count));
      return names
        .filter((name) => !fitted("body", fit.styles, fit.room, name))
        .map((name) => `${count}: ${name}`);
    });
    expect(offenders).toEqual([]);
  });

  // A strip's names, on the lines its panel gives them, keep their lowest ink inside the
  // panel's 2px frame: the end screen's strip and the celebration's over the home screen.
  it("keeps every badge's name inside the end screen's and a celebration's panel", () => {
    const panels = [
      ["the end screen", END_BADGE_NAME_LINES, badges.y, badges.height],
      ["a celebration", CELEBRATION_PANEL.nameLines, 0, CELEBRATION_PANEL.badgesHeight],
    ] as const;
    const offenders = panels.flatMap(([where, lines, top, height]) =>
      counts.flatMap((count) => {
        const fit = badgeNameFit(lines, firstSlot(count));
        return names
          .filter((name) => {
            const set = fittingText(fit.styles, width("body"), fit.room, plainMarks(name));
            const { scale } = set.style;
            const last = badgeNameTops(BODY, scale, set.lines.length, top).at(-1) ?? top;
            return last + inkRowsFromCapTop(BODY) * scale > top + height - 2;
          })
          .map((name) => `${where}, ${count}: ${name}`);
      }),
    );
    expect(offenders).toEqual([]);
  });
});
