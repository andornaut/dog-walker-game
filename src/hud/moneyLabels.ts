import type { Point, Rect } from "../lib/rect";
import { amountText } from "../rules/causes";
import type { FontMetrics } from "../ui/fontMetrics";
import { FEEDBACK } from "./feedback";
import { changeChipAt, changeLabelRoom } from "./hudLanes";
import type { ChangeLabel } from "./hudView";
import { messagePanel } from "./messageStrip";
import { arcControl, TOP_BAR_POINTS } from "./moments";
import { WALK_BAR } from "./walkHud";

// A money change's label pops on its chip where the money changed hands, centred over that
// point with its bottom lift pixels above it, kept gutter pixels inside the screen's sides;
// each later label from the same point in one batch stacks gap pixels above the one before.
// A tip's label pops by the cash total instead (cashChipPlace), and a tip grabbed while it
// shows adds up with it (mergeTips), restarting its hold. Either holds for holdMs, as long as a
// heart's pop plays, then flies into the cash total as a heart flies into its card
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

// A tip's label chip by the cash, and where its ink's left edge and capitals' top go, for text
// on lines lines at scale, its ink width wide: centred on the cash total, under the cash well's
// ink columns and clear of the bar's other wells, its top gap rows under the cash's capitals,
// or higher for a chip that would otherwise reach the message strip.
export function cashChipPlace(
  body: FontMetrics,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { gap, gutter } = MONEY_LABEL;
  const { bank } = TOP_BAR_POINTS;
  const { height, width } = changeChipAt(body, { x: 0, y: 0 }, text).chip;
  const x = Math.max(gutter, Math.round(bank.x - width / 2));
  const stripTop = messagePanel(body, 1).y;
  const y = Math.min(WALK_BAR.cash.capsBottom + 1 + gap, stripTop - height);
  return changeChipAt(body, { x, y }, text);
}

// The tip label showing adding up next, a tip grabbed before it flies: one label for both, their
// total. Undefined when either is not a tip's label, or when a debuff zeroed one and not the
// other, or zeroed them by different debuffs, so a grey "+$0" never adds up with a paying tip.
export function mergeTips(showing: ChangeLabel, next: ChangeLabel): ChangeLabel | undefined {
  if (
    showing.target.kind !== "cash" ||
    next.target.kind !== "cash" ||
    showing.zeroedBy !== next.zeroedBy
  ) {
    return undefined;
  }
  const amount = showing.amount + next.amount;
  return {
    amount,
    gain: amount > 0,
    target: { kind: "cash" },
    text: amountText("money", amount),
    ...(showing.zeroedBy === undefined ? {} : { zeroedBy: showing.zeroedBy }),
  };
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
