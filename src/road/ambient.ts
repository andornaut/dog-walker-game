import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import type { AmbientGait, AmbientMover, ZoneId } from "../data/types";
import { CROSS_STREET } from "../layout/crossStreet";
import { project, type RoadProjection, scaleAt, scaleAtY } from "../layout/projection";
import type { Random } from "../lib/random";
import { noise, sidewalkTo, type Verge, VERGES, walkFrom } from "./roadside";

// The ambient movers: cars, bikes, people, animals and planes moving across the backdrop's
// cross street and sky and beside the road, from each zone's table in the data. They are scenery only:
// nothing in the walk reads them, and they draw from a random stream of their own, so a seed
// plays the same walk with or without them. Their time is the walk's, so they stand still
// while it is held.
//
// The state is a fixed pool of slots, reused in place, so a frame allocates nothing.

// At most this many ambient movers at once.
export const AMBIENT_LIMIT = 6;

// A steady mover beside the road waits this long at its stop before it darts back out; a
// hopper or flier waits this long where it starts.
const STOP_SECONDS = 0.5;
// A hop's length in time, and the pause after each burst of one or two hops.
export const HOP = { pauseSeconds: 0.45, seconds: 0.2 } as const;
// A flier rises this many pixels for each pixel it travels.
const FLY_CLIMB = 0.6;
// Road pixels from the sidewalk's (or, without one, the road's) outer edge to where a mover
// walks along it, when the sidewalk has no width of its own; and to where a verge mover stops,
// plus up to VERGE_SPREAD more.
const SIDEWALK_INSET = 28;
const VERGE_INSET = 32;
const VERGE_SPREAD = 32;
// How far a mover starts and ends past the screen's side, in pixels at its scale.
const OFF_SCREEN = ROAD_SPRITE_SIZE;
// Where a verge mover sets out, as shares of the road in view: a darter further off, as the
// road brings it nearer while it runs in.
const VERGE_DISTANCE = { dart: { from: 0.55, span: 0.3 }, sit: { from: 0.35, span: 0.45 } };
// Hop bursts are counted up to this many, which no mover outlives.
const MAX_BURSTS = 1000;
// A sky mover's feet row, in band pixels, from..to, when its data gives no rows: with a plane's
// feet on the 9th of its 10 rows, it flies within band rows 0 to 12, the clear sky above the
// tallest skyline.
export const SKY_ROWS = { from: 9, to: 12 } as const;

// The rows a sky mover's feet row is drawn from: its own, or SKY_ROWS.
export function skyRows(mover: AmbientMover): { readonly from: number; readonly to: number } {
  return mover.rows ?? SKY_ROWS;
}

// What the movers are placed against: the backdrop band's top row and width, and the road's
// projection.
export interface AmbientStage {
  readonly band: { readonly width: number; readonly y: number };
  readonly projection: RoadProjection;
}

// One mover. direction is the way a mover on the cross street or in the sky goes (1 right,
// -1 left), and the side of the road for one beside it (1 right, -1 left). row is a cross
// street or sky mover's feet row, in band pixels. Beside the road, across is where it walks or stops and outer
// where it starts or leaves, in road pixels from the road's centre line, and z the road
// distance from the walk's start where it set out. look, in [0, 1), picks among its art's
// variants, such as a car's body.
interface AmbientSlot {
  across: number;
  active: boolean;
  bornAt: number;
  direction: -1 | 1;
  look: number;
  mover: AmbientMover | null;
  outer: number;
  row: number;
  seed: number;
  z: number;
}

interface AmbientState {
  nextAt: number;
  readonly slots: readonly AmbientSlot[];
  zone: ZoneId | null;
}

// Where a mover is drawn: its feet on screen, its scale, how far above its feet it flies at
// scale 1, whether it is mirrored (art faces right), whether it is moving, and whether it is
// on the cross street or in the sky (band) or beside the road.
export interface AmbientPlace {
  band: boolean;
  flip: boolean;
  lift: number;
  moving: boolean;
  scale: number;
  x: number;
  y: number;
}

// What each frame needs: the walk's time and road distance from its start, and the zone with
// its movers. A caller may reuse one frame, changing it in place.
export interface AmbientFrame {
  movers: readonly AmbientMover[];
  now: number;
  travelled: number;
  zone: ZoneId;
}

// The stage, the stream the movers draw from, and whether a mover's art can be drawn: a mover
// without art never sets out, so it takes no slot.
export interface AmbientDeps {
  readonly drawable: (mover: AmbientMover) => boolean;
  readonly random: Random;
  readonly stage: AmbientStage;
}

