import type { Rect } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";
import { messageStripLayout } from "./messageStrip";
import { OWNER_TAB, WALK_BAR } from "./walkHud";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another. The
// message strip (messageStrip.ts) runs across the top of the backdrop band under the walk bar,
// and carries hints, badges and the walk's events; the lanes:
// - bank: a money change, under the message strip at the cash well's columns, one at a time.
//   It rises from the lane's bottom to its top, never into the strip.
// - ownerTabs: the row the owners' photo tabs and quips pop into, over the road's last rows and
//   the cards' tops. A heart change's number keeps above it.
// - heartLabels: a heart change, by slot, on the card's bottom rows.
export interface HudLanes {
  bank: Rect;
  heartLabels: Rect[];
  ownerTabs: Rect;
}

const MARGIN = 4;
// A bank label is 20px tall and rises 4px.
const BANK_HEIGHT = 24;
const HEART_LABEL_HEIGHT = 24;

export function hudLanes(layout: Pick<ScreenLayout, "dogRow" | "dogSlots" | "topBar">): HudLanes {
  const { dogRow, dogSlots, topBar } = layout;
  // The strip at its tallest.
  const strip = messageStripLayout(topBar).panel;
  const cash = WALK_BAR.cash.well;
  const cardTop = Math.min(...dogSlots.map((slot) => slot.y));
  return {
    bank: {
      height: BANK_HEIGHT,
      width: cash.width,
      x: topBar.x + cash.x,
      y: strip.y + strip.height + 2,
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
