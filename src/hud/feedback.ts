import { type Point, type Rect, rectsOverlap } from "../layout/rect";
import { type Cents, cents } from "../rules/units";
import { signedText } from "../text/lines";

// The heart change, hop and minor bump moments' timings, in ms, and offsets, in pixels.
export const FEEDBACK = {
  // The bump's amount rises rise pixels and fades over labelMs; the walker tips by
  // wobbleDegrees each way, wobbleMs a swing, wobbles times.
  bump: { labelMs: 900, rise: 10, wobbleDegrees: 8, wobbleMs: 70, wobbles: 2 },
  // A heart flies into its doghouse over flyMs, peaking peak pixels above its higher end; a
  // dog's later change in one batch starts staggerMs after the one before. The doghouse shakes
  // by shakeDx, one step a frame of its flash.
  heart: { flyMs: 360, peak: 10, shakeDx: [1, -1, 1, 0], staggerMs: 1200 },
  // The hop label rises rise pixels and fades over ms.
  hop: { ms: 900, rise: 10 },
  // The money counter counts to a new amount at msPerDollar a dollar, taking at most maxMs.
  moneyTick: { maxMs: 600, msPerDollar: 150 },
} as const;

// The number on a heart change's pop: "−1", "+2".
export function heartPopText(amount: number): string {
  return signedText(amount, String(Math.abs(amount)));
}

// What a heart pop covers on its way: its 32x32 frame, its number's chip, and the box its heart
// flies through to land at to, its doghouse band's top centre (the arc peaks peak pixels
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

// The 32x32 heart pop's top-left: its centre column on the dog's, its bottom row 4px below
// the dog's top opaque row.
export function heartPopFrame(dogTop: Point): Point {
  return { x: dogTop.x - 16, y: dogTop.y + 4 - 31 };
}

// The heart pop's number, by the top-left of its capitals (5 rows at 1x): from the frame's
// x 31 with its capitals centred on row 16, or ending at the frame's x 1 when that would run
// off the screen; raised to end above top when it would reach that far down.
export function heartLabelAt(
  bounds: { bottom: number; screenWidth: number },
  frame: Point,
  width: number,
): Point {
  const right = frame.x + 31;
  const x = right + width <= bounds.screenWidth ? right : frame.x + 1 - width;
  return { x, y: Math.min(frame.y + 14, bounds.bottom - 5) };
}

// The 32x32 hop splash's top-left, its centre column on the pack's and its bottom row on the
// walker's feet, and its label centred over it, 2px above its top.
export function hopSplashLayout(pack: { feetY: number; x: number }): {
  frame: Point;
  label: LabelAnchor;
} {
  const frame = { x: pack.x - 16, y: pack.feetY - 31 };
  return { frame, label: { centreX: frame.x + 16, lineBottom: frame.y - 2 } };
}

// The hop label over a dog, centred on its centre column, 2px above its top opaque row.
export function hopLabelAnchor(dogTop: Point): LabelAnchor {
  return { centreX: dogTop.x, lineBottom: dogTop.y - 2 };
}

// The 64x48 coin burst's top-left, its (32, 28) on the contact point, and its amount
// centred on its x 32 with the line's bottom on its row 6.
export function coinBurstLayout(contact: Point): { frame: Point; label: LabelAnchor } {
  const frame = { x: contact.x - 32, y: contact.y - 28 };
  return { frame, label: { centreX: frame.x + 32, lineBottom: frame.y + 6 } };
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
