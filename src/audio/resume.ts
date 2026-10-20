// When to resume a stopped AudioContext. No Phaser here: the soundboard in src/scenes/ asks on
// each gesture, on each return to the foreground, and when the settings unmute.

import type { Mix } from "./sound";

// iOS leaves a context "interrupted" after a call or Siri and "suspended" after switching apps,
// and either stays silent until resumed. "closed" cannot resume.
const RESUMABLE_STATES: ReadonlySet<string> = new Set(["interrupted", "suspended"]);

// Whether the player's settings let the game make sound at all: unmuted, with a channel above
// zero. Pause and hiding are left out: they end with the context already running.
export function settingsAllowSound({ muted, volumes }: Mix): boolean {
  return !muted && (volumes.music > 0 || volumes.sfx > 0);
}

// A game the settings silence leaves its context stopped; unmuting resumes it.
export function shouldResumeAudio(mix: Mix, contextState: string): boolean {
  return RESUMABLE_STATES.has(contextState) && settingsAllowSound(mix);
}
