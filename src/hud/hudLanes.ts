import type { Point, Rect } from "@andornaut/game-kit/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";

import type { ScreenLayout } from "../layout/screenLayout";
import { TEXT_STYLE } from "../ui/textFit";
import { OWNER_TAB } from "./walkHud";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another. The
// message strip (messageStrip.ts) runs across the top of the backdrop band under the walk bar,
// and carries hints, badges and the walk's events. A money change pops where it changed hands,
// a tip's by the cash, and flies to the cash (moneyLabels.ts), in no lane. The lanes:
// - ownerTabs: the row the owners' photo tabs pop into, over the road's last rows and the cards'
//   tops. A heart change's number keeps above it.
// - heartLabels: a heart change, by slot, on the card's bottom rows.
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

// At 2x on one line: a change label says its amount alone.
export const CHANGE_LABEL_STYLE = TEXT_STYLE;

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

// The text a change label's chip is placed for: on lines lines at scale, its ink width wide.
export interface ChipText {
  lines: number;
  scale: number;
  width: number;
}

// A reached pickup's change label shows the reaching buff's icon, size square, inside its chip at
// its left, vertically centred, gap columns left of its text; the chip widens by span to hold it.
const REACH_ICON_SIZE = 16;
const REACH_ICON_GAP = 2;
export const REACH_ICON = {
  gap: REACH_ICON_GAP,
  size: REACH_ICON_SIZE,
  span: REACH_ICON_SIZE + REACH_ICON_GAP,
} as const;

// A change label's chip as place puts it, and where its ink's left edge and capitals' top go,
// for text; with reached, its chip widened by REACH_ICON.span and placed as place places a chip
// that wide, the icon's top-left at its left and the text's ink past the icon. icon is null
// without reached.
export function reachChipPlace(
  place: (text: ChipText) => { chip: Rect; text: Point },
  reached: boolean,
  text: ChipText,
): { chip: Rect; icon: Point | null; text: Point } {
  if (!reached) {
    return { ...place(text), icon: null };
  }
  const { size, span } = REACH_ICON;
  const placed = place({ ...text, width: text.width + span });
  return {
    chip: placed.chip,
    icon: { x: placed.text.x, y: placed.chip.y + Math.floor((placed.chip.height - size) / 2) },
    text: { x: placed.text.x + span, y: placed.text.y },
  };
}

// A change label's chip in the middle of lane, and where its ink's left edge and capitals' top
// go, for text on lines lines at scale, its ink width wide.
export function changeChipPlace(
  body: FontMetrics,
  lane: Rect,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { height } = changeChipAt(body, lane, text).chip;
  return changeChipAt(
    body,
    { x: lane.x, y: lane.y + Math.floor((lane.height - height) / 2) },
    text,
  );
}
