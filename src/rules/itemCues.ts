import type { GameData } from "../data/types";
import type { WalkItemKind } from "../runner/walk";

export type CueData = Pick<GameData, "encounters" | "minorObstacles">;

// Whether a road item bobs, which marks it as worth grabbing: tips, treats and lucky finds.
// Obstacles carry no marker.
export function itemBobs(data: CueData, kind: WalkItemKind): boolean {
  if (kind === "tip" || kind === "treat") {
    return true;
  }
  if (Object.hasOwn(data.minorObstacles, kind)) {
    return false;
  }
  return data.encounters[kind as keyof CueData["encounters"]].kind === "lucky";
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
