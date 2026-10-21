import type { DogId } from "../data/types";
import type { Point, Rect } from "../layout/rect";
import type { Cents } from "../rules/units";
import type { Pack } from "../state/runState";
import type { ChangeLabel } from "./hudView";
import { DOG_CARD, OWNER_TAB, WALK_BAR } from "./walkHud";

// The in-run feedback moments RunScene hands the HUD on its events: an owner firing you, a
// zone's pay banked, and a treat grabbed.
export const FIRING_EVENT = "firing";
export const PAYOUT_EVENT = "payout";
export const TREAT_EVENT = "treat-grabbed";

// seconds is how long the firing holds the walk.
export interface FiringCue {
  dog: DogId;
  line: string;
  seconds: number;
}

// One dog's fee, with its change label's text.
export interface PayoutCue {
  amount: Cents;
  dog: DogId;
  text: string;
}

export interface TreatCue {
  dog: DogId;
  labels: ChangeLabel[];
}

export const MOMENTS = {
  // The firing moment's face, plate and line are gone this long before its stop ends, so a
  // held card opens on a clear screen.
  firingEndMarginMs: 100,
  // The one-off cue when an owner drops to lowHearts.
  lowCueMs: 1500,
  lowHearts: 1,
  // Each fee's coin leaves its card's header staggerMs after the slot before's, bowing bow
  // pixels right of the straight line, and takes flightMs to reach the bank; the amount rises
  // from the header and fades over chipMs.
  payout: { bow: 48, chipMs: 900, flightMs: 650, roof: { x: 60, y: 10 }, staggerMs: 200 },
  // The owner smiles this long over a treat grabbed.
  treat: { smileMs: 900 },
} as const;

// The walk bar's coin's centre, where coins land.
const COIN_HALF = 8;
export const TOP_BAR_POINTS = {
  bank: { x: WALK_BAR.cash.coin.x + COIN_HALF, y: WALK_BAR.cash.coin.y + COIN_HALF },
} as const;

// An 8x6 tail under a bubble, pointing down at who is speaking: its top row sits over the
// bubble's bottom rim, and tipX is the column it points from.
export interface DownTail {
  readonly height: number;
  readonly key: string;
  readonly tipX: number;
}

// The quip's own down tail, else the hint's, centred as before it had one.
export const DOWN_TAILS: readonly DownTail[] = [
  { height: 6, key: "ui-quip-tail-down", tipX: 5 },
  { height: 6, key: "ui-hint-tail", tipX: 4 },
];

// The first down tail whose art is loaded, if any.
export function downTail(exists: (key: string) => boolean): DownTail | undefined {
  return DOWN_TAILS.find(({ key }) => exists(key));
}

// The left edge of a bubble width wide centred on centreX, kept 2px inside the screen.
export function bubbleX(screenWidth: number, centreX: number, width: number): number {
  return Math.round(Math.min(Math.max(2, centreX - width / 2), screenWidth - width - 2));
}

// Fired lines' bubbles all sit on one row, over the owners' faces. One opening beside
// another keeps LINE_GAP pixels from it, and its tail starts at least LINE_TAIL_INSET in from
// its edges, past the bubble's rim.
const LINE_GAP = 2;
const LINE_TAIL_INSET = 4;

// The left edge of a fired line's bubble width wide: centred over its tail (bubbleX), else the
// nearest place just beside an open bubble, on screen, clear of every open bubble and with the
// tail on it. undefined while no such place is free, so the line waits for a bubble to close.
// tail is the tail art's left edge and width.
export function firedLineX(
  screenWidth: number,
  open: readonly Pick<Rect, "width" | "x">[],
  tail: Pick<Rect, "width" | "x">,
  width: number,
): number | undefined {
  const centred = bubbleX(screenWidth, tail.x + tail.width / 2, width);
  const beside = open.flatMap((o) => [o.x + o.width + LINE_GAP, o.x - LINE_GAP - width]);
  const fits = (x: number) =>
    x >= 2 &&
    x + width <= screenWidth - 2 &&
    tail.x >= x + LINE_TAIL_INSET &&
    tail.x + tail.width <= x + width - LINE_TAIL_INSET &&
    open.every((o) => x + width + LINE_GAP <= o.x || o.x + o.width + LINE_GAP <= x);
  return [centred, ...beside]
    .filter(fits)
    .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred))[0];
}

// How long the firing's face and plate show within a stop of seconds.
export function firingShowMs(seconds: number): number {
  return Math.max(0, seconds * 1000 - MOMENTS.firingEndMarginMs);
}

