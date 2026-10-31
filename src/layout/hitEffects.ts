import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { DebuffId, Effect, MinorObstacleId } from "../data/types";
import type { RunState } from "../state/runState";

// Cosmetic cues for hits and applied contact debuffs, over the road at its fx depth. Debuff
// bursts read outcome application counts; no cue changes the walk.

// A plain hit is on a standing obstacle; a moving hit is on a mover.
export type HitKind = "moving" | "plain";
type Debris = "leaves" | "litter";
// How a struck obstacle moves: a cone rocks and tips over, a trash can rocks back upright, and a
// wide obstacle shakes sideways.
type ObstacleMotion = "rock" | "shake" | "tip";

// Every effect plays its art's play tag once. peak is the frame reduced motion holds.
// The splash's ground point, where the dog's feet meet the water, is on groundRow of its
// height-pixel frame.
export const HIT_ART = {
  bump: { key: "fx-bump", peak: 1 },
  bumpBig: { key: "fx-bump-big", peak: 1 },
  debris: { leaves: { key: "fx-debris-leaves" }, litter: { key: "fx-debris-litter" } },
  debuffs: {
    muddy: { key: "fx-debuff-muddy", peak: 2 },
    spotlight: { key: "fx-debuff-spotlight", peak: 2 },
    stinky: { key: "fx-debuff-stinky", peak: 2 },
    zoomies: { key: "fx-debuff-zoomies", peak: 2 },
  } satisfies Record<DebuffId, { readonly key: string; readonly peak: number }>,
  splash: { groundRow: 40, height: 48, key: "fx-splash", peak: 2 },
  tag: "play",
} as const;

// A bump is centred this far above the struck dog's top opaque row.
const BUMP_ABOVE = 6;

// The obstacles whose hit adds debris or moves them; every other one, a standing hazard
// included, keeps still with no debris.
export const OBSTACLE_HITS: Readonly<
  Partial<Record<MinorObstacleId, { readonly debris?: Debris; readonly motion: ObstacleMotion }>>
> = {
  artSculpture: { motion: "rock" },
  bench: { motion: "shake" },
  cherryTrees: { debris: "leaves", motion: "shake" },
  cone: { motion: "tip" },
  fallenLog: { motion: "shake" },
  hedge: { debris: "leaves", motion: "shake" },
  ironFence2: { motion: "shake" },
  ironFence3: { motion: "shake" },
  marketStall2: { motion: "shake" },
  marketStall3: { motion: "shake" },
  trashCan: { debris: "litter", motion: "rock" },
  volleyballNet2: { motion: "shake" },
  volleyballNet3: { motion: "shake" },
};

// One effect over the road: its art, centred at a point, drawn this many steps over the fx
// depth. frame null plays the tag; a number holds that frame of it for the stop.
export interface HitEffect {
  readonly above: number;
  readonly at: Point;
  readonly frame: number | null;
  readonly key: string;
}

export interface DebuffHitEffect extends HitEffect {
  readonly debuff: DebuffId;
}

// The existing 16px HUD icon at 2x, inset in a cream badge beside its burst.
export const DEBUFF_BADGE = {
  aboveFrame: 6,
  gap: 4,
  iconInset: 4,
  iconSize: 32,
  size: 40,
  viewInset: 4,
} as const;

// Keep the full burst inside the road, then place its badge outside the frame: on the right
// when it fits, otherwise on the left. The icon moves with its badge.
export function debuffCueRects(
  view: Rect,
  cue: { readonly at: Point; readonly height: number; readonly width: number },
): { readonly badge: Rect; readonly burst: Rect } {
  const { aboveFrame, gap, size, viewInset } = DEBUFF_BADGE;
  const left = view.x + viewInset;
  const top = view.y + viewInset;
  const right = view.x + view.width - viewInset;
  const bottom = view.y + view.height - viewInset;
  const burst: Rect = {
    height: cue.height,
    width: cue.width,
    x: Math.min(right - cue.width, Math.max(left, Math.round(cue.at.x - cue.width / 2))),
    y: Math.min(bottom - cue.height, Math.max(top, Math.round(cue.at.y - cue.height / 2))),
  };
  const badgeX = burst.x + burst.width + gap;
  return {
    badge: {
      height: size,
      width: size,
      x: badgeX + size <= right ? badgeX : burst.x - gap - size,
      y: Math.min(bottom - size, Math.max(top, burst.y - aboveFrame)),
    },
    burst,
  };
}

export interface StruckDog {
  readonly kind: HitKind;
  readonly obstacle: MinorObstacleId | null;
  // The struck dog's centre column and top opaque row.
  readonly top: Point;
}

// A plain hit's fx-bump, a moving hit's fx-bump-big, centred over the struck dog, and the
// obstacle's debris just over the bump. With reduced motion the bump holds its peak frame and
// the debris is skipped.
export function hitEffects(still: boolean, hit: StruckDog): HitEffect[] {
  const at = { x: hit.top.x, y: hit.top.y - BUMP_ABOVE };
  const art = hit.kind === "moving" ? HIT_ART.bumpBig : HIT_ART.bump;
  const bump: HitEffect = { above: 0, at, frame: still ? art.peak : null, key: art.key };
  const debris =
    hit.kind === "plain" && hit.obstacle !== null ? OBSTACLE_HITS[hit.obstacle]?.debris : undefined;
  if (still || debris === undefined) {
    return [bump];
  }
  return [bump, { above: 1, at, frame: null, key: HIT_ART.debris[debris].key }];
}

