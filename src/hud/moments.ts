import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GameData } from "../data/types";
import type { Point, Rect } from "../lib/rect";
import { type FaceMood, faceMood } from "../rules/treats";
import type { Cents } from "../rules/units";
import type { Pack, PackSlot } from "../state/runState";
import { type FontMetrics, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import { type FaceBox, type FaceText, fillFaceText, ownerFaceText } from "./faceText";
import type { ChangeLabel } from "./hudView";
import { cashTop, DOG_CARD, OWNER_TAB, TITLE_CAP_ROWS, WALK_BAR } from "./walkHud";

// The in-run feedback moments RunScene hands the HUD on its events: an owner firing you, a
// heart forgiven, a zone's pay banked, and a treat grabbed.
export const FIRING_EVENT = "firing";
export const FORGIVEN_EVENT = "heart-forgiven";
export const PAYOUT_EVENT = "payout";
export const TREAT_EVENT = "treat-grabbed";

// seconds is how long the firing holds the walk.
export interface FiringCue {
  dog: DogId;
  line: string;
  seconds: number;
}

// A loss the walker's perk forgave on dog's owner: hearts is what the owner has after it, the
// last of them the heart forgiven.
export interface ForgivenCue {
  dog: DogId;
  hearts: number;
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
  // The firing moment: the owner's face pops in over popMs and the "FIRED!" plate drops in over
  // plateMs as the hold starts, and the face, pop, plate and fired line fade out over fadeMs.
  firing: { fadeMs: 150, plateMs: 120, popMs: 160 },
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

// Where coins land: the middle of the cash, at its largest scale.
const LARGEST_CASH = WALK_BAR.cash.scales[0];
const { ink } = WALK_BAR.cash;
export const TOP_BAR_POINTS = {
  bank: {
    x: Math.floor((ink.left + ink.right) / 2),
    y: Math.floor(cashTop(LARGEST_CASH) + (TITLE_CAP_ROWS * LARGEST_CASH) / 2),
  },
} as const;

// An 8x6 tail under a bubble, pointing down at who is speaking: its top row sits over the
// bubble's bottom rim, and tipX is the column it points from.
interface DownTail {
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

// A bubble keeps the screen's gutter, this many pixels, from either edge.
const BUBBLE_GUTTER = 8;

// The left edge of a bubble width wide centred on centreX, kept inside the screen's gutter.
export function bubbleX(screenWidth: number, centreX: number, width: number): number {
  return Math.round(
    Math.min(Math.max(BUBBLE_GUTTER, centreX - width / 2), screenWidth - width - BUBBLE_GUTTER),
  );
}

// Fired lines' bubbles all sit on one row, over the owners' faces. One opening beside
// another keeps LINE_GAP pixels from it, and its tail starts at least LINE_TAIL_INSET in from
// its edges, past the bubble's rim.
const LINE_GAP = 2;
const LINE_TAIL_INSET = 4;

// The left edge of a fired line's bubble width wide: centred over its tail (bubbleX), else the
// nearest place just beside an open bubble, inside the screen's gutter, clear of every open
// bubble and with the tail on it. undefined while no such place is free, so the line waits for
// a bubble to close.
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
    x >= BUBBLE_GUTTER &&
    x + width <= screenWidth - BUBBLE_GUTTER &&
    tail.x >= x + LINE_TAIL_INSET &&
    tail.x + tail.width <= x + width - LINE_TAIL_INSET &&
    open.every((o) => x + width + LINE_GAP <= o.x || o.x + o.width + LINE_GAP <= x);
  return [centred, ...beside]
    .filter(fits)
    .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred))[0];
}

