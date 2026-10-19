import type { Rect } from "../layout/rect";

const PANEL_WIDTH = 232;
// Offsets from the panel's top-left corner, and the room under the last part.
const TITLE_Y = 16;
const BUTTON = { gap: 8, height: 40, width: 200, x: 16, y: 40 };
const NOTE_PLATE = { gap: 4, height: 18 };
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
function panelLayout(road: Rect, buttonCount: number, noteFirst: boolean): PauseMenuLayout {
  const buttonsHeight = buttonCount * (BUTTON.height + BUTTON.gap) - BUTTON.gap;
  // Offsets down the panel: a note first sits where the buttons would start, less its gap.
  const noteFirstY = BUTTON.y - NOTE_PLATE.gap;
  const buttonsY = noteFirst ? noteFirstY + NOTE_PLATE.height + BUTTON.gap : BUTTON.y;
  const noteY = noteFirst ? noteFirstY : BUTTON.y + buttonsHeight + NOTE_PLATE.gap;
  const height = Math.max(buttonsY + buttonsHeight, noteY + NOTE_PLATE.height) + BOTTOM;
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
      height: NOTE_PLATE.height,
      width: BUTTON.width,
      x: panel.x + BUTTON.x,
      y: panel.y + noteY,
    },
    panel,
    titleY: panel.y + TITLE_Y,
  };
}

// The pause menu: its buttons, then the note plate.
export function pauseMenuLayout(road: Rect, buttonCount: number): PauseMenuLayout {
  return panelLayout(road, buttonCount, false);
}

// The Home button's question: the title, the note plate saying what is kept, then the
// answers.
export function homeQuestionLayout(road: Rect, buttonCount: number): PauseMenuLayout {
  return panelLayout(road, buttonCount, true);
}
