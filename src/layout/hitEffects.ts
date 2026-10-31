import type { Point, Rect } from "@andornaut/game-kit/rect";

import type { DebuffId, Effect, GameData, MinorObstacleId } from "../data/types";
import type { WalkStep } from "../runner/walk";
import type { RunState } from "../state/runState";

// Cosmetic cues for hits and applied contact debuffs, over the road at its fx depth. Debuff
// bursts read outcome application counts; no cue changes the walk.

// A plain hit is on a standing obstacle; a moving hit is on a mover.
export type HitKind = "moving" | "plain";
type Debris = "leaves" | "litter";
// How a struck obstacle moves: a trash can rocks back upright and a wide obstacle shakes sideways.
type ObstacleMotion = "rock" | "shake";

// Every effect plays its art's play tag once. peak is the frame reduced motion holds.
// The splash's ground point, where the dog's feet meet the water, is on groundRow of its
// height-pixel frame.
export const HIT_ART = {
  bump: { key: "fx-bump", peak: 1 },
  bumpBig: { key: "fx-bump-big", peak: 1 },
  debris: { leaves: { key: "fx-debris-leaves" }, litter: { key: "fx-debris-litter" } },
  debuffs: {
    muddy: { key: "fx-debuff-muddy", peak: 4 },
    spotlight: { key: "fx-debuff-spotlight", peak: 4 },
    stinky: { key: "fx-debuff-stinky", peak: 4 },
    zoomies: { key: "fx-debuff-zoomies", peak: 4 },
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
  fallenLog: { motion: "shake" },
  hedge: { debris: "leaves", motion: "shake" },
  ironFence2: { motion: "shake" },
  ironFence3: { motion: "shake" },
  marketStall2: { motion: "shake" },
  marketStall3: { motion: "shake" },
  trashCan: { debris: "litter", motion: "rock" },
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

export interface DebuffHitEffect {
  readonly debuff: DebuffId;
  readonly frame: number | null;
  readonly key: string;
}

// Ground art uses its native frame size, anchored on the feet row.
export const DEBUFF_GROUND = { groundRow: 30, height: 36, width: 60, yOffset: -1 } as const;

// The native HUD icon on a compact cream plate beside the walker's feet.
export const DEBUFF_BADGE = {
  gap: 4,
  iconInset: 4,
  iconSize: 16,
  leftDx: -72,
  rightDx: 48,
  size: 24,
  viewInset: 4,
  yOffset: -28,
} as const;

// Active kinds occupy distinct slots. Reserve room for every kind so viewport clamping never
// collapses separate slots onto the same row at the bottom edge.
export function debuffBadgeRect(view: Rect, feet: Point, slot = 0): Rect {
  const { gap, leftDx, rightDx, size, viewInset, yOffset } = DEBUFF_BADGE;
  const left = view.x + viewInset;
  const right = view.x + view.width - viewInset;
  const top = view.y + viewInset;
  const bottom = view.y + view.height - viewInset;
  const stride = size + gap;
  const direction = feet.x + rightDx + size <= right ? 1 : -1;
  const preferredX = feet.x + (direction === 1 ? rightDx : leftDx);
  const x = Math.min(right - size, Math.max(left, preferredX));
  const room = direction === 1 ? right - size - x : x - left;
  const kinds = Object.keys(HIT_ART.debuffs).length;
  const columns = Math.min(kinds, Math.floor(room / stride) + 1);
  const rows = Math.ceil(kinds / columns);
  const y = Math.min(bottom - size - (rows - 1) * stride, Math.max(top, feet.y + yOffset));
  return {
    height: size,
    width: size,
    x: Math.round(x + direction * (slot % columns) * stride),
    y: Math.round(y + Math.floor(slot / columns) * stride),
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

type ContactImpact = Pick<WalkStep["contacts"][number], "dog" | "item" | "source">;

function contactImpactKey({ source }: ContactImpact): string {
  return source.kind === "minor" ? `minor:${source.obstacle}` : `encounter:${source.encounter}`;
}

// A render frame may receive several fixed walking steps. Each material attacks visually once.
export class ContactImpactFrame {
  private frame: number | undefined;
  private readonly kinds = new Set<string>();

  take(frame: number, impacts: readonly ContactImpact[]): ContactImpact[] {
    if (this.frame !== frame) {
      this.frame = frame;
      this.kinds.clear();
    }
    return impacts.filter((impact) => {
      const kind = contactImpactKey(impact);
      if (this.kinds.has(kind)) {
        return false;
      }
      this.kinds.add(kind);
      return true;
    });
  }
}

// Physical impacts include immune contacts, with one visual attack per material kind per step.
export function contactImpacts(
  data: Pick<GameData, "encounters">,
  step: Pick<WalkStep, "contacts" | "modified">,
): ContactImpact[] {
  const impacts = new Map<string, ContactImpact>();
  const add = (impact: ContactImpact) => {
    const key = contactImpactKey(impact);
    if (!impacts.has(key)) {
      impacts.set(key, impact);
    }
  };
  step.contacts.forEach(add);
  for (const { dog, item, value } of step.modified) {
    const { subject } = value;
    if (
      dog !== undefined &&
      subject.kind === "immune" &&
      data.encounters[subject.encounter].resolution.kind === "contact"
    ) {
      add({ dog, item, source: { encounter: subject.encounter, kind: "encounter" } });
    }
  }
  return [...impacts.values()];
}

// A contact's debuffs that actually applied, including a refresh with an unchanged timer.
// Prevention leaves the application count unchanged.
export function contactDebuffEffects(
  still: boolean,
  before: Pick<RunState, "debuffsGot">,
  contact: {
    readonly after: Pick<RunState, "debuffsGot">;
    readonly effects: readonly Effect[];
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
  return [...applied].map((debuff) => {
    const { key, peak } = HIT_ART.debuffs[debuff];
    return { debuff, frame: still ? peak : null, key };
  });
}

// Coalesce cosmetic acquisition cues within a contact batch without altering its outcomes.
export function contactDebuffBatch(
  still: boolean,
  before: Pick<RunState, "debuffsGot">,
  contacts: readonly {
    readonly after: Pick<RunState, "debuffsGot">;
    readonly effects: readonly Effect[];
  }[],
): DebuffHitEffect[] {
  const cues = new Map<DebuffId, DebuffHitEffect>();
  let previous = before;
  for (const contact of contacts) {
    for (const cue of contactDebuffEffects(still, previous, contact)) {
      if (!cues.has(cue.debuff)) {
        cues.set(cue.debuff, cue);
      }
    }
    previous = contact.after;
  }
  return [...cues.values()];
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

// A mover jolts this far back up the road at once and eases back.
const JOLT = { ease: "Quad.easeOut", ms: 240, px: 4 };

// Each standing obstacle's motion.
const MOTIONS: Readonly<Record<ObstacleMotion, () => MotionStep[]>> = {
  rock: () => swings("angle", [10, -10, 6, 0]),
  shake: () => swings("dx", [2, -2, 1, 0]),
};

// How the struck obstacle moves: a mover jolts back up the road and eases back; a standing
// obstacle by its motion in OBSTACLE_HITS. Reduced motion keeps it still.
export function obstacleMotion(
  still: boolean,
  hit: Pick<StruckDog, "kind" | "obstacle">,
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
  return motion === undefined ? [] : MOTIONS[motion]();
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