export function startAmbient(): AmbientState {
  return {
    nextAt: 0,
    slots: Array.from({ length: AMBIENT_LIMIT }, () => ({
      across: 0,
      active: false,
      bornAt: 0,
      direction: 1,
      look: 0,
      mover: null,
      outer: 0,
      row: 0,
      seed: 0,
      z: 0,
    })),
    zone: null,
  };
}

export function newPlace(): AmbientPlace {
  return { band: false, flip: false, lift: 0, moving: false, scale: 1, x: 0, y: 0 };
}

// Ends every mover, as on a zone change or with reduced motion.
export function clearAmbient(state: AmbientState): void {
  state.slots.forEach((slot) => {
    slot.active = false;
  });
  state.zone = null;
}

// Retires the movers whose paths are done, then sets out those due by now. A new zone ends the
// last zone's movers, as its backdrop and verge are gone.
export function stepAmbient(deps: AmbientDeps, frame: AmbientFrame, state: AmbientState): void {
  const { random, stage } = deps;
  let total = 0;
  for (const mover of frame.movers) {
    total += Math.max(0, mover.perMinute);
  }
  if (state.zone !== frame.zone) {
    clearAmbient(state);
    state.zone = frame.zone;
    state.nextAt = frame.now + gap(random, total);
  }
  for (const slot of state.slots) {
    if (slot.active && !placeAmbient(stage, slot, frame.now, frame.travelled, scratch)) {
      slot.active = false;
    }
  }
  while (state.nextAt <= frame.now) {
    const mover = pickMover(random, frame.movers, total);
    const slot = state.slots.find((free) => !free.active);
    if (mover !== null && slot !== undefined && deps.drawable(mover)) {
      setOut(deps, frame, mover, slot);
    }
    state.nextAt += gap(random, total);
  }
}

// Seconds to the next mover setting out, for movers setting out total times a minute.
function gap(random: Random, total: number): number {
  return total > 0 ? (-Math.log(1 - random()) * 60) / total : Number.POSITIVE_INFINITY;
}

function pickMover(
  random: Random,
  movers: readonly AmbientMover[],
  total: number,
): AmbientMover | null {
  let rest = random() * total;
  for (const mover of movers) {
    rest -= Math.max(0, mover.perMinute);
    if (rest < 0) {
      return mover;
    }
  }
  return null;
}

// Where a mover beside the road walks along it: the middle of the sidewalk, or just past the
// curb or paving's inner edge where the sidewalk has no width of its own.
function sidewalkAcross(verge: Verge): number {
  const from = walkFrom(verge);
  return Number.isFinite(verge.walkTo) && verge.walkTo - from >= 2 * SIDEWALK_INSET
    ? (from + verge.walkTo) / 2
    : from + SIDEWALK_INSET;
}

// The nearest a verge mover stops to the road: VERGE_INSET past the sidewalk, on the lawn or out
// on the paving, so it stops clear of the curb props standing on the sidewalk.
function vergeStop(verge: Verge): number {
  return sidewalkTo(verge) + VERGE_INSET;
}

function setOut(
  deps: AmbientDeps,
  frame: AmbientFrame,
  mover: AmbientMover,
  slot: AmbientSlot,
): void {
  const { random, stage } = deps;
  const { projection } = stage;
  const verge = VERGES[frame.zone];
  slot.active = true;
  slot.bornAt = frame.now;
  slot.mover = mover;
  slot.direction = random() < 0.5 ? -1 : 1;
  slot.seed = Math.floor(random() * 65536);
  slot.look = random();
  switch (mover.path) {
    case "crossStreet":
      slot.row = slot.direction === 1 ? CROSS_STREET.nearLane : CROSS_STREET.farLane;
      return;
    case "crossWalk":
      slot.row = random() < 0.5 ? CROSS_STREET.nearWalk : CROSS_STREET.farWalk;
      return;
    case "sky": {
      const { from, to } = skyRows(mover);
      slot.row = from + Math.floor(random() * (to - from + 1));
      return;
    }
    case "sidewalkAway":
    case "sidewalkToward":
      slot.across = sidewalkAcross(verge);
      slot.z = frame.travelled + projection.visibleDistance;
      return;
    case "verge": {
      const { from, span } = mover.gait === "steady" ? VERGE_DISTANCE.dart : VERGE_DISTANCE.sit;
      const distance = projection.visibleDistance * (from + span * random());
      slot.across = vergeStop(verge) + VERGE_SPREAD * random();
      slot.outer = Math.max(
        slot.across + OFF_SCREEN,
        (projection.centerX + OFF_SCREEN) / scaleAt(projection, distance),
      );
      slot.z = frame.travelled + distance;
    }
  }
}

