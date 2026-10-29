import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { greyFor } from "../assets/greyRamp";
import { gameData } from "../data";
import { BADGE_TEXT_COLOURS } from "../home/badgesView";
import { END_LAYOUT } from "../home/endLayout";
import { SETTINGS_BUILD_LABEL } from "../home/settings";
import { STATS_LAYOUT } from "../home/statsLayout";
import type { EffectNameKind } from "../hud/effectNames";
import { changeLabels } from "../hud/hudView";
import type { Change } from "../rules/causes";
import { tipValue } from "../rules/run";
import { testState } from "../testing/runState";
import { NEUTRAL_RAMP, PALETTE } from "../ui/palette";
import { CREAM_PANEL_COLOURS } from "../ui/phaser/draw";
import { BUTTON_COLOURS, GREYED, pictureBox, PLATE_LOOKS, selectLook } from "../ui/selection";
import { cents } from "../units";
import { CHANGE_COLOURS, changeLabelColour } from "./changeLabelColours";
import { DEBUFF_COLOURS } from "./debuffColours";
import { EFFECT_PILLS, pillColours } from "./effectNameColours";

// The band an earned badge's row lies on, and the end screen's TOTAL row's.
const BAND = PALETTE[STATS_LAYOUT.wall.earned.fill];
const TOTAL_BAND = END_LAYOUT.side.band;

// WCAG relative luminance and contrast ratio.
function luminance(colour: number): number {
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const channel = ((colour >> shift) & 0xff) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

// Text that says what an item is or costs holds 4.5:1. A disabled label, and a locked badge's
// goal and progress, are exempt and hold the 3:1 an icon needs.
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
      ...keysOf(PLATE_LOOKS).map((kind): [string, number, number, number] => [
        `a ${kind} plate's text`,
        PALETTE[PLATE_LOOKS[kind].text],
        PALETTE[PLATE_LOOKS[kind].face],
        TEXT,
      ]),
      [
        "a grey picture's ink outline on its box",
        greyFor(NEUTRAL_RAMP, GREYED.copyDarker, PALETTE.ink),
        PALETTE[pictureBox({ art: "grey", state: "disabled" })],
        EXEMPT,
      ],
      ...(["normal", "primary", "secondary"] as const).map(
        (state): [string, number, number, number] => [
          `a ${state} button's label`,
          PALETTE[BUTTON_COLOURS[state].label],
          PALETTE[BUTTON_COLOURS[state].face],
          TEXT,
        ],
      ),
      [
        "a disabled button's label",
        PALETTE[BUTTON_COLOURS.disabled.label],
        PALETTE[BUTTON_COLOURS.disabled.face],
        EXEMPT,
      ],
      ["a muted volume row's label on the panel", PALETTE[GREYED.text], PALETTE.cream, TEXT],
      [
        "Settings' build label on the panel",
        PALETTE[SETTINGS_BUILD_LABEL.colour],
        PALETTE.cream,
        TEXT,
      ],
      [
        "a disabled card's effect",
        PALETTE[GREYED.text],
        greyFor(NEUTRAL_RAMP, 0, PALETTE.cream),
        TEXT,
      ],
      ["a card's cost on its plaque", PALETTE.plum, PALETTE.cream, TEXT],
      ...keysOf(CHANGE_COLOURS).map((kind): [string, number, number, number] => [
        `a ${kind} change label on its chip`,
        CHANGE_COLOURS[kind],
        CREAM_PANEL_COLOURS.fill,
        TEXT,
      ]),
      ["an earned badge's name on its band", PALETTE[BADGE_TEXT_COLOURS.earned.name], BAND, TEXT],
      ["an earned badge's goal on its band", PALETTE[BADGE_TEXT_COLOURS.earned.goal], BAND, TEXT],
      ["a locked badge's name", PALETTE[BADGE_TEXT_COLOURS.locked.name], PALETTE.cream, TEXT],
      ...(["amount", "label"] as const).map((text): [string, number, number, number] => [
        `the end screen's TOTAL ${text} on its band`,
        PALETTE[TOTAL_BAND.text[text]],
        PALETTE[TOTAL_BAND.fill],
        TEXT,
      ]),
      ["a locked badge's status", PALETTE[BADGE_TEXT_COLOURS.locked.status], PALETTE.cream, TEXT],
      [
        "a locked badge's goal and progress",
        PALETTE[BADGE_TEXT_COLOURS.locked.goal],
        PALETTE.cream,
        EXEMPT,
      ],
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

describe("change label colours", () => {
  const kilo = testState({ kilo: 5 });
  const stinky = testState(
    { kilo: 5 },
    { debuffs: [{ debuff: "stinky", secondsLeft: 20, untilZone: 0 }] },
  );
  const bump: Change = {
    amount: cents(-1000),
    causes: [{ amount: -1000, kind: "bump" }],
    dog: null,
    kind: "money",
  };

  // A zeroed tip's "+$0" draws in the loss colour, not a grey of its own.
  it.each([
    ["a tip", tipValue(gameData, kilo), CHANGE_COLOURS.gain],
    ["a Stinky tip", tipValue(gameData, stinky), CHANGE_COLOURS.loss],
    ["a bump's cost", bump, CHANGE_COLOURS.loss],
  ] satisfies readonly [string, Change, number][])(
    "draws %s in its colour",
    (_what, change, colour) => {
      const labels = changeLabels({ x: 0, y: 0 }, [change]);
      expect(labels.map(changeLabelColour)).toEqual([colour]);
    },
  );
});

describe("debuff bar colours", () => {
  it("set each bar's name at 4.5:1 on its face", () => {
    const faint = Object.entries(DEBUFF_COLOURS).filter(
      ([, { face, name }]) => contrast(name, face) < TEXT,
    );
    expect(faint.map(([debuff]) => debuff)).toEqual([]);
  });
});

describe("effect name pills", () => {
  const kinds = [...Object.keys(gameData.debuffs), "buff"].sort() as EffectNameKind[];

  it("give every debuff and the buffs a pill", () => {
    expect(Object.keys(EFFECT_PILLS).sort()).toEqual(kinds);
  });

  it.each(kinds)("set %s's name at 4.5:1 on its pill", (kind) => {
    const { name, pill } = pillColours(kind);
    expect(contrast(name, pill)).toBeGreaterThanOrEqual(TEXT);
  });
});
