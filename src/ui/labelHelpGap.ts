import { type FontMetrics, inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";

// A label over its help text leaves LABEL_HELP_GAP clear rows between the lowest row the
// label's font inks, its deepest descender's, and the help text's capitals: one offset per
// font, so labels in a list line up, and a label with no descender leaves a few more.
export const LABEL_HELP_GAP = 10;

// How far the help text's capitals' top sits under its label's, in screen pixels, for a label in
// the font label at scale.
export function helpCapDy(label: FontMetrics, scale: number): number {
  return inkRowsFromCapTop(label) * scale + LABEL_HELP_GAP;
}
