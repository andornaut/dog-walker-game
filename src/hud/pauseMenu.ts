import type { Rect } from "../layout/rect";
import { type FontMetrics, inkRowsOfLines } from "../ui/fontMetrics";

// The menu's buttons, top to bottom; each one's label is menuText.pause[item].
export const PAUSE_MENU_ITEMS = ["resume", "help", "settings", "headHome"] as const;
export type PauseMenuItem = (typeof PAUSE_MENU_ITEMS)[number];

// The Home button's answers, top to bottom: the safe one first, as the primary and key 1.
export const HOME_QUESTION_ANSWERS = ["keepWalking", "headHome"] as const;

const PANEL_WIDTH = 232;
// Offsets from the panel's top-left corner, and the room under the last part.
const TITLE_Y = 16;
const BUTTON = { gap: 8, height: 40, width: 200, x: 16, y: 40 };
// The note plate is as wide as the buttons.
export const PAUSE_NOTE_WIDTH = BUTTON.width;
// The note is body text at scale, wrapped to the plate's width less padX each side, its first
// line's capitals pad under the plate's top, a line of the body font apart, and the last line's
// lowest ink pad over its bottom.
export const NOTE_PLATE = { gap: 4, pad: 4, padX: 4, scale: 2 } as const;

// The pause menu's own note wraps onto this many lines.
export const PAUSE_NOTE_LINES = 3;

function notePlateHeight(body: FontMetrics, lines: number): number {
  const { pad, scale } = NOTE_PLATE;
  return pad + inkRowsOfLines(body, lines) * scale + pad;
}
const BOTTOM = 14;
// Each button's hit area reaches this far above and below its face.
const HIT_REACH = 2;

export interface PauseMenuLayout {
  buttons: Rect[];
  hits: Rect[];
  notePlate: Rect;
  panel: Rect;
  titleY: number;
}

// The panel centred in area, the dimmed band and road, sized to its parts: the title, then the
// buttons stacked down it with the note plate under them, or the note plate first when it is
// the question.
function panelLayout(
  body: FontMetrics,
  area: Rect,
  parts: { buttonCount: number; noteLines: number },
  noteFirst: boolean,
): PauseMenuLayout {
  const { buttonCount } = parts;
  const noteHeight = notePlateHeight(body, parts.noteLines);
  const buttonsHeight = buttonCount * (BUTTON.height + BUTTON.gap) - BUTTON.gap;
  // Offsets down the panel: a note first sits where the buttons would start, less its gap.
  const noteFirstY = BUTTON.y - NOTE_PLATE.gap;
  const buttonsY = noteFirst ? noteFirstY + noteHeight + BUTTON.gap : BUTTON.y;
  const noteY = noteFirst ? noteFirstY : BUTTON.y + buttonsHeight + NOTE_PLATE.gap;
  const height = Math.max(buttonsY + buttonsHeight, noteY + noteHeight) + BOTTOM;
  const panel: Rect = {
    height,
    width: PANEL_WIDTH,
    x: Math.round(area.x + (area.width - PANEL_WIDTH) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
  };
  const buttons = Array.from({ length: buttonCount }, (_, i) => ({
    height: BUTTON.height,
    width: BUTTON.width,
    x: panel.x + BUTTON.x,
    y: panel.y + buttonsY + i * (BUTTON.height + BUTTON.gap),
  }));
  return {
    buttons,
    hits: buttons.map((button) => ({
      ...button,
      height: button.height + 2 * HIT_REACH,
      y: button.y - HIT_REACH,
    })),
    notePlate: {
      height: noteHeight,
      width: BUTTON.width,
      x: panel.x + BUTTON.x,
      y: panel.y + noteY,
    },
    panel,
    titleY: panel.y + TITLE_Y,
  };
}

// The pause menu: its buttons, then the note plate, its note noteLines lines long.
export function pauseMenuLayout(
  body: FontMetrics,
  area: Rect,
  parts: { buttonCount: number; noteLines: number },
): PauseMenuLayout {
  return panelLayout(body, area, parts, false);
}

// The capitals' top of each part of a note drawn in parts down its plate, one under another,
// each part lineCounts[i] lines long.
export function notePartTops(
  body: FontMetrics,
  plate: Rect,
  lineCounts: readonly number[],
): number[] {
  let lines = 0;
  return lineCounts.map((count) => {
    const top = plate.y + NOTE_PLATE.pad + lines * body.lineHeight * NOTE_PLATE.scale;
    lines += count;
    return top;
  });
}

// The Home button's question: the title, the note plate saying what going home keeps and gives
// up, then the answers.
export function homeQuestionLayout(
  body: FontMetrics,
  area: Rect,
  parts: { buttonCount: number; noteLines: number },
): PauseMenuLayout {
  return panelLayout(body, area, parts, true);
}
