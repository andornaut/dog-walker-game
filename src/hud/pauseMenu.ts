import type { Rect } from "@andornaut/game-kit/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";

import { MODAL, modalPanelWidth, modalRect, modalTitleWidth } from "../home/modalLayout";
import { BUTTON_SIZE } from "../ui/buttonGeometry";

// The menu's buttons, top to bottom; each one's label is menuText.pause[item].
export const PAUSE_MENU_ITEMS = ["resume", "help", "settings", "headHome"] as const;
export type PauseMenuItem = (typeof PAUSE_MENU_ITEMS)[number];

// The Home question's answers, top to bottom: the safe one first, as the primary and key 1.
export const HOME_QUESTION_ANSWERS = ["keepWalking", "headHome"] as const;

// The Quit question's answers, top to bottom, as the Home question's: the safe one first.
export const QUIT_QUESTION_ANSWERS = ["keepPlaying", "quit"] as const;

// Offsets from the panel's top-left corner, and the room under the last part.
const TITLE_Y = MODAL.pad;
const BUTTON = { ...BUTTON_SIZE.wide, gap: MODAL.rowGap, x: MODAL.pad, y: MODAL.header };

// The width a button's label has, its key number included, 4px in from each side. The panel's
// title is placed beside its close control, as on every modal card (addCardTitle).
export const PANEL_TEXT_ROOM = {
  label: BUTTON.width - 8,
} as const;
// The note plate is as wide as the buttons, gap under the last one. The note is body text at
// scale, wrapped to the plate's width less padX each side, its first line's capitals padTop
// under the plate's top, a line of the body font apart, and the last line's lowest ink
// padBottom over its bottom.
export const PAUSE_NOTE_WIDTH = BUTTON.width;
export const NOTE_PLATE = {
  gap: MODAL.gap,
  padBottom: MODAL.rowGap,
  padTop: MODAL.rowGap,
  padX: MODAL.rowGap,
  scale: 2,
} as const;

// The pause menu's own note, a sentence a line, takes this many lines.
export const PAUSE_NOTE_LINES = 2;

function notePlateHeight(body: FontMetrics, lines: number): number {
  const { padBottom, padTop, scale } = NOTE_PLATE;
  return padTop + inkRowsOfLines(body, lines) * scale + padBottom;
}
const BOTTOM = MODAL.pad;
// Each button's hit area reaches this far above and below its face.
const HIT_REACH = 0;

export interface QuestionParts {
  avoid?: Rect | undefined;
  buttonCount: number;
  buttonWidths?: readonly number[];
  noteLines: number;
  noteWidth?: number;
  titleWidth?: number;
}

interface PauseMenuLayout {
  buttons: Rect[];
  hits: Rect[];
  notePlate: Rect;
  panel: Rect;
  titleY: number;
}

// The panel centred in area, the dimmed band and road, sized to its parts: the title, then the
// buttons stacked down it with the note plate under them, or the note plate first when it is
// the question. With no note lines there is no plate, and the buttons follow the title.
function panelLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
  noteFirst: boolean,
): PauseMenuLayout {
  const { buttonCount } = parts;
  const noted = parts.noteLines > 0;
  const noteHeight = noted ? notePlateHeight(body, parts.noteLines) : 0;
  const buttonsHeight = buttonCount * (BUTTON.height + BUTTON.gap) - BUTTON.gap;
  // Offsets down the panel: a note first sits where the buttons would start, less its gap.
  const noteFirstY = BUTTON.y;
  const buttonsY = noteFirst && noted ? noteFirstY + noteHeight + MODAL.gap : BUTTON.y;
  const noteY = noteFirst ? noteFirstY : BUTTON.y + buttonsHeight + NOTE_PLATE.gap;
  const height = Math.max(buttonsY + buttonsHeight, noted ? noteY + noteHeight : 0) + BOTTOM;
  const widths = Array.from(
    { length: buttonCount },
    (_, i) => parts.buttonWidths?.[i] ?? BUTTON.width,
  );
  const actionWidth = Math.max(0, ...widths);
  const width = modalPanelWidth(
    area.width - 2 * MODAL.margin,
    Math.max(
      actionWidth + 2 * MODAL.pad,
      modalTitleWidth(parts.titleWidth ?? 0),
      (parts.noteWidth ?? 0) + 2 * NOTE_PLATE.padX + 2 * MODAL.pad,
    ),
  );
  const panel = modalRect(area, parts.avoid, { height, width });
  const buttons = widths.map((_, i) => ({
    height: BUTTON.height,
    width: actionWidth,
    x: panel.x + (panel.width - actionWidth) / 2,
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
      width: panel.width - 2 * MODAL.pad,
      x: panel.x + MODAL.pad,
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
  parts: QuestionParts,
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
    const top = plate.y + NOTE_PLATE.padTop + lines * body.lineHeight * NOTE_PLATE.scale;
    lines += count;
    return top;
  });
}

// The Home question: the title, the note plate saying what going home keeps and gives
// up, then the answers.
export function homeQuestionLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
): PauseMenuLayout {
  return panelLayout(body, area, parts, true);
}
