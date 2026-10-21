import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  fittingText,
  TEXT_FIT_STYLES,
  type TextFitStyle,
  WRAPPING_TEXT_FIT_STYLES,
} from "../layout/textFit";
import { cents } from "../rules/units";
import { fontFileMetrics, inkWidth, narrowestGlyphGap } from "../testing/fontInk";
import { fillLine } from "../text/lines";
import { plainMarks } from "../ui/pixelFont";
import { badgeNameFit, badgeStrip } from "./badgesView";
import {
  breakdownLabelRoom,
  END_BADGE_NAME_LINES,
  END_LAYOUT,
  endPanelFits,
  endPanelLayout,
  grantedQuipLines,
  QUIP_TEXT_ROOM,
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

// Text set in the first of styles that fits room, as fitPixelText sets it; every line fits.
function expectFits(role: Role, styles: readonly TextFitStyle[], room: number, text: string) {
  const fitted = fittingText(styles, width(role), room, shown(role, text));
  expect(fitted.lines.length).toBeLessThanOrEqual(fitted.style.lines ?? 1);
  for (const line of fitted.lines) {
    expect(width(role)(fitted.style, line), line).toBeLessThanOrEqual(room);
  }
  return fitted;
}

// Fees, tips and card costs always show, lucky finds and the starting money only sometimes;
// a walk has one owner's row per dog, up to a slot each.
const BREAKDOWN_LINES = [3, 4, 5];
const cases = BREAKDOWN_LINES.flatMap((lines) =>
  Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) => [lines, i + 1] as const),
);

describe("endPanelLayout", () => {
  it.each(cases)("fits %i breakdown lines and %i owners' one-line rows", (lines, rows) => {
    const { panel, rows: placed } = endPanelLayout(BODY, lines, Array<number>(rows).fill(1));
    const totalBottom = breakdown.top + lines * breakdown.pitch + 8 + 10;
    const rule = (placed[0]?.top ?? 0) - 8;
    const last = placed.at(-1);
    expect(rule).toBeGreaterThan(Math.max(totalBottom, side.iconY + 16));
    expect(rule - Math.max(totalBottom, side.iconY + 16)).toBeLessThanOrEqual(8);
    expect(panel.y + panel.height).toBe((last?.top ?? 0) + (last?.height ?? 0) + 8);
    expect(endPanelFits(panel)).toBe(true);
  });

  it.each(cases)("keeps %i breakdown lines' %i rows apart, each under the last", (lines, rows) => {
    const placed = endPanelLayout(BODY, lines, Array<number>(rows).fill(2)).rows;
    placed.slice(1).forEach((row, i) => {
      const above = placed[i];
      expect(row.top).toBe((above?.top ?? 0) + (above?.height ?? 0) + quips.gap);
    });
  });
});

describe("grantedQuipLines", () => {
  it.each(cases)(
    "grants %i breakdown lines' %i rows second lines while the panel fits",
    (lines, rows) => {
      const granted = grantedQuipLines(BODY, lines, Array<number>(rows).fill(2));
      expect(endPanelFits(endPanelLayout(BODY, lines, granted).panel)).toBe(true);
      // Every row granted one line could not have had two.
      granted.forEach((given, i) => {
        if (given === 1) {
          const more = granted.map((each, j) => (j === i ? 2 : each));
          expect(endPanelFits(endPanelLayout(BODY, lines, more).panel)).toBe(false);
        }
      });
      // Rows are granted from the top.
      expect([...granted].sort((a, b) => b - a)).toEqual(granted);
    },
  );
});

const QUIPS = Object.values(gameData.quips).flatMap((moments) => Object.values(moments).flat());