// The preferred centre for a contact debuff burst, before keeping its frame inside the road.
export function contactDebuffAnchor(top: Point): Point {
  return { x: top.x, y: top.y - BUMP_ABOVE };
}

// A contact's debuffs that actually applied, including a refresh with an unchanged timer.
// Its burst sits above the bump and debris; prevention leaves the application count unchanged.
export function contactDebuffEffects(
  still: boolean,
  before: Pick<RunState, "debuffsGot">,
  contact: {
    readonly after: Pick<RunState, "debuffsGot">;
    readonly effects: readonly Effect[];
    readonly top: Point;
  },
): DebuffHitEffect[] {
  const applied = new Set(
    contact.effects.flatMap((effect) =>
      effect.kind === "debuff" &&
      (contact.after.debuffsGot[effect.debuff] ?? 0) > (before.debuffsGot[effect.debuff] ?? 0)
        ? [effect.debuff]
        : [],
    ),
  );
  const at = contactDebuffAnchor(contact.top);
  return [...applied].map((debuff) => {
    const { key, peak } = HIT_ART.debuffs[debuff];
    return { above: 2, at, debuff, frame: still ? peak : null, key };
  });
}

// fx-splash with its ground point on the touching dog's feet; with reduced motion it holds its
// peak frame.
export function splashEffect(still: boolean, feet: Point): HitEffect {
  const { groundRow, height, key, peak } = HIT_ART.splash;
  const at = { x: feet.x, y: feet.y - (groundRow - height / 2) };
  return { above: 0, at, frame: still ? peak : null, key };
}

// One step of a struck obstacle's motion: it reaches these values over ms, eased by ease, or
// at once for 0 ms. angle is in degrees about the obstacle's feet; dx and dy are screen pixels
// added to where the road draws it.
export interface MotionStep {
  readonly angle?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly ease?: string;
  readonly ms: number;
}

const SWING_MS = 50;
const swings = (key: "angle" | "dx", values: readonly number[]): MotionStep[] =>
  values.map((value) => ({ [key]: value, ms: SWING_MS }));

// The tipped cone lies on its side, falling over this long.
const TIP = { angle: 90, ms: 120 };
// A mover jolts this far back up the road at once and eases back.
const JOLT = { ease: "Quad.easeOut", ms: 240, px: 4 };

// Each standing obstacle's motion, toward side for one that falls.
const MOTIONS: Readonly<Record<ObstacleMotion, (side: -1 | 1) => MotionStep[]>> = {
  rock: () => swings("angle", [10, -10, 6, 0]),
  shake: () => swings("dx", [2, -2, 1, 0]),
  tip: (side) => [...swings("angle", [-14, 14, -10]), { angle: side * TIP.angle, ms: TIP.ms }],
};

// The side a tipped obstacle falls to: away from the pack's centre, right when level with it.
export function tipSide(obstacleX: number, packX: number): -1 | 1 {
  return obstacleX < packX ? -1 : 1;
}

// How the struck obstacle moves: a mover jolts back up the road and eases back; a standing
// obstacle by its motion in OBSTACLE_HITS. Reduced motion keeps it still.
export function obstacleMotion(
  still: boolean,
  hit: Pick<StruckDog, "kind" | "obstacle">,
  side: -1 | 1,
): MotionStep[] {
  if (still) {
    return [];
  }
  if (hit.kind === "moving") {
    return [
      { dy: -JOLT.px, ms: 0 },
      { dy: 0, ease: JOLT.ease, ms: JOLT.ms },
    ];
  }
  const motion = hit.obstacle === null ? undefined : OBSTACLE_HITS[hit.obstacle]?.motion;
  return motion === undefined ? [] : MOTIONS[motion](side);
}

// The struck dog's white fill flash: the tint goes on or off at each cue's ms. Twice in motion,
// one blink with reduced motion.
export interface FlashCue {
  readonly ms: number;
  readonly on: boolean;
}

const FLASH = { blinkMs: 120, flickerMs: 60, flickers: 2 };

export function whiteFlash(still: boolean): FlashCue[] {
  if (still) {
    return [
      { ms: 0, on: true },
      { ms: FLASH.blinkMs, on: false },
    ];
  }
  return Array.from({ length: 2 * FLASH.flickers }, (_, index) => ({
    ms: index * FLASH.flickerMs,
    on: index % 2 === 0,
  }));
}

// The tags a dog plays in order after a hit before it walks on: the struck dog reacts, and on a
// splash every dog reacts and shakes off. Reduced motion skips them.
export const DOG_REACTIONS = { hit: ["react"], splash: ["react", "shake"] } as const;

export function dogReaction(still: boolean, reaction: keyof typeof DOG_REACTIONS): string[] {
  return still ? [] : [...DOG_REACTIONS[reaction]];
}
