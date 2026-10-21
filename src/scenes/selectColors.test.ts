import { describe, expect, it } from "vitest";

import { greyFor } from "../assets/greyRamp";
import { gameData } from "../data";
import { NEUTRAL_RAMP, PALETTE } from "../ui/phaser/palette";
import {
  BUTTON_COLORS,
  DISABLED_COLORS,
  GREYED,
  PLATE_LOOKS,
  type PlateKind,
  selectLook,
} from "../ui/selection";
import { DEBUFF_COLORS, DEBUFF_FALLBACK } from "./debuffColors";

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
  it("hold every label, plate, picture and button at its minimum contrast", () => {
    const pairs: [string, number, number, number][] = [
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
      [
        "a muted volume row's label on the panel",
        PALETTE[DISABLED_COLORS.text],
        PALETTE.cream,
        TEXT,
      ],
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
    ];
    const faint = pairs.filter(
      ([, foreground, background, minimum]) => contrast(foreground, background) < minimum,
    );
    expect(faint.map(([what]) => what)).toEqual([]);
  });
});

describe("debuff bar colours", () => {
  it("give every debuff its own colours, each bar's name at 4.5:1 on its face", () => {
    expect(Object.keys(gameData.debuffs).filter((debuff) => !DEBUFF_COLORS[debuff])).toEqual([]);
    const faint = Object.entries({ ...DEBUFF_COLORS, fallback: DEBUFF_FALLBACK }).filter(
      ([, { face, name }]) => contrast(name, face) < TEXT,
    );
    expect(faint.map(([debuff]) => debuff)).toEqual([]);
  });
});
