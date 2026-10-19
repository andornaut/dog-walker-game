import { itemAt } from "../arrays";
import type { ZoneId } from "../data/types";
import type { Point } from "./rect";

// The scenery gags in the backdrop band: a cat on a perch, a lawn sprinkler and a ball rolling
// along a sidewalk. They have no collision and no effect. Positions are band pixels; the cat
// and sprinkler are placed by the top-left corner of their sprites. The street runs up from
// the band's bottom edge to a cross street, and the gags sit on the lawns either side of it.

export const GAG_KEYS = { ball: "gag-ball", cat: "gag-cat", sprinkler: "gag-sprinkler" } as const;
export const GAG_SIZES = {
  ball: { height: 14, width: 14 },
  cat: { height: 24, width: 24 },
  sprinkler: { height: 24, width: 32 },
} as const;

// The cat's paws rest on the near-left perch's top rail, on row 94, and the sprinkler
// stands on the near-right lawn, rows 86 to 109.
export const GAG_Y = { cat: 71, sprinkler: 86 } as const;

// The ball's feet, rolling up the middle of a sidewalk from the band's bottom edge.
export interface BallPath {
  readonly from: Point;
  readonly to: Point;
}

const BALL_PATHS: readonly BallPath[] = [
  { from: { x: 97, y: 109 }, to: { x: 103, y: 85 } },
  { from: { x: 263, y: 109 }, to: { x: 257, y: 85 } },
];
// The ball's feet, from the top-left of its sprite.
const BALL_FEET = { x: 7, y: 13 } as const;

// Band pixels per second, and the seconds between the starts of two rolls, which take the
// left and right sidewalks in turn.
export const BALL_ROLL = { period: 30, speed: 10 } as const;

// How close to the cat, across the screen, the pack passes for the cat to sit up.
const CAT_REACT_DISTANCE = 32;

export interface Span {
  readonly x0: number;
  readonly x1: number;
}

// perches: where a cat may sit; sprinklers: each sprinkler's centre.
export interface ZoneGags {
  readonly perches: readonly Span[];
  readonly sprinklers: readonly number[];
}

// Every backdrop has a perch along its near-left lawn: a picket fence, a park rail or a
// planter's ledge. The shops zone is paved, so it has no sprinkler.
const NEAR_LEFT_PERCH: Span = { x0: 0, x1: 82 };
const NEAR_RIGHT_LAWN = 338;

export const ZONE_GAGS: Readonly<Record<ZoneId, ZoneGags>> = {
  homeStretch: { perches: [NEAR_LEFT_PERCH], sprinklers: [NEAR_RIGHT_LAWN] },
  park: { perches: [NEAR_LEFT_PERCH], sprinklers: [NEAR_RIGHT_LAWN] },
  // The cat sits on the riverside railing, which takes the perch's rows.
  pawsPromenade: { perches: [NEAR_LEFT_PERCH], sprinklers: [NEAR_RIGHT_LAWN] },
  shops: { perches: [NEAR_LEFT_PERCH], sprinklers: [] },
  snoozeCrescent: { perches: [NEAR_LEFT_PERCH], sprinklers: [NEAR_RIGHT_LAWN] },
  street: { perches: [NEAR_LEFT_PERCH], sprinklers: [NEAR_RIGHT_LAWN] },
};

// Where the zone's cat sits, drawn from roll in [0, 1): a spot on one of its perches, or null
// for a zone without one. The cat stays wholly on the perch.
export function catX(gags: ZoneGags, roll: number): number | null {
  const room = gags.perches.map(({ x0, x1 }) => Math.max(0, x1 - x0 - GAG_SIZES.cat.width));
  const total = room.reduce((sum, width) => sum + width, 0);
  let offset = Math.min(Math.max(0, roll), 0.999999) * total;
  for (const [i, width] of room.entries()) {
    const perch = gags.perches[i];
    if (perch !== undefined && offset <= width) {
      return perch.x0 + Math.floor(offset);
    }
    offset -= width;
  }
  return null;
}

// The cat sits up while the pack passes below it.
export function catReacts(catLeft: number, packX: number): boolean {
  return Math.abs(catLeft + GAG_SIZES.cat.width / 2 - packX) <= CAT_REACT_DISTANCE;
}

// The top-left of the ball's sprite seconds into the zone: at the start of each period it
// rolls up the next sidewalk, then is gone until the next roll. still holds it at the near
// end of the left sidewalk.
export function ballAt(seconds: number, still = false): Point | null {
  const period = Math.floor(seconds / BALL_ROLL.period);
  const sinceRoll = seconds - period * BALL_ROLL.period;
  const side = still ? 0 : ((period % BALL_PATHS.length) + BALL_PATHS.length) % BALL_PATHS.length;
  const path = itemAt(BALL_PATHS, side);
  const length = Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y);
  const t = still ? 0 : (sinceRoll * BALL_ROLL.speed) / length;
  if (t > 1) {
    return null;
  }
  return {
    x: Math.round(path.from.x + (path.to.x - path.from.x) * t - BALL_FEET.x),
    y: Math.round(path.from.y + (path.to.y - path.from.y) * t - BALL_FEET.y),
  };
}