// When the firing moment's parts play over a hold of seconds, in ms from the firing. The face
// pops in and the plate drops in as the hold starts; the face, pop, plate and fired line stay
// up and fade out to end with the hold (fadeAtMs + fadeMs); the fired dog trots off the road,
// or fades with reduced motion, over the whole hold (trotMs). A hold too short for every part
// shortens the pop and the drop first, then the fade. Reduced motion sets the face and plate
// in place at once and keeps the hold's length.
interface FiringTimeline {
  readonly fadeAtMs: number;
  readonly fadeMs: number;
  readonly plateMs: number;
  readonly popMs: number;
  readonly trotMs: number;
}

export function firingTimeline(seconds: number, still: boolean): FiringTimeline {
  const { fadeMs, plateMs, popMs } = MOMENTS.firing;
  const holdMs = Math.max(0, seconds * 1000);
  const fade = Math.min(fadeMs, holdMs);
  const fadeAtMs = holdMs - fade;
  const intro = (ms: number) => (still ? 0 : Math.min(ms, fadeAtMs));
  return { fadeAtMs, fadeMs: fade, plateMs: intro(plateMs), popMs: intro(popMs), trotMs: holdMs };
}

// The firing moment's parts, from the card's top-left corner, all above the card so the card
// shows its fired look under them: the owner's face at 2x centred over the owner's tab, LIFT
// higher, the 64x64 pop drawn at 2x (popSize square) from pop, centred on the face
// (firingLayout keeps it on screen), the plate under the face with its bottom PLATE_GAP over
// the card's top, as wide as the card's name and PLATE_REACH more each side, and the fired
// line's bubble centred over line, its bottom edge on it, with the 8x6 tail's top row at tail.y
// over the bubble's rim, its tip at tail.x, LINE_CLEARANCE over the face's top.
const PLATE_REACH = 4;
const PLATE_HEIGHT = 28;
const PLATE_GAP = 4;
const FACE_HALF = 32;
const LIFT = 50;
const LINE_CLEARANCE = 6;
const FACE = {
  x: OWNER_TAB.x + OWNER_TAB.size / 2,
  y: OWNER_TAB.y + OWNER_TAB.size / 2 - LIFT,
};
export const FIRING_PARTS = {
  face: FACE,
  line: { x: FACE.x, y: FACE.y - FACE_HALF - LINE_CLEARANCE },
  plate: {
    height: PLATE_HEIGHT,
    width: DOG_CARD.name.room + 2 * PLATE_REACH,
    x: DOG_CARD.name.x - DOG_CARD.name.room / 2 - PLATE_REACH,
    y: -PLATE_HEIGHT - PLATE_GAP,
  },
  // "FIRED!" is centred across the plate, the top of its capitals this far down.
  plateText: { y: 9 },
  pop: { x: FACE.x - 2 * FACE_HALF, y: FACE.y - 2 * FACE_HALF },
  popSize: 4 * FACE_HALF,
  tail: { x: FACE.x, y: FACE.y - FACE_HALF - LINE_CLEARANCE - 1 },
} as const;

