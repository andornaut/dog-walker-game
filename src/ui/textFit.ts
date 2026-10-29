import type { TextFitStyle } from "@andornaut/game-kit/text/textFit";

// Every text role has one fixed size: text never shrinks to fit its room. Text that would not
// fit wraps onto more lines, its box grows, or its words are shortened in the data.

// The scale menu and HUD text draws at, so it reads on a phone; 1x is for incidental marks only.
export const TEXT_SCALE = 2;

// Text at TEXT_SCALE on one line.
export const TEXT_STYLE: TextFitStyle = { scale: TEXT_SCALE };

// Text at TEXT_SCALE wrapping onto up to lines lines.
export function textOnLines(lines: number): TextFitStyle {
  return { lines, scale: TEXT_SCALE };
}
