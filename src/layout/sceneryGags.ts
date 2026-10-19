import type { ZoneId } from "../data/types";

// The scenery gags in the backdrop band: a cat on a fence, a lawn sprinkler and a ball rolling
// along the sidewalk. They have no collision and no effect. Positions are band pixels, the
// top-left corner of each sprite.

export const GAG_KEYS = { ball: "gag-ball", cat: "gag-cat", sprinkler: "gag-sprinkler" } as const;
export const GAG_SIZES = {
  ball: { height: 14, width: 14 },
  cat: { height: 24, width: 24 },
  sprinkler: { height: 24, width: 32 },
} as const;

// The cat's paws rest on the fence's top rail, the sprinkler stands on the lawn, and the ball
// rolls along the sidewalk.
export const GAG_Y = { ball: 129, cat: 76, sprinkler: 98 } as const;

// Pixels per second, and the seconds between the starts of two rolls.
export const BALL_ROLL = { period: 30, speed: 40 } as const;

// How close to the cat, across the screen, the pack passes for the cat to sit up.
const CAT_REACT_DISTANCE = 32;

export interface Span {
  readonly x0: number;
  readonly x1: number;
}

// fences: where a cat may sit; sprinklers: each sprinkler's centre.
export interface ZoneGags {
  readonly fences: readonly Span[];
  readonly sprinklers: readonly number[];
}

export const ZONE_GAGS: Readonly<Record<ZoneId, ZoneGags>> = {
  homeStretch: {
    fences: [
      { x0: 0, x1: 88 },
      { x0: 274, x1: 360 },
    ],
    sprinklers: [120],
  },
  park: { fences: [], sprinklers: [230] },
  shops: { fences: [], sprinklers: [] },
  street: {
    fences: [
      { x0: 0, x1: 112 },
      { x0: 200, x1: 360 },
    ],
    sprinklers: [176],
  },
};

// Where the zone's cat sits, drawn from roll in [0, 1): a spot on one of its fences, or null
// for a zone without one. The cat stays wholly on the fence.
export function catX(gags: ZoneGags, roll: number): number | null {
  const room = gags.fences.map(({ x0, x1 }) => Math.max(0, x1 - x0 - GAG_SIZES.cat.width));
  const total = room.reduce((sum, width) => sum + width, 0);
  let offset = Math.min(Math.max(0, roll), 0.999999) * total;
  for (const [i, width] of room.entries()) {
    const fence = gags.fences[i];
    if (fence !== undefined && offset <= width) {
      return fence.x0 + Math.floor(offset);
    }
    offset -= width;
  }
  return null;
}

// The cat sits up while the pack passes below it.
export function catReacts(catLeft: number, packX: number): boolean {
  return Math.abs(catLeft + GAG_SIZES.cat.width / 2 - packX) <= CAT_REACT_DISTANCE;
}

// The ball's left edge seconds into the zone: it rolls in from the left at the start of each
// period and off the right edge, or null between rolls.
export function ballX(bandWidth: number, seconds: number): number | null {
  const sinceRoll = ((seconds % BALL_ROLL.period) + BALL_ROLL.period) % BALL_ROLL.period;
  const x = -GAG_SIZES.ball.width + sinceRoll * BALL_ROLL.speed;
  return x < bandWidth ? x : null;
}
