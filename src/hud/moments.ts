import type { DogId } from "../data/types";
import type { Point, Rect } from "../layout/rect";
import type { Cents } from "../rules/units";
import type { Pack } from "../state/runState";
import type { ChangeLabel } from "./hudView";

// The in-run feedback moments RunScene hands the HUD on its events: an owner firing you, a
// zone's fees paid, and a treat given.
export const FIRING_EVENT = "firing";
export const PAYOUT_EVENT = "payout";
export const TREAT_EVENT = "treat-given";

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
  // The firing moment's face and plate are gone this long before its stop ends, so a held
  // card opens on a clear screen.
  firingEndMarginMs: 100,
  // The fired line stays up at least as long as an owner's quip.
  firingLineMs: 2600,
  // The one-off cue when an owner drops to lowHearts.
  lowCueMs: 1500,
  lowHearts: 1,
  // Each fee's coin leaves its doghouse's roof staggerMs after the slot above's, bowing bow
  // pixels right of the straight line, and takes flightMs to reach the bank; the amount rises
  // from the roof and fades over chipMs.
  payout: { bow: 48, chipMs: 900, flightMs: 650, roof: { x: 60, y: 10 }, staggerMs: 200 },
  // The treat's arc peaks this many pixels above its higher end; the owner smiles on landing.
  treat: { arcMs: 420, peak: 40, smileMs: 900 },
} as const;

// The top bar's money and treat icons' centres, where coins land and treats leave from.
export const TOP_BAR_POINTS = { bank: { x: 16, y: 21 }, treats: { x: 103, y: 21 } } as const;

// The 8x6 tail under a bubble, pointing down at who is speaking.
export const DOWN_TAIL = { height: 6, key: "ui-hint-tail", width: 8 } as const;

// The left edge of a bubble width wide centred on centreX, kept 2px inside the screen.
export function bubbleX(screenWidth: number, centreX: number, width: number): number {
  return Math.round(Math.min(Math.max(2, centreX - width / 2), screenWidth - width - 2));
}

// How long the firing's face and plate show within a stop of seconds.
export function firingShowMs(seconds: number): number {
  return Math.max(0, seconds * 1000 - MOMENTS.firingEndMarginMs);
}

// The firing moment's parts, from the slot's top-left corner, rising over the road above
// the doghouse: the owner's face at 2x centred on face, the 64x64 pop drawn at 2x from pop,
// the plate on the roof, and the fired line's bubble centred over line, its bottom edge on
// it, with the 8x6 tail under it pointing down at the face from tail.
export const FIRING_PARTS = {
  face: { x: 60, y: -34 },
  line: { x: 60, y: -72 },
  plate: { height: 28, width: 72, x: 24, y: -2 },
  // "FIRED!" starts this far into the plate, the top of its capitals this far down.
  plateText: { x: 8, y: 9 },
  pop: { x: -4, y: -98 },
  tail: { x: 56, y: -73 },
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

// Each paid dog's coins, top slot first, leaving their doghouse in turn. With reduced motion
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
