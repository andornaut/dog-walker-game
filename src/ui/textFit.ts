import { wrapWords } from "@andornaut/game-kit/lines";

// Every text role has one fixed size: text never shrinks to fit its room. Text that would not
// fit wraps onto more lines, its box grows, or its words are shortened in the data.

// A role's scale and how many lines its box holds (1 when unset).
export interface TextFitStyle {
  lines?: number;
  scale: number;
}

// The scale menu and HUD text draws at, so it reads on a phone; 1x is for incidental marks only.
export const TEXT_SCALE = 2;

// Text at TEXT_SCALE on one line.
export const TEXT_STYLE: TextFitStyle = { scale: TEXT_SCALE };

// Text at TEXT_SCALE wrapping onto up to lines lines.
export function textOnLines(lines: number): TextFitStyle {
  return { lines, scale: TEXT_SCALE };
}

// Text set in a style, broken into its lines.
export interface FittedText {
  lines: string[];
  style: TextFitStyle;
}

// Whether fitted keeps to its style's lines, each line's ink no wider than room as inkWidth
// measures it.
export function fitsRoom(
  inkWidth: (style: TextFitStyle, line: string) => number,
  room: number,
  fitted: FittedText,
): boolean {
  const { lines, style } = fitted;
  return lines.length <= (style.lines ?? 1) && lines.every((line) => inkWidth(style, line) <= room);
}

// Text in style, each paragraph (split at "\n") starting a line. A style of more than one line
// breaks each paragraph at spaces into lines whose ink is no wider than room as inkWidth
// measures it, as many as it takes. Text too long for its role keeps its size and overflows,
// which fitsRoom tells.
export function fittingText(
  style: TextFitStyle,
  inkWidth: (style: TextFitStyle, line: string) => number,
  room: number,
  text: string,
): FittedText {
  const paragraphs = text.split("\n");
  const lines =
    (style.lines ?? 1) === 1
      ? paragraphs
      : paragraphs.flatMap((paragraph) =>
          wrapWords((line) => inkWidth(style, line), room, paragraph),
        );
  return { lines, style };
}
