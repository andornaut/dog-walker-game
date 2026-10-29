import { type Point, type Rect, rectsOverlap } from "@andornaut/game-kit/rect";

import { type Cents, cents } from "../units";
import { REACH_ICON } from "./hudLanes";

// The dodge label shows for ms: fully opaque for holdMs, so it can be read, then rising rise
// pixels and fading out over the rest.
const DODGE_LABEL = { holdMs: 600, ms: 900, rise: 10 } as const;

// The heart change, dodge and forgiven moments' timings, in ms, and offsets, in pixels.
export const FEEDBACK = {
  dodge: DODGE_LABEL,
  // The forgiven label shows, rises and fades as the dodge label does, while the forgiven heart
  // on the dog's card blinks empty and back blinks times, blinkMs a step.
  forgiven: { ...DODGE_LABEL, blinkMs: 120, blinks: 3 },
  // A heart flies into its card over flyMs, peaking peak pixels above its higher end; a
  // dog's later change in one batch starts staggerMs after the one before. The card shakes
  // by shakeDx, one step a frame of its flash.
  heart: { flyMs: 360, peak: 10, shakeDx: [1, -1, 1, 0], staggerMs: 1200 },
  // The money counter counts to a new amount at msPerDollar a dollar, taking at most maxMs.
  moneyTick: { maxMs: 600, msPerDollar: 150 },
} as const;

// What a heart pop covers on its way: its 32x32 frame, its number's chip, and the box its heart
// flies through to land at to, its card's label band's top centre (the arc peaks peak pixels
// above the frame's centre).
export function heartPopCovers(pop: { chip: Rect; frame: Point; to: Point }, peak: number): Rect[] {
  const { chip, frame, to } = pop;
  const left = Math.min(frame.x, to.x);
  const top = Math.min(frame.y, to.y, frame.y + 16 - peak);
  const right = Math.max(frame.x + 32, to.x + 1);
  const bottom = Math.max(frame.y + 32, to.y + 1);
  return [chip, { height: bottom - top, width: right - left, x: left, y: top }];
}

// Whether a heart pop covering covers would cross any rect in clearOf.
export function heartPopBlocked(clearOf: readonly Rect[], covers: readonly Rect[]): boolean {
  return covers.some((cover) => clearOf.some((rect) => rectsOverlap(cover, rect)));
}

// A label centred on centreX with the bottom of its line at lineBottom.
export interface LabelAnchor {
  centreX: number;
  lineBottom: number;
}

// The left edge of a chip width wide centred on centreX, moved in to stay on a screen
// screenWidth wide.
export function chipLeft(screenWidth: number, centreX: number, width: number): number {
  return Math.max(0, Math.min(screenWidth - width, Math.round(centreX - width / 2)));
}

// The fly tag's small heart, drawn centred on its frame frame pixels square, inks from column
// inkLeft (fx-heart-gain and fx-heart-loss alike).
export const FLY_HEART = { frame: 32, inkLeft: 9 } as const;

// A reached treat's reach icon rides beside its small heart as it flies into the card: its
// top-left for the heart's frame centred on heart, REACH_ICON.gap columns left of the heart's
// ink and vertically centred on the frame.
export function reachIconBeside(heart: Point): Point {
  const { gap, size } = REACH_ICON;
  const inkLeft = heart.x - FLY_HEART.frame / 2 + FLY_HEART.inkLeft;
  return { x: inkLeft - gap - size, y: heart.y - size / 2 };
}

// The 32x32 heart pop's top-left: its centre column on the dog's, its bottom row 4px below
// the dog's top opaque row.
export function heartPopFrame(dogTop: Point): Point {
  return { x: dogTop.x - 16, y: dogTop.y + 4 - 31 };
}

// A floating chip, or a buff's charm with its value's chip, over a dog whose heart pops in the
// same walk step stacks over the pop: its bottom POP_STACK.gap rows over the pop's top opaque
// row, inkTop rows into its frame, both centred on the dog. A pop the walk draws (clampTop
// given) moves down when the stack would rise past clampTop, the walk view's top, keeping the
// gap; the HUD's pops keep their place.
export const POP_STACK = { gap: 2 } as const;

export function stackOverPop(
  pop: { frame: Point; inkTop: number },
  height: number,
  clampTop: number | null = null,
): { bottom: number; frame: Point } {
  const bottom = pop.frame.y + pop.inkTop - POP_STACK.gap;
  const down = clampTop === null ? 0 : Math.max(0, clampTop - (bottom - height));
  return { bottom: bottom + down, frame: { x: pop.frame.x, y: pop.frame.y + down } };
}

// The heart pop's number, by the top-left of its capitals (5 rows at 1x): from the frame's
// x 31 with its capitals centred on row 16, or ending at the frame's x 1 when that would run
// off the screen; raised to end above bounds.bottom when it would reach that far down.
export function heartLabelAt(
  bounds: { bottom: number; screenWidth: number },
  frame: Point,
  width: number,
): Point {
  const right = frame.x + 31;
  const x = right + width <= bounds.screenWidth ? right : frame.x + 1 - width;
  return { x, y: Math.min(frame.y + 14, bounds.bottom - 5) };
}

// The money counter counting from one amount to another, from startMs.
export interface MoneyTick {
  readonly from: Cents;
  readonly startMs: number;
  readonly to: Cents;
}

// How long the counter takes from one amount to another.
export function tickMs(from: Cents, to: Cents): number {
  const { maxMs, msPerDollar } = FEEDBACK.moneyTick;
  return Math.min(maxMs, (msPerDollar * Math.abs(to - from)) / 100);
}

// The amount the counter shows at nowMs. While counting it shows whole dollars, so the counter
// changes only as each dollar passes; once there, the amount itself.
export function tickShown(nowMs: number, tick: MoneyTick): Cents {
  const ms = tickMs(tick.from, tick.to);
  const elapsed = nowMs - tick.startMs;
  if (ms === 0 || elapsed >= ms) {
    return tick.to;
  }
  const at = tick.from + ((tick.to - tick.from) * Math.max(0, elapsed)) / ms;
  return cents(Math.floor(at / 100) * 100);
}

// The tick toward target at nowMs: the same tick while target is where it is going, else a new
// one from what the counter shows now. Without counting (reduced motion), it is there at once.
export function retarget(
  counting: boolean,
  nowMs: number,
  target: Cents,
  tick: MoneyTick | undefined,
): MoneyTick {
  if (tick !== undefined && tick.to === target) {
    return tick;
  }
  const from = counting && tick !== undefined ? tickShown(nowMs, tick) : target;
  return { from, startMs: nowMs, to: target };
}
