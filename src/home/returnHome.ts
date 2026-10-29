import type { DogId } from "../data/types";
import type { LastWalk } from "../save/schema";

// The end screen's return home: the walker and pack walk up the front path, then the owners
// waiting there wave. With reduced motion everyone is already in place and nobody moves.
export const RETURN_HOME = {
  // How far below their places the walker and pack start.
  risePx: 60,
  walkMs: 1800,
  // Each wave is a sway to one side and back; the owners wave this many times.
  waveMs: 400,
  wavePx: 2,
  waves: 3,
} as const;

// Who comes home and who waits: the dogs still walking, in pack order, and their owners.
// Fired dogs went home on their own, and their owners do not wave.
export function homecomers(walk: Pick<LastWalk, "dogs" | "firings">): DogId[] {
  return walk.dogs.filter((dog) => !walk.firings.includes(dog));
}

// How far below its place the walker and pack are elapsedMs into the walk: easing out to 0.
export function walkUpOffset(reducedMotion: boolean, elapsedMs: number): number {
  if (reducedMotion || elapsedMs >= RETURN_HOME.walkMs) {
    return 0;
  }
  const left = 1 - Math.max(0, elapsedMs) / RETURN_HOME.walkMs;
  return Math.round(RETURN_HOME.risePx * left * left);
}

// The pack walks up, then stands while the owners wave, then everyone stands. With reduced
// motion the owners hold their wave pose from the start.
export type ReturnPhase = "home" | "walking" | "waving";

export function returnPhase(reducedMotion: boolean, elapsedMs: number): ReturnPhase {
  if (reducedMotion) {
    return "waving";
  }
  if (elapsedMs < RETURN_HOME.walkMs) {
    return "walking";
  }
  return elapsedMs < RETURN_HOME.walkMs + RETURN_HOME.waveMs * RETURN_HOME.waves
    ? "waving"
    : "home";
}

// A waving owner's sideways sway, standing in for the wave animation when only their face is
// drawn; 0 outside the waving phase and with reduced motion.
export function waveOffset(reducedMotion: boolean, elapsedMs: number): number {
  if (reducedMotion || returnPhase(reducedMotion, elapsedMs) !== "waving") {
    return 0;
  }
  const phase = ((elapsedMs - RETURN_HOME.walkMs) / RETURN_HOME.waveMs) * Math.PI * 2;
  return Math.round(Math.sin(phase) * RETURN_HOME.wavePx) || 0;
}
