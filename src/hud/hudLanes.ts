import type { Rect } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";
import { DOGHOUSE } from "./doghouse";
import { TOP_BAR } from "./topBar";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another, the
// road's far end or the pack, which walks just above the doghouses:
// - bank: a money change, under the top bar's money well and as wide as it, one at a time. It
//   rises from the lane's bottom to its top, never into the top bar.
// - toast: an achievement banner, left-aligned under the bank lane, clear of the state strip
//   on the right.
// - hint: a first-time hint, centred with its bottom on the lane's bottom. One taller than the
//   lane rises into the toast's rows, so a hint and a toast take turns.
// - stripBubble: the state strip's descriptions, right-aligned with its top on the lane's
//   top, growing down as far as its rows need. It shares the hint's rows: the two never show
//   together.
// - quip: an owner's line, one row over the doghouses' roofs and name plates, centred over the
//   speaker's face and kept on screen. It leaves the owners' faces uncovered.
// - heartLabels: a heart change, by slot, on the doghouse's bottom band under the faces.
export interface HudLanes {
  bank: Rect;
  heartLabels: Rect[];
  hint: Rect;
  quip: Rect;
  stripBubble: Rect;
  toast: Rect;
}

const MARGIN = 4;
// A bank label is 20px tall and rises 4px.
const BANK_HEIGHT = 24;
const TOAST = { height: 44, width: 240 };
const HINT_SIDE = 8;
const HEART_LABEL_HEIGHT = 24;

export function hudLanes(layout: Pick<ScreenLayout, "backdrop" | "dogRow" | "dogSlots">): HudLanes {
  const { backdrop, dogRow, dogSlots } = layout;
  const bank = {
    height: BANK_HEIGHT,
    width: TOP_BAR.money.width,
    x: TOP_BAR.money.x,
    y: backdrop.y,
  };
  const toast = { ...TOAST, x: MARGIN, y: bank.y + bank.height + 2 };
  const lowTop = toast.y + toast.height + 2;
  const low = { height: backdrop.y + backdrop.height - MARGIN - lowTop, y: lowTop };
  return {
    bank,
    heartLabels: dogSlots.map((slot) => ({
      height: HEART_LABEL_HEIGHT,
      width: slot.width - MARGIN,
      x: slot.x + MARGIN / 2,
      y: slot.y + slot.height - HEART_LABEL_HEIGHT - 2,
    })),
    hint: { ...low, width: backdrop.width - 2 * HINT_SIDE, x: HINT_SIDE },
    quip: { height: DOGHOUSE.ownerFace.y, width: dogRow.width, x: dogRow.x, y: dogRow.y },
    stripBubble: { ...low, width: backdrop.width - HINT_SIDE - MARGIN, x: HINT_SIDE },
    toast,
  };
}

// The x of a bubble width wide centred on centerX, kept inside lane.
export function centredInLane(lane: Rect, centerX: number, width: number): number {
  const x = Math.round(centerX - width / 2);
  return Math.max(lane.x, Math.min(lane.x + lane.width - width, x));
}
