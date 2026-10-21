import type { Rect } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";
import { DOGHOUSE } from "./doghouse";
import { messageStripLayout } from "./messageStrip";
import { TOP_BAR } from "./topBar";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another, the
// road or the pack, which walks just above the doghouses. The message strip (messageStrip.ts)
// runs across the top of the backdrop band, under the state strip's tab, and carries hints,
// badges and the walk's events; the lanes below it, under its tallest panel:
// - bank: a money change, under the message strip at the money well's columns, one at a
//   time. It rises from the lane's bottom to its top, never into the strip.
// - stripBubble: the state strip's descriptions, right-aligned with its top on the lane's
//   top, growing down as far as its rows need, within the band.
// - quip: an owner's line, one row over the doghouses' roofs and name plates, centred over the
//   speaker's face and kept on screen. It leaves the owners' faces uncovered.
// - heartLabels: a heart change, by slot, on the doghouse's bottom band under the faces.
export interface HudLanes {
  bank: Rect;
  heartLabels: Rect[];
  quip: Rect;
  stripBubble: Rect;
}

const MARGIN = 4;
// A bank label is 20px tall and rises 4px.
const BANK_HEIGHT = 24;
const BUBBLE_SIDE = 8;
const HEART_LABEL_HEIGHT = 24;

export function hudLanes(layout: Pick<ScreenLayout, "backdrop" | "dogRow" | "dogSlots">): HudLanes {
  const { backdrop, dogRow, dogSlots } = layout;
  // The strip at its tallest.
  const strip = messageStripLayout().panel;
  const bank = {
    height: BANK_HEIGHT,
    width: TOP_BAR.money.width,
    x: TOP_BAR.money.x,
    y: strip.y + strip.height + 2,
  };
  const bubbleTop = bank.y + bank.height + 2;
  return {
    bank,
    heartLabels: dogSlots.map((slot) => ({
      height: HEART_LABEL_HEIGHT,
      width: slot.width - MARGIN,
      x: slot.x + MARGIN / 2,
      y: slot.y + slot.height - HEART_LABEL_HEIGHT - 2,
    })),
    quip: { height: DOGHOUSE.ownerFace.y, width: dogRow.width, x: dogRow.x, y: dogRow.y },
    stripBubble: {
      height: backdrop.y + backdrop.height - MARGIN - bubbleTop,
      width: backdrop.width - BUBBLE_SIDE - MARGIN,
      x: BUBBLE_SIDE,
      y: bubbleTop,
    },
  };
}

// The x of a bubble width wide centred on centerX, kept inside lane.
export function centredInLane(lane: Rect, centerX: number, width: number): number {
  const x = Math.round(centerX - width / 2);
  return Math.max(lane.x, Math.min(lane.x + lane.width - width, x));
}
