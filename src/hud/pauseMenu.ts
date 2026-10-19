import type { Rect } from "../layout/rect";

const PANEL = { height: 260, width: 232 };
// Offsets from the panel's top-left corner.
const TITLE_Y = 16;
const BUTTON = { gap: 8, height: 40, width: 200, x: 16, y: 40 };
const NOTE_PLATE = { gap: 4, height: 18 };
// Each button's hit area reaches this far above and below its face.
const HIT_REACH = 2;

export interface PauseMenuLayout {
  buttons: Rect[];
  hits: Rect[];
  notePlate: Rect;
  panel: Rect;
  titleY: number;
}

// The panel centred on the road, its buttons stacked down it and the note plate under them.
export function pauseMenuLayout(road: Rect, buttonCount: number): PauseMenuLayout {
  const panel: Rect = {
    ...PANEL,
    x: Math.round(road.x + (road.width - PANEL.width) / 2),
    y: Math.round(road.y + (road.height - PANEL.height) / 2),
  };
  const buttons = Array.from({ length: buttonCount }, (_, i) => ({
    height: BUTTON.height,
    width: BUTTON.width,
    x: panel.x + BUTTON.x,
    y: panel.y + BUTTON.y + i * (BUTTON.height + BUTTON.gap),
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
      y:
        panel.y +
        BUTTON.y +
        buttonCount * (BUTTON.height + BUTTON.gap) -
        BUTTON.gap +
        NOTE_PLATE.gap,
    },
    panel,
    titleY: panel.y + TITLE_Y,
  };
}
