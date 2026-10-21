import type { GameData } from "../data/types";
import { isNeedSpot } from "../runner/needs";
import type { WalkItemKind } from "../runner/walk";

export type CueData = Pick<GameData, "encounters" | "minorObstacles" | "needSpots" | "tuning">;

// How a road item reads at a glance. mark: it opens a card, so the walk screen draws a "!"
// over it. bob: it is a grab-worthy find that opens no card, so it bobs.
export interface ItemCue {
  bob: boolean;
  mark: boolean;
}

const NONE: ItemCue = { bob: false, mark: false };

// A forced stop always opens its card.
export const FORCED_STOP_CUE: ItemCue = { bob: false, mark: true };

// A need spot opens a card only at probability.needPayoffCard, so it carries the mark only when
// that is certain. Tips, treats and lucky encounters with an instant resolution bob. Minor
// obstacles open no card and never bob.
export function itemCue(data: CueData, kind: WalkItemKind): ItemCue {
  if (kind === "tip" || kind === "treat") {
    return { bob: true, mark: false };
  }
  if (isNeedSpot(data, kind)) {
    return { bob: false, mark: data.tuning.probability.needPayoffCard >= 1 };
  }
  if (Object.hasOwn(data.minorObstacles, kind)) {
    return NONE;
  }
  const encounter = data.encounters[kind as keyof CueData["encounters"]];
  const card = encounter.resolution.kind === "card";
  return { bob: encounter.kind === "lucky" && !card, mark: card };
}

// Whole-pixel steps of one bob, in screen pixels from the sprite's resting row.
const BOB_STEPS = [0, -1, -2, -1] as const;
const BOB_MS = 1000;

// The bob's vertical offset in whole screen pixels at a time in milliseconds: 1 to 2 px up and
// back down, once per second. Zero under reduced motion.
export function bobOffset(still: boolean, timeMs: number): number {
  if (still) {
    return 0;
  }
  const phase = (((timeMs / BOB_MS) % 1) + 1) % 1;
  return BOB_STEPS[Math.floor(phase * BOB_STEPS.length)] ?? 0;
}
