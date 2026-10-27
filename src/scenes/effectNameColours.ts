import type { GameObjects } from "phaser";

import { gameData } from "../data";
import { type EffectNameKind, effectNameMarks, type NameMark } from "../hud/effectNames";
import { PALETTE } from "../ui/phaser/palette";
import { tintSpans } from "../ui/phaser/pixelText";
import type { ColourSpan } from "../ui/textSpans";

type PaletteName = keyof typeof PALETTE;

// The backgrounds an effect's name is drawn on beside its description, each with the colours it
// stands for: cream for the card face, the message strip, the detail cards and a change label's
// chip; dark for ink and the walk bar's plum.
export const NAME_BACKGROUNDS = {
  cream: ["cream"],
  dark: ["ink", "plum"],
} as const satisfies Record<string, readonly PaletteName[]>;

export type NameBackground = keyof typeof NAME_BACKGROUNDS;

// Each effect's name colour on each background, at 4.5:1 or better on every colour the
// background stands for: a debuff's darker bar shade on cream and its light shade on dark, and
// one colour for every buff. A change a debuff zeroed, as Stinky's "+$0" tip, draws in that
// debuff's colour on its cream chip.
export const EFFECT_NAME_COLOURS: Readonly<
  Record<NameBackground, Readonly<Record<EffectNameKind, PaletteName>>>
> = {
  cream: {
    buff: "dlake",
    muddy: "darkBrown",
    spotlight: "blue",
    stinky: "purple",
    zoomies: "forest",
  },
  dark: {
    buff: "turquoise",
    muddy: "tan",
    spotlight: "yellow",
    stinky: "pink",
    zoomies: "yellow",
  },
};

export function effectNameColour(background: NameBackground, kind: EffectNameKind): number {
  return PALETTE[EFFECT_NAME_COLOURS[background][kind]];
}

// The marked names as spans in their colours on background.
export function nameSpans(background: NameBackground, marks: readonly NameMark[]): ColourSpan[] {
  return marks.map(({ at, kind, length }) => ({
    at,
    colour: effectNameColour(background, kind),
    length,
  }));
}

// Draws each effect's name in labels, the text drawn in order, in its colour on background: the
// names effectNameMarks finds in the text and any the text marks itself, as a debuff's strip
// line marks its lead.
export function tintEffectNames(
  background: NameBackground,
  labels: readonly GameObjects.BitmapText[],
  text: { readonly names?: readonly NameMark[]; readonly text: string },
): void {
  const marks = [...(text.names ?? []), ...effectNameMarks(gameData, text.text)];
  tintSpans(labels, text.text, nameSpans(background, marks));
}
