import type { Rect } from "../layout/rect";

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
// The note is 2x body text wrapped to the plate's width less padX each side, its first line's
// capitals pad under the plate's top, a line every linePitch, and the last line's 10-row
// capitals and 4-row descenders pad over its bottom.
export const NOTE_PLATE = { gap: 4, linePitch: 20, pad: 4, padX: 4 } as const;

function notePlateHeight(lines: number): number {
  const { linePitch, pad } = NOTE_PLATE;
  return pad + (Math.max(1, lines) - 1) * linePitch + 14 + pad;
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

// The panel centred on the road, sized to its parts: the title, then the buttons stacked
// down it with the note plate under them, or the note plate first when it is the question.
function panelLayout(
  road: Rect,
  parts: { buttonCount: number; noteLines: number },
  noteFirst: boolean,
): PauseMenuLayout {
  const { buttonCount } = parts;
  const noteHeight = notePlateHeight(parts.noteLines);
  const buttonsHeight = buttonCount * (BUTTON.height + BUTTON.gap) - BUTTON.gap;
  // Offsets down the panel: a note first sits where the buttons would start, less its gap.
  const noteFirstY = BUTTON.y - NOTE_PLATE.gap;
  const buttonsY = noteFirst ? noteFirstY + noteHeight + BUTTON.gap : BUTTON.y;
  const noteY = noteFirst ? noteFirstY : BUTTON.y + buttonsHeight + NOTE_PLATE.gap;
  const height = Math.max(buttonsY + buttonsHeight, noteY + noteHeight) + BOTTOM;
  const panel: Rect = {
    height,
    width: PANEL_WIDTH,
    x: Math.round(road.x + (road.width - PANEL_WIDTH) / 2),
    y: Math.round(road.y + (road.height - height) / 2),
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
  road: Rect,
  parts: { buttonCount: number; noteLines: number },
): PauseMenuLayout {
  return panelLayout(road, parts, false);
}

// The Home button's question: the title, the note plate saying what is kept, then the
// answers.
export function homeQuestionLayout(
  road: Rect,
  parts: { buttonCount: number; noteLines: number },
): PauseMenuLayout {
  return panelLayout(road, parts, true);
}