// The firing moment's parts on screen for the dog in slot, the pop moved in from the screen's
// edge as far as it takes to keep it whole.
export function firingLayout(
  screen: Pick<Rect, "width" | "x">,
  slot: Pick<Rect, "x" | "y">,
): {
  face: Point;
  line: Point;
  plate: Rect;
  pop: Point;
  tail: Point;
} {
  const at = (point: Point) => ({ x: slot.x + point.x, y: slot.y + point.y });
  const { face, line, plate, pop, popSize, tail } = FIRING_PARTS;
  const popX = Math.max(screen.x, Math.min(screen.x + screen.width - popSize, slot.x + pop.x));
  return {
    face: at(face),
    line: at(line),
    plate: { ...plate, ...at(plate) },
    pop: { x: popX, y: slot.y + pop.y },
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

type CardOwnerMood = FaceMood | "fired" | "worried";

// The owner's face on their dog's card, out of max hearts: fired on a fired dog's card, worried
// at lowHearts, else the mood the dog's face shows.
export function cardOwnerMood(
  data: Pick<GameData, "tuning">,
  max: number,
  slot: PackSlot,
): CardOwnerMood {
  if (slot.status === "fired") {
    return "fired";
  }
  return slot.hearts === MOMENTS.lowHearts ? "worried" : faceMood(data, max, slot.hearts);
}

// The dogs low now that were not low before: each gets the one-off cue.
export function newlyLow(before: readonly DogId[], now: readonly DogId[]): DogId[] {
  return now.filter((dog) => !before.includes(dog));
}

// The low-hearts chip over its card, then rising rise pixels: its line on one line on a cream
// box gap over the card's top, from dx in from the card's left but kept margin inside the
// screen. The text sits padX in from the box's sides, its capitals padTop under the box's top
// and its lowest ink padBottom over the box's bottom, in the body font's rows. The owner's
// inline face keeps faceInset rows inside the box's top and bottom, the box growing to hold it.
export const LOW_CHIP = {
  dx: 2,
  faceInset: 2,
  gap: 6,
  margin: 2,
  padBottom: 3,
  padTop: 5,
  padX: 2,
  rise: 8,
} as const;

// The low-hearts chip's line, its owner's name led by their face, upset.
export function lowHeartsText(data: Pick<GameData, "dogs" | "runText">, dog: DogId): FaceText {
  return fillFaceText(data.runText.lowHearts, { owner: ownerFaceText(data, "upset", dog) });
}

// The line in the first of TEXT_FIT_STYLES whose ink fits the screen less the chip's margin
// and padding each side. The box holds the label's width, which counts the last glyph's
// trailing pixel.
export const LOW_CHIP_FIT = {
  room: SCREEN_CONFIG.width - 2 * (LOW_CHIP.margin + LOW_CHIP.padX) - 1,
  styles: TEXT_FIT_STYLES,
} as const;

// The chip's box and its text's capitals' top-left, for a line width wide at scale over slot,
// with an inline face in face, if any.
export function lowChipPlace(
  body: FontMetrics,
  screenWidth: number,
  slot: Pick<Rect, "x" | "y">,
  text: { face?: FaceBox; scale: number; width: number },
): { box: Rect; text: Point } {
  const { dx, faceInset, gap, margin, padX } = LOW_CHIP;
  const { face } = text;
  const ink = inkRowsFromCapTop(body) * text.scale;
  const padTop = Math.max(LOW_CHIP.padTop, face === undefined ? 0 : face.rise + faceInset);
  const under = face === undefined ? 0 : face.framed - face.rise + faceInset - ink;
  const padBottom = Math.max(LOW_CHIP.padBottom, under);
  const width = text.width + 2 * padX;
  const height = padTop + ink + padBottom;
  const x = Math.max(margin, Math.min(slot.x + dx, screenWidth - margin - width));
  const y = slot.y - gap - height;
  return { box: { height, width, x, y }, text: { x: x + padX, y: y + padTop } };
}

// A fired line's bubble: its line wrapped onto up to lines lines at scale, no wider than
// maxWidth less padding each side, its first line's capitals padding under the bubble's top
// and its last line's lowest ink padding over its bottom, a line of the body font apart.
export const FIRED_LINE = { lines: 3, maxWidth: 200, padding: 6, scale: 2 } as const;

// The bubble holds the label's width, which counts the last glyph's trailing pixel.
export const FIRED_LINE_FIT = {
  room: FIRED_LINE.maxWidth - 2 * FIRED_LINE.padding - 1,
  styles: [{ letterSpacing: 0, lines: FIRED_LINE.lines, scale: FIRED_LINE.scale }],
} as const satisfies { room: number; styles: readonly TextFitStyle[] };

// A fired line's bubble's height for lines lines.
export function firedLineHeight(body: FontMetrics, lines: number): number {
  const { padding, scale } = FIRED_LINE;
  return padding + inkRowsOfLines(body, lines) * scale + padding;
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
