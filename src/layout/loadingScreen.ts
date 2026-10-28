import { clamp01 } from "../lib/numbers";
import type { Point, Rect } from "../lib/rect";

// The loading screen's art, placed as art/tools/screens.py draws it, in screen pixels.
export const LOADING_ART = {
  screen: "screen-loading",
  track: "ui-loading-track",
  walker: "ui-loading",
} as const;

export const LOADING_TRACK: Rect = { height: 8, width: 316, x: 16, y: 456 };

// ui-loading's frame size, 98x84, with its feet on screen row 460.
export const LOADING_WALKER_SIZE = { height: 84, width: 98 };

// The walker's top-left at progress 0, and how far right it walks by 1: from the screen's
// left margin until its right edge meets the track's end at the gate.
export const LOADING_WALKER = {
  travel: LOADING_TRACK.x + LOADING_TRACK.width - LOADING_WALKER_SIZE.width - 6,
  x: 6,
  y: 379,
};

// Boot loads what the home screen needs over the network, then processes it: each sprite's
// animations and metrics, the placeholders and the fallback font. The rest loads behind the
// home screen, off the bar. Each phase fills its share of the
// bar in proportion to measured boots, where processing takes under a tenth of the time.
type BootPhase = "network" | "processing";

const PHASES: Readonly<Record<BootPhase, { from: number; to: number }>> = {
  network: { from: 0, to: 0.9 },
  processing: { from: 0.9, to: 1 },
};

// The whole boot's progress, from 0 to 1, given how far through its phase boot is.
export function bootProgress(phase: BootPhase, fraction: number): number {
  const { from, to } = PHASES[phase];
  return from + (to - from) * clamp01(fraction);
}

// A file's weight on the bar before its size is known: about a sound effect's size.
export const UNKNOWN_FILE_BYTES = 16_000;

// A loading file's size in bytes, and the fraction of it that has arrived.
export interface FileProgress {
  bytes: number;
  fraction: number;
}

// How far through the network phase boot is, with each file weighed by its size, so a few
// large atlas pages move the bar as steadily as many small files. No files is done.
export function byteFraction(files: readonly FileProgress[]): number {
  const total = files.reduce((sum, { bytes }) => sum + bytes, 0);
  const arrived = files.reduce((sum, { bytes, fraction }) => sum + bytes * clamp01(fraction), 0);
  return total <= 0 ? 1 : clamp01(arrived / total);
}

// How far through a phase of total steps boot is after done of them. A phase with no
// steps is already done.
export function stepFraction(total: number, done: number): number {
  return total <= 0 ? 1 : clamp01(done / total);
}

export function loadingWalkerAt(progress: number): Point {
  return {
    x: LOADING_WALKER.x + Math.round(LOADING_WALKER.travel * clamp01(progress)),
    y: LOADING_WALKER.y,
  };
}

// The fallback bar's width along the track, drawn while the walker's art is missing.
export function loadingBarWidth(progress: number): number {
  return Math.round(LOADING_TRACK.width * clamp01(progress));
}
