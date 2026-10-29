import { SCREEN_LAYOUT } from "../data/screen";
import type { Point, Rect } from "../lib/rect";
import { type Cents, cents } from "../lib/units";
import { amountText } from "../rules/causes";
import type { FontMetrics } from "../ui/fontMetrics";
import { FEEDBACK, tickMs } from "./feedback";
import { CHANGE_LABEL_STYLE, changeChipAt, changeLabelRoom } from "./hudLanes";
import type { ChangeLabel } from "./hudView";
import { arcControl, TOP_BAR_POINTS } from "./moments";
import { WALK_BAR } from "./walkHud";

const WALK_BAR_RECT = SCREEN_LAYOUT.topBar;

// A money gain's label, a tip's included, and the cash lost with the last firing pop by the cash
// total (cashChipPlace), in the first slot of the cash's column no label showing there holds; a
// tip grabbed while a tip's label shows adds up with it (mergeTips), restarting its hold. Any
// other money loss's label pops on its chip where the money changed hands, centred over that
// point with its bottom lift pixels above it, kept gutter pixels inside the screen's sides; each
// later label from the same point in one batch stacks gap pixels above the one before. Each
// holds for holdMs, as long as a heart's pop plays, then flies into the cash total as a heart
// flies into its card (FEEDBACK.heart). Its text fits the cash well's width.
export const MONEY_LABEL = {
  gap: 2,
  gutter: 2,
  holdMs: 730,
  lift: 4,
  room: changeLabelRoom(WALK_BAR.cash.well.width),
} as const;

// How long a change label takes to fade in place.
export const LABEL_FADE_MS = 1100;

// The label for the cash a walk carried and lost by ending early, heading home or with the last
// owner firing you (walkEarnings): a loss that pops by the cash, as a gain does (cashChipPlace), and goes into it.
export function cashLostLabel(lost: Cents): ChangeLabel {
  const amount = cents(-lost);
  return {
    amount,
    gain: false,
    target: { kind: "cash", tip: false },
    text: amountText("money", amount),
  };
}

// How long the cash lost takes to show: its label's hold and flight into the cash, then the
// counter counting down by it. With reduced motion (still) the counter drops at once and the
// label fades in place.
export function cashLostMs(still: boolean, lost: Cents): number {
  return still ? LABEL_FADE_MS : MONEY_LABEL.holdMs + FEEDBACK.heart.flyMs + tickMs(cents(0), lost);
}

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

// The first slot of the cash's column that no label showing there, of taken, holds.
export function freeCashSlot(taken: ReadonlySet<number>): number {
  let slot = 0;
  while (taken.has(slot)) {
    slot++;
  }
  return slot;
}

// A money gain's label chip by the cash in slot of the cash's column, and where its ink's left
// edge and capitals' top go, for text on lines lines at scale, its ink width wide: centred under
// the cash well, hanging from the walk bar. The first slot's top is gap rows under the bar's
// bottom, over the message strip, the debuff bars and the neighbourhood pill; each later slot's
// is the tallest chip and gap rows under the slot before it, so chips of any style in
// neighbouring slots never overlap.
export function cashChipPlace(
  body: FontMetrics,
  slot: number,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { gap, gutter } = MONEY_LABEL;
  const { width } = changeChipAt(body, { x: 0, y: 0 }, text).chip;
  const { well } = WALK_BAR.cash;
  const x = Math.max(gutter, Math.round(WALK_BAR_RECT.x + well.x + (well.width - width) / 2));
  const first = WALK_BAR_RECT.y + WALK_BAR_RECT.height + gap;
  return changeChipAt(body, { x, y: first + slot * (tallestChip(body) + gap) }, text);
}

// The height of a money label's chip: its amount on one line (every amount fits one line:
// ui/textRoles.test.ts).
function tallestChip(body: FontMetrics): number {
  const { scale } = CHANGE_LABEL_STYLE;
  return changeChipAt(body, { x: 0, y: 0 }, { lines: 1, scale, width: 0 }).chip.height;
}

// The tip label showing adding up next, a tip grabbed before it flies: one label for both, their
// total, carrying the reach icon either carries, so the chip keeps it when any of its tips was
// grabbed by reach. Undefined when either is not a tip's label, so another gain never adds up
// with a tip, or when a debuff zeroed one and not the other, or zeroed them by different
// debuffs, so a zeroed "+$0" never adds up with a paying tip.
export function mergeTips(showing: ChangeLabel, next: ChangeLabel): ChangeLabel | undefined {
  if (
    showing.target.kind !== "cash" ||
    !showing.target.tip ||
    next.target.kind !== "cash" ||
    !next.target.tip ||
    showing.zeroedBy !== next.zeroedBy
  ) {
    return undefined;
  }
  const amount = showing.amount + next.amount;
  const reachIcon = showing.reachIcon ?? next.reachIcon;
  return {
    amount,
    gain: amount > 0,
    target: { kind: "cash", tip: true },
    text: amountText("money", amount),
    ...(reachIcon === undefined ? {} : { reachIcon }),
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