// The firing moment's parts, from the card's top-left corner: the owner's face at 2x centred on
// the owner's tab, the 64x64 pop drawn at 2x from pop, centred on the face, the plate on the
// card's body under the face, as wide as the card's name and PLATE_REACH more each side, and
// the fired line's bubble centred over line, its bottom edge on it, with the 8x6 tail's top
// row at tail.y over the bubble's rim, its tip at tail.x, LINE_CLEARANCE over the face's top.
const PLATE_REACH = 4;
const FACE_HALF = 32;
const LINE_CLEARANCE = 6;
const FACE = { x: OWNER_TAB.x + OWNER_TAB.size / 2, y: OWNER_TAB.y + OWNER_TAB.size / 2 };
export const FIRING_PARTS = {
  face: FACE,
  line: { x: FACE.x, y: FACE.y - FACE_HALF - LINE_CLEARANCE },
  plate: {
    height: 28,
    width: DOG_CARD.name.room + 2 * PLATE_REACH,
    x: DOG_CARD.name.x - DOG_CARD.name.room / 2 - PLATE_REACH,
    y: FACE.y + FACE_HALF + 2,
  },
  // "FIRED!" is centred across the plate, the top of its capitals this far down.
  plateText: { y: 9 },
  pop: { x: FACE.x - 2 * FACE_HALF, y: FACE.y - 2 * FACE_HALF },
  tail: { x: FACE.x, y: FACE.y - FACE_HALF - LINE_CLEARANCE - 1 },
} as const;

// The firing moment's parts on screen for the dog in slot.
export function firingLayout(slot: Pick<Rect, "x" | "y">): {
  face: Point;
  line: Point;
  plate: Rect;
  pop: Point;
  tail: Point;
} {
  const at = (point: Point) => ({ x: slot.x + point.x, y: slot.y + point.y });
  const { face, line, plate, pop, tail } = FIRING_PARTS;
  return {
    face: at(face),
    line: at(line),
    plate: { ...plate, ...at(plate) },
    pop: at(pop),
    tail: at(tail),
  };
}

// The x past the road edge nearer to x where a dog halfWidth wide is out of sight.
export function trotOffX(road: Pick<Rect, "width" | "x">, halfWidth: number, x: number): number {
  const right = road.x + road.width;
  return x - road.x <= right - x ? road.x - halfWidth : right + halfWidth;
}

// The walking dogs whose owners are down to their last heart, in pack order.
export function lowHeartDogs(pack: Pack): DogId[] {
  return pack.flatMap((slot) =>
    slot.status === "walking" && slot.hearts === MOMENTS.lowHearts ? [slot.dog] : [],
  );
}

// The dogs low now that were not low before: each gets the one-off cue.
export function newlyLow(before: readonly DogId[], now: readonly DogId[]): DogId[] {
  return now.filter((dog) => !before.includes(dog));
}

export interface PayoutFlight extends PayoutCue {
  landMs: number;
  slot: number;
  startMs: number;
}

// Each paid dog's coins, first slot first, leaving their card in turn. With reduced motion
// nothing flies: every amount lands at once.
export function payoutFlights(
  cues: readonly PayoutCue[],
  pack: Pack,
  still: boolean,
): PayoutFlight[] {
  const { flightMs, staggerMs } = MOMENTS.payout;
  return cues
    .map((cue) => ({ ...cue, slot: pack.findIndex((slot) => slot.dog === cue.dog) }))
    .filter((cue) => cue.slot >= 0)
    .sort((a, b) => a.slot - b.slot)
    .map((cue, order) => {
      const startMs = still ? 0 : order * staggerMs;
      return { ...cue, landMs: still ? 0 : startMs + flightMs, startMs };
    });
}

// A fee's amount on its 16px tag starts gap pixels above its card, and rises rise pixels over
// the road.
export const PAYOUT_TAG = { gap: 2, height: 16, rise: 14 } as const;

// The tag's top as it starts, for the card at slot.
export function payoutTagTop(slot: Pick<Rect, "y">): number {
  return slot.y - PAYOUT_TAG.gap - PAYOUT_TAG.height;
}

// From the payout's start until the last amount has faded at the bank.
export function payoutMs(flights: readonly PayoutFlight[]): number {
  return flights.length === 0
    ? 0
    : Math.max(...flights.map((flight) => flight.landMs)) + MOMENTS.payout.chipMs;
}

// A run that ends on a firing or a payout waits for the longest of them before the end
// screen, so the moment is seen.
export function endScreenDelayMs(moments: { firingSeconds: number; payoutMs: number }): number {
  return Math.max(0, moments.firingSeconds * 1000, moments.payoutMs);
}

// A point t of the way along the quadratic curve from from to to, pulled toward control.
export function curvePoint(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

// A thrown arc's control point, peaking about peak pixels above the higher end: a quadratic
// curve's control point sits twice as high as its apex.
export function arcControl(from: Point, to: Point, peak: number): Point {
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 2 * peak };
}

// A path's control point bowing about bow pixels right of its midpoint.
export function bowRightControl(from: Point, to: Point, bow: number): Point {
  return { x: (from.x + to.x) / 2 + 2 * bow, y: (from.y + to.y) / 2 };
}
