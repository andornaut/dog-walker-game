import type { LiveTuning } from "../data/types";
import { read } from "../rules/units";

// A screen that breaks into the walk (the neighbourhood celebration, a choice card) takes no
// tap, press or key until seconds.screenTapGuard has passed since the first frame it is drawn
// on, so a tap meant for the road never answers it.
export function tapGuardMs(tuning: LiveTuning): number {
  return read(tuning, "seconds", "screenTapGuard") * 1000;
}

// Whether a screen first drawn at drawnMs, or null while not yet drawn, takes input at nowMs.
export function guardPassed(guardMs: number, drawnMs: number | null, nowMs: number): boolean {
  return drawnMs !== null && nowMs - drawnMs >= guardMs;
}
