import type { Point, Rect } from "../lib/rect";
import type { FontMetrics } from "../ui/fontMetrics";
import { FEEDBACK } from "./feedback";
import { CHANGE_LABEL_STYLES, changeChipAt, changeLabelRoom } from "./hudLanes";
import { arcControl, TOP_BAR_POINTS } from "./moments";
import { WALK_BAR } from "./walkHud";

// A money change's label pops on its chip where the money changed hands, centred over that
// point with its bottom lift pixels above it, kept gutter pixels inside the screen's sides;
// each later label from the same point in one batch stacks gap pixels above the one before.
// A tip's label pops by the cash total instead (cashChipPlace). Either holds for holdMs, as
// long as a heart's pop plays, then flies into the cash total as a heart flies into its card
// (FEEDBACK.heart). Its text fits the cash well's width.
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

// The slot a tip's label takes in the column under the cash, with taken the slots of the tip
// labels still showing: the one under all of them, so a later label never sits between an
// earlier one and the cash, nor crosses it on the way in; the top slot once the column is empty.
export function cashSlot(taken: readonly number[]): number {
  return taken.length === 0 ? 0 : Math.max(...taken) + 1;
}

// A tip's label chip at slot in the column under the cash, and where its ink's left edge and
// capitals' top go, for text on lines lines at scale, its ink width wide. The column is centred
// on the cash total, under the cash well's ink columns and clear of the bar's other wells; the
// top slot starts gap rows under the cash's capitals, and each slot is the tallest chip a label
// can be plus gap below the one before, so labels of any style stack without overlapping.
export function cashChipPlace(
  body: FontMetrics,
  slot: number,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { gap, gutter } = MONEY_LABEL;
  const { bank } = TOP_BAR_POINTS;
  const pitch = gap + cashSlotHeight(body);
  const { width } = changeChipAt(body, { x: 0, y: 0 }, text).chip;
  const x = Math.max(gutter, Math.round(bank.x - width / 2));
  const y = WALK_BAR.cash.capsBottom + 1 + gap + slot * pitch;
  return changeChipAt(body, { x, y }, text);
}

// The tallest chip a change label can be, in any of its styles.
export function cashSlotHeight(body: FontMetrics): number {
  const heights = CHANGE_LABEL_STYLES.map(
    ({ lines, scale }) =>
      changeChipAt(body, { x: 0, y: 0 }, { lines: lines ?? 1, scale, width: 0 }).chip.height,
  );
  return Math.max(...heights);
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