// How far a mover has gone seconds after it set out on its gait, and whether it is moving.
interface GaitTravel {
  moving: boolean;
  travel: number;
}

const travelScratch: GaitTravel = { moving: false, travel: 0 };
const scratch = newPlace();

// A hopper goes in bursts of one or two hops, the count from its seed, with a pause after
// each. The result is one shared object, so read it before the next call.
export function gaitTravel(
  gait: AmbientGait,
  speed: number,
  seed: number,
  seconds: number,
): GaitTravel {
  const out = travelScratch;
  out.moving = seconds >= 0;
  out.travel = speed * Math.max(0, seconds);
  if (gait !== "hop" || seconds < 0) {
    return out;
  }
  let rest = seconds;
  let travel = 0;
  for (let burst = 0; burst < MAX_BURSTS; burst++) {
    const hopping = (noise(seed, burst) < 0.5 ? 1 : 2) * HOP.seconds;
    if (rest < hopping) {
      out.moving = true;
      out.travel = travel + speed * rest;
      return out;
    }
    rest -= hopping;
    travel += speed * hopping;
    if (rest < HOP.pauseSeconds) {
      break;
    }
    rest -= HOP.pauseSeconds;
  }
  out.moving = false;
  out.travel = travel;
  return out;
}

// Writes where a mover is drawn now into out, or returns false once its path is done: off the
// screen's side, past the walker's feet, or gone up the road into the cross street. A sky
// mover is drawn at full size; a cross street mover at its row's scale.
export function placeAmbient(
  stage: AmbientStage,
  slot: AmbientSlot,
  now: number,
  travelled: number,
  out: AmbientPlace,
): boolean {
  const { mover } = slot;
  if (mover === null) {
    return false;
  }
  const seconds = now - slot.bornAt;
  const { projection } = stage;
  out.lift = 0;
  out.flip = false;
  if (mover.path === "crossStreet" || mover.path === "crossWalk" || mover.path === "sky") {
    const { moving, travel } = gaitTravel(mover.gait, mover.speed, slot.seed, seconds);
    const { band } = stage;
    const start = slot.direction === 1 ? -OFF_SCREEN : band.width + OFF_SCREEN;
    out.band = true;
    out.flip = slot.direction === -1;
    out.moving = moving;
    out.x = start + slot.direction * travel;
    out.y = band.y + slot.row;
    // The cross street lies beyond the road's far edge, at the scale the road's projection
    // gives its row.
    out.scale = mover.path === "sky" ? 1 : scaleAtY(projection, out.y);
    if (mover.gait === "fly") {
      out.lift = travel * FLY_CLIMB;
    }
    return travel <= band.width + 2 * OFF_SCREEN;
  }
  out.band = false;
  let across = slot.across;
  let distance = slot.z - travelled;
  if (mover.path === "verge") {
    // A darter runs in, stops, and runs out; a hopper or flier stops first, then leaves.
    const arrives = mover.gait === "steady" ? (slot.outer - slot.across) / mover.speed : 0;
    const inward = seconds < arrives;
    const leaving = seconds - arrives - STOP_SECONDS;
    const { moving, travel } = gaitTravel(mover.gait, mover.speed, slot.seed, leaving);
    if (inward) {
      across = slot.outer - mover.speed * seconds;
    } else {
      across += travel;
      if (mover.gait === "fly") {
        out.lift = travel * FLY_CLIMB;
      }
    }
    out.moving = inward || moving;
    // The art faces right: inward is rightward on the left side.
    out.flip = inward === (slot.direction === 1);
    if (!inward && across > slot.outer) {
      return false;
    }
  } else {
    const { moving, travel } = gaitTravel(mover.gait, mover.speed, slot.seed, seconds);
    distance += mover.path === "sidewalkAway" ? travel : -travel;
    out.moving = moving;
  }
  if (distance < 0 || distance > projection.visibleDistance + 1) {
    return false;
  }
  const placed = project(projection, {
    distance,
    x: projection.centerX + slot.direction * across,
  });
  out.scale = placed.scale;
  out.x = placed.x;
  out.y = placed.y;
  return true;
}
