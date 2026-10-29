import type { ScreenLayout } from "../layout/screenLayout";
import type { Point, Rect } from "../lib/rect";
import { type FontMetrics, inkRowsOfLines } from "../ui/fontMetrics";
import { textOnLines } from "../ui/textFit";
import { OWNER_TAB } from "./walkHud";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another. The
// message strip (messageStrip.ts) runs across the top of the backdrop band under the walk bar,
// and carries hints, badges and the walk's events. A money change pops where it changed hands,
// a tip's by the cash, and flies to the cash (moneyLabels.ts), in no lane. The lanes:
// - ownerTabs: the row the owners' photo tabs pop into, over the road's last rows and the cards'
//   tops. A heart change's number keeps above it.
// - heartLabels: a heart change, by slot, on the card's bottom rows. A label on two lines grows
//   up the card from the lane's bottom.
export interface HudLanes {
  heartLabels: Rect[];
  ownerTabs: Rect;
}

const MARGIN = 4;
const HEART_LABEL_HEIGHT = 24;

export function hudLanes(layout: Pick<ScreenLayout, "dogRow" | "dogSlots">): HudLanes {
  const { dogRow, dogSlots } = layout;
  const cardTop = Math.min(...dogSlots.map((slot) => slot.y));
  return {
    heartLabels: dogSlots.map((slot) => ({
      height: HEART_LABEL_HEIGHT,
      width: slot.width - MARGIN,
      x: slot.x + MARGIN / 2,
      y: slot.y + slot.height - HEART_LABEL_HEIGHT - 2,
    })),
    ownerTabs: {
      height: -OWNER_TAB.y,
      width: dogRow.width,
      x: dogRow.x,
      y: cardTop + OWNER_TAB.y,
    },
  };
}

// A change label: its text on a cream chip, padX either side, at least height tall and padY
// over and under the text's ink, the ink centred in it. A heart label sits at its lane's middle.
export const CHANGE_CHIP = { height: 20, padX: 2, padY: 3 } as const;

// At 2x, wrapping onto a second line where it is wider than its room.
export const CHANGE_LABEL_STYLE = textOnLines(2);

// How wide a change label's ink may be in a lane width wide.
export function changeLabelRoom(laneWidth: number): number {
  return laneWidth - 2 * CHANGE_CHIP.padX;
}

// A change label's chip at the top-left of at, and where its ink's left edge and capitals' top
// go, for text on lines lines at scale, its ink width wide.
export function changeChipAt(
  body: FontMetrics,
  at: Point,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { height: least, padX, padY } = CHANGE_CHIP;
  const ink = inkRowsOfLines(body, text.lines) * text.scale;
  const height = Math.max(least, ink + 2 * padY);
  const chip = { height, width: text.width + 2 * padX, x: at.x, y: at.y };
  return { chip, text: { x: at.x + padX, y: at.y + Math.floor((height - ink) / 2) } };
}

// A change label's chip in the middle of lane, or, where it is taller than the lane, its bottom
// on the lane's bottom; and where its ink's left edge and capitals' top go, for text on lines
// lines at scale, its ink width wide.
export function changeChipPlace(
  body: FontMetrics,
  lane: Rect,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { height } = changeChipAt(body, lane, text).chip;
  const centred = lane.y + Math.floor((lane.height - height) / 2);
  const y = Math.min(centred, lane.y + lane.height - height);
  return changeChipAt(body, { x: lane.x, y }, text);
}
