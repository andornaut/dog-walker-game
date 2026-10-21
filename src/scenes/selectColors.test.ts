import { describe, expect, it } from "vitest";

import { greyFor } from "../assets/greyRamp";
import { gameData } from "../data";
import {
  BUTTON_COLORS,
  DISABLED_COLORS,
  GREYED,
  PLATE_LOOKS,
  type PlateKind,
  selectLook,
} from "../home/selection";
import { DEBUFF_COLORS, DEBUFF_FALLBACK } from "./debuffColors";
import { NEUTRAL_RAMP, PALETTE } from "./palette";

// WCAG relative luminance and contrast ratio.
function luminance(color: number): number {
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const channel = ((color >> shift) & 0xff) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

// Text that says what an item is or costs holds 4.5:1. A disabled label is exempt and holds
// the 3:1 an icon needs.
const TEXT = 4.5;
const EXEMPT = 3;
const disabled = selectLook("disabled");
const normal = selectLook("normal");
const selected = selectLook("selected");

describe("interaction-state colours", () => {
  // [what, foreground, background, minimum].
  it.each<[string, number, number, number]>([
    ["a normal tile's label", PALETTE[normal.text], PALETTE[normal.face], TEXT],
    ["a selected tile's label", PALETTE[selected.text], PALETTE[selected.face], TEXT],
    ["a disabled tile's label", PALETTE[disabled.text], PALETTE[disabled.face], EXEMPT],
    ...(Object.keys(PLATE_LOOKS) as PlateKind[]).map((kind): [string, number, number, number] => [
      `a ${kind} plate's text`,
      PALETTE[PLATE_LOOKS[kind].text],
      PALETTE[PLATE_LOOKS[kind].face],
      TEXT,
    ]),
    [
      "a disabled picture's ink outline on its box",
      greyFor(NEUTRAL_RAMP, GREYED.copyDarker, PALETTE.ink),
      PALETTE[disabled.box],
      EXEMPT,
    ],
    [
      "a locked picture's silhouette on a normal box",
      PALETTE[GREYED.silhouette],
      PALETTE[normal.box],
      EXEMPT,
    ],
    [
      "a locked picture's silhouette on a disabled box",
      PALETTE[GREYED.silhouette],
      PALETTE[disabled.box],
      EXEMPT,
    ],
    ...(["normal", "primary", "secondary"] as const).map(
      (state): [string, number, number, number] => [
        `a ${state} button's label`,
        PALETTE[BUTTON_COLORS[state].label],
        PALETTE[BUTTON_COLORS[state].face],
        TEXT,
      ],
    ),
    [
      "a disabled button's label",
      PALETTE[BUTTON_COLORS.disabled.label],
      PALETTE[BUTTON_COLORS.disabled.face],
      EXEMPT,
    ],
    ["a muted volume row's label on the panel", PALETTE[DISABLED_COLORS.text], PALETTE.cream, TEXT],
    [
      "a disabled card's effect",
      PALETTE[DISABLED_COLORS.text],
      greyFor(NEUTRAL_RAMP, 0, PALETTE.cream),
      TEXT,
    ],
    ["a card's cost on its plaque", PALETTE.plum, PALETTE.cream, TEXT],
    [
      "a disabled card's cost on its plaque",
      PALETTE[GREYED.plateText],
      greyFor(NEUTRAL_RAMP, 0, PALETTE.cream),
      TEXT,
    ],
  ])("hold %s at its minimum", (_, foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});

describe("debuff bar colours", () => {
  it.each(Object.keys(gameData.debuffs))("give %s its own colours", (debuff) => {
    expect(DEBUFF_COLORS[debuff]).toBeDefined();
  });

  it.each(Object.entries({ ...DEBUFF_COLORS, fallback: DEBUFF_FALLBACK }))(
    "hold the %s bar's name at 4.5:1 on its face",
    (_, { face, name }) => {
      expect(contrast(name, face)).toBeGreaterThanOrEqual(TEXT);
    },
  );
});
