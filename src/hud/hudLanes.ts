import { gameData } from "../data";
import type { ScreenLayout } from "../layout/screenLayout";
import type { Point, Rect } from "../lib/rect";
import { type FontMetrics, inkRowsOfLines } from "../ui/fontMetrics";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import { linePanels } from "./messageStrip";
import { OWNER_TAB, WALK_BAR } from "./walkHud";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another. The
// message strip (messageStrip.ts) runs across the top of the backdrop band under the walk bar,
// and carries hints, badges and the walk's events; the lanes:
// - bank: a money change, at the cash well's columns, one at a time, under the lowest the
//   message strip reaches: any line, an owner's lead included, under any count of debuff bars.
//   It rises from the lane's bottom to its top, never into the strip.
// - ownerTabs: the row the owners' photo tabs pop into, over the road's last rows and the cards'
//   tops. A heart change's number keeps above it.
// - heartLabels: a heart change, by slot, on the card's bottom rows.
export interface HudLanes {
  bank: Rect;
  heartLabels: Rect[];
  ownerTabs: Rect;
}

const MARGIN = 4;
// A bank label rises up to 4px from the lane's bottom.
const BANK_HEIGHT = 24;
const HEART_LABEL_HEIGHT = 24;
// One debuff bar per debuff, at most.
const MOST_BARS = Object.keys(gameData.debuffs).length;

export function hudLanes(
  body: FontMetrics,
  layout: Pick<ScreenLayout, "dogRow" | "dogSlots" | "topBar">,
): HudLanes {
  const { dogRow, dogSlots, topBar } = layout;
  // The strip's lowest row, in the body font.
  const panels = Array.from({ length: MOST_BARS + 1 }, (_, bars) =>
    linePanels(body, bars, topBar),
  ).flat();
  const stripBottom = Math.max(...panels.map((panel) => panel.y + panel.height));
  const cash = WALK_BAR.cash.well;
  const cardTop = Math.min(...dogSlots.map((slot) => slot.y));
  return {
    bank: {
      height: BANK_HEIGHT,
      width: cash.width,
      x: topBar.x + cash.x,
      y: stripBottom + 2,
    },
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
// over and under the text's ink, the ink centred in it. A bank label starts at its lane's
// bottom and rises to its top; a heart label sits at its lane's middle.
export const CHANGE_CHIP = { height: 20, padX: 2, padY: 3 } as const;

// At 2x, with its glyphs closer, at 1x, or at 1x on two lines.
export const CHANGE_LABEL_STYLES: readonly TextFitStyle[] = [
  ...TEXT_FIT_STYLES,
  { letterSpacing: 0, lines: 2, scale: 1 },
];

// How wide a change label's ink may be in a lane width wide.
export function changeLabelRoom(laneWidth: number): number {
  return laneWidth - 2 * CHANGE_CHIP.padX;
}

// A change label's chip in lane, and where its ink's left edge and capitals' top go, for text
// on lines lines at scale, its ink width wide.
export function changeChipPlace(
  body: FontMetrics,
  lane: Rect,
  anchor: "bottom" | "middle",
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { height: least, padX, padY } = CHANGE_CHIP;
  const ink = inkRowsOfLines(body, text.lines) * text.scale;
  const height = Math.max(least, ink + 2 * padY);
  const y =
    anchor === "bottom"
      ? lane.y + lane.height - height
      : lane.y + Math.floor((lane.height - height) / 2);
  const chip = { height, width: text.width + 2 * padX, x: lane.x, y };
  return { chip, text: { x: lane.x + padX, y: y + Math.floor((height - ink) / 2) } };
}