// The end screen closes on each owner's fired or happier line. Every quip is checked, so a
// screen that shows the others in the same bubble is covered too.
describe("an owner's closing line", () => {
  it.each(BREAKDOWN_LINES.flatMap((lines) => QUIPS.map((quip) => [lines, quip] as const)))(
    "with %i breakdown lines, sets %j inside its bubble in every row",
    (lines, quip) => {
      const wanted = fittingText(
        WRAPPING_TEXT_FIT_STYLES,
        width("body"),
        QUIP_TEXT_ROOM,
        shown("body", quip),
      );
      const rows = Array<number>(SCREEN_CONFIG.dogSlotCount).fill(wanted.lines.length);
      const granted = grantedQuipLines(BODY, lines, rows);
      expect(endPanelFits(endPanelLayout(BODY, lines, granted).panel)).toBe(true);
      for (const given of granted) {
        const styles = given > 1 ? WRAPPING_TEXT_FIT_STYLES : TEXT_FIT_STYLES;
        expect(expectFits("body", styles, QUIP_TEXT_ROOM, quip).lines.length).toBeLessThanOrEqual(
          given,
        );
      }
    },
  );

  it.each(
    [...TEXT_FIT_STYLES, ...WRAPPING_TEXT_FIT_STYLES].flatMap((style) =>
      QUIPS.map((quip) => [style.scale, style.letterSpacing, quip, style] as const),
    ),
  )("at %ix, %f spacing, keeps a pixel between %j's glyphs", (_scale, _spacing, quip, style) => {
    expect(narrowestGlyphGap("font-body", style, plainMarks(quip))).toBeGreaterThanOrEqual(1);
  });
});

describe("TEXT_FIT_STYLES", () => {
  it.each([...TEXT_FIT_STYLES, ...WRAPPING_TEXT_FIT_STYLES])(
    "moves glyphs by whole screen pixels at %o",
    (style) => {
      expect(Number.isInteger(style.letterSpacing * style.scale)).toBe(true);
    },
  );
});

// Each owner's name, or the line saying they fired you, over their closing line.
describe("an owner's row heading", () => {
  const owners = Object.values(gameData.dogs).map((dog) => dog.owner.name);
  const words = gameData.menuText.end;
  const headings = owners.flatMap((owner) => [
    owner,
    fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner }),
  ]);

  it.each(headings)("sets %j inside its bubble", (heading) => {
    expectFits("title", TEXT_FIT_STYLES, QUIP_TEXT_ROOM, heading);
  });
});

describe("the side column", () => {
  const words = gameData.menuText.end;

  it.each([words.zonesWalked, words.bank])("sets %j inside the column", (label) => {
    expectFits("body", TEXT_FIT_STYLES, SIDE_LABEL_ROOM, label);
  });

  it("sets a six-figure bank beside the money icon", () => {
    expectFits(
      "title",
      TEXT_FIT_STYLES,
      SIDE_LABEL_ROOM - side.bankDx,
      dollarText(cents(99_999_999)),
    );
  });
});

// Each label keeps clear of a four-figure amount, gained or lost, at 2x.
describe("the breakdown", () => {
  const words = gameData.menuText.end;
  const amounts = [9_999_00, -9_999_00].map((amount) => signedDollarText(amount));
  const labels: [Role, string, Role][] = [
    ...Object.values(words.earnings).map((label): [Role, string, Role] => ["body", label, "body"]),
    ["title", words.total, "title"],
  ];

  it.each(labels.flatMap((row) => amounts.map((amount) => [...row, amount] as const)))(
    "sets the %s label %j beside %s amount %j",
    (role, label, amountRole, amount) => {
      const amountWidth = width(amountRole)(
        { letterSpacing: 0, scale: 2 },
        shown(amountRole, amount),
      );
      expectFits(role, TEXT_FIT_STYLES, breakdownLabelRoom(amountWidth), label);
    },
  );
});

describe("the end screen's badges", () => {
  const names = gameData.achievements.map(({ name }) => name);
  const strip = { maxNamed: 3, width: badges.width - 8, x: badges.x + 4 };
  const counts = Array.from({ length: strip.maxNamed }, (_, i) => i + 1);

  it.each(counts.flatMap((count) => names.map((name) => [count, name] as const)))(
    "with %i badges named, sets %j under its badge",
    (count, name) => {
      const slot = badgeStrip(strip, count).slots[0];
      if (slot === undefined) {
        throw new Error("no slot");
      }
      const fit = badgeNameFit(END_BADGE_NAME_LINES, slot);
      expectFits("body", fit.styles, fit.room, name);
    },
  );

  it("keeps the panel above the badges", () => {
    expect(most.y + most.height).toBeLessThanOrEqual(badges.y);
  });
});
