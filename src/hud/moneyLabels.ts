import type { Point, Rect } from "../lib/rect";
import type { FontMetrics } from "../ui/fontMetrics";
import { FEEDBACK } from "./feedback";
import { changeChipAt, changeLabelRoom } from "./hudLanes";
import { arcControl, TOP_BAR_POINTS } from "./moments";
import { WALK_BAR } from "./walkHud";

// A money change's label pops on its chip where the money changed hands, centred over that
// point with its bottom lift pixels above it, kept gutter pixels inside the screen's sides;
// each later label from the same point in one batch stacks gap pixels above the one before.
// It holds there for holdMs, as long as a heart's pop plays, then flies into the cash total as
// a heart flies into its card (FEEDBACK.heart). Its text fits the cash well's width.
export const MONEY_LABEL = {
  gap: 2,
  gutter: 2,
  holdMs: 730,
  lift: 4,
  room: changeLabelRoom(WALK_BAR.cash.well.width),
} as const;

// Each label's place in its stack: how many labels before it in the batch pop from the same
// point.
export function stackOrders(points: readonly Point[]): number[] {
  return points.map(
    (point, i) => points.slice(0, i).filter(({ x, y }) => x === point.x && y === point.y).length,
  );
}

// A money label's chip as it pops from from, order places up its stack, and where its ink's left
// edge and capitals' top go, for text on lines lines at scale, its ink width wide.
export function moneyChipPlace(
  body: FontMetrics,
  screenWidth: number,
  from: Point,
  order: number,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { gap, gutter, lift } = MONEY_LABEL;
  const { height, width } = changeChipAt(body, { x: 0, y: 0 }, text).chip;
  const centred = Math.round(from.x - width / 2);
  const x = Math.max(gutter, Math.min(screenWidth - gutter - width, centred));
  const y = Math.round(from.y) - lift - height - order * (height + gap);
  return changeChipAt(body, { x, y }, text);
}

// A money label's flight, by its chip's top-left: from where it popped, arcing as a heart's
// does, to where the chip is centred on the cash total.
export function moneyFlightPath(chip: Rect): { control: Point; from: Point; to: Point } {
  const { bank } = TOP_BAR_POINTS;
  const from = { x: chip.x, y: chip.y };
  const to = {
    x: bank.x - Math.floor(chip.width / 2),
    y: bank.y - Math.floor(chip.height / 2),
  };
  return { control: arcControl(from, to, FEEDBACK.heart.peak), from, to };
}
