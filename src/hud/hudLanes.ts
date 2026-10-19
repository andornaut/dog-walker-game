import type { Rect } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";
import { DOGHOUSE } from "./doghouse";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another, the
// road's far end or the pack, which walks just above the doghouses:
// - toast: an achievement banner, at the top-left of the backdrop band.
// - hint: a first-time hint, centred with its bottom on the lane's bottom.
// - stripBubble: the state strip's descriptions, right-aligned with its top on the lane's
//   top, growing down as far as its rows need. It shares the hint's rows: the two never show
//   together.
// - quip: an owner's line, one row over the doghouses' roofs and name plates, centred over the
//   speaker's face and kept on screen. It leaves the owners' faces uncovered.
// - heartLabels: a heart change, by slot, on the doghouse's bottom band under the faces.
export interface HudLanes {
  heartLabels: Rect[];
  hint: Rect;
  quip: Rect;
  stripBubble: Rect;
  toast: Rect;
}

const MARGIN = 4;
const TOAST = { height: 44, width: 240 };
const HINT_SIDE = 8;
const HEART_LABEL_HEIGHT = 24;

export function hudLanes(layout: Pick<ScreenLayout, "backdrop" | "dogRow" | "dogSlots">): HudLanes {
  const { backdrop, dogRow, dogSlots } = layout;
  const toast = { ...TOAST, x: MARGIN, y: backdrop.y + 2 };
  const lowTop = toast.y + toast.height + 2;
  const low = { height: backdrop.y + backdrop.height - MARGIN - lowTop, y: lowTop };
  return {
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
