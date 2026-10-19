import type { Point, Rect } from "./rect";

// The loading screen's art, placed as art/tools/screens.py draws it, in screen pixels.
export const LOADING_ART = {
  screen: "screen-loading",
  track: "ui-loading-track",
  walker: "ui-loading",
} as const;

export const LOADING_TRACK: Rect = { height: 8, width: 200, x: 80, y: 437 };

// The walker's top-left at progress 0, and how far right it walks by 1: from the track's
// first dot to the doghouse.
const WALKER = { travel: 148, x: 76, y: 412 };

// Boot loads every asset over the network, then processes them: each sprite's animations
// and metrics, the placeholders and the fallback font. Each phase fills its share of the
// bar in proportion to measured boots, where processing takes under a tenth of the time.
export type BootPhase = "network" | "processing";

const PHASES: Readonly<Record<BootPhase, { from: number; to: number }>> = {
  network: { from: 0, to: 0.9 },
  processing: { from: 0.9, to: 1 },
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// The whole boot's progress, from 0 to 1, given how far through its phase boot is.
export function bootProgress(phase: BootPhase, fraction: number): number {
  const { from, to } = PHASES[phase];
  return from + (to - from) * clamp01(fraction);
}

// How far through a phase of total steps boot is after done of them. A phase with no
// steps is already done.
export function stepFraction(total: number, done: number): number {
  return total <= 0 ? 1 : clamp01(done / total);
}

export function loadingWalkerAt(progress: number): Point {
  return { x: WALKER.x + Math.round(WALKER.travel * clamp01(progress)), y: WALKER.y };
}

// The fallback bar's width along the track, drawn while the walker's art is missing.
export function loadingBarWidth(progress: number): number {
  return Math.round(LOADING_TRACK.width * clamp01(progress));
}
