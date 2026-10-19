// Game events, the manifest sound keys they play, and the mixing rules. No Phaser here: the
// soundboard in src/scenes/ applies these to the sound manager.

import { assertNever } from "../rules/assertNever";

export type SoundCue = "bark" | "bump" | "cardOpen" | "fired" | "tip" | "treat";

export const SOUND_KEYS: Readonly<Record<SoundCue, string>> = {
  bark: "sfx-bark",
  bump: "sfx-bump",
  cardOpen: "sfx-card",
  fired: "sfx-fired",
  tip: "sfx-tip",
  treat: "sfx-treat",
};

export const MUSIC_KEY = "music-walk";

// The music plays at this fraction of its volume while a card is open.
export const CARD_OPEN_MUSIC_DUCK = 0.5;

// A full fade between silence and full music volume.
export const MUSIC_FADE_MS = 500;

// At most this many plays of one effect start within the window, so a burst does not stack.
export const MAX_PLAYS_PER_WINDOW = 2;
export const PLAY_WINDOW_MS = 100;

// Each channel from 0 (silent) to 1 (full).
export interface Volumes {
  music: number;
  sfx: number;
}

export interface Mix {
  cardOpen: boolean;
  hidden: boolean;
  muted: boolean;
  paused: boolean;
  volumes: Volumes;
}

export const FULL_VOLUMES: Volumes = { music: 1, sfx: 1 };

export const INITIAL_MIX: Mix = {
  cardOpen: false,
  hidden: false,
  muted: false,
  paused: false,
  volumes: FULL_VOLUMES,
};

// Settings come from a save file, so anything outside 0 to 1, or not a number, is pinned to it.
export function clampVolume(volume: number): number {
  if (Number.isNaN(volume)) {
    return 0;
  }
  return Math.min(1, Math.max(0, volume));
}

// Channel volume times the master mute (silent while muted, hidden or paused). Music also ducks
// while a card is open.
export function effectiveVolumes(mix: Mix): Volumes {
  const master = mix.muted || mix.hidden || mix.paused ? 0 : 1;
  const duck = mix.cardOpen ? CARD_OPEN_MUSIC_DUCK : 1;
  return {
    music: clampVolume(mix.volumes.music) * master * duck,
    sfx: clampVolume(mix.volumes.sfx) * master,
  };
}

// level is the fade's current gain, from 0 (silent) to 1 (full).
export type MusicState =
  | { kind: "fading"; level: number; toward: "playing" | "stopped" }
  | { kind: "playing" }
  | { kind: "stopped" };

export const MUSIC_STOPPED: MusicState = { kind: "stopped" };

export function musicLevel(state: MusicState): number {
  switch (state.kind) {
    case "fading":
      return state.level;
    case "playing":
      return 1;
    case "stopped":
      return 0;
    default:
      return assertNever(state);
  }
}

// Starting mid fade-out turns the fade around from the current level rather than jumping.
export function startMusic(state: MusicState): MusicState {
  if (state.kind === "playing" || (state.kind === "fading" && state.toward === "playing")) {
    return state;
  }
  return { kind: "fading", level: musicLevel(state), toward: "playing" };
}

export function stopMusic(state: MusicState): MusicState {
  if (state.kind === "stopped" || (state.kind === "fading" && state.toward === "stopped")) {
    return state;
  }
  return { kind: "fading", level: musicLevel(state), toward: "stopped" };
}

// Moves a fade at a constant rate, so reversing halfway takes half a fade to undo.
export function advanceMusic(state: MusicState, elapsedMs: number): MusicState {
  if (state.kind !== "fading") {
    return state;
  }
  const step = Math.max(0, elapsedMs) / MUSIC_FADE_MS;
  if (state.toward === "playing") {
    const level = state.level + step;
    return level >= 1 ? { kind: "playing" } : { ...state, level };
  }
  const level = state.level - step;
  return level <= 0 ? MUSIC_STOPPED : { ...state, level };
}

// The start times of recent plays, per cue.
export type RecentPlays = Readonly<Partial<Record<SoundCue, readonly number[]>>>;

export interface PlayDecision {
  admitted: boolean;
  recent: RecentPlays;
}

export function admitPlay(recent: RecentPlays, cue: SoundCue, nowMs: number): PlayDecision {
  const inWindow = (recent[cue] ?? []).filter((startMs) => nowMs - startMs < PLAY_WINDOW_MS);
  if (inWindow.length >= MAX_PLAYS_PER_WINDOW) {
    return { admitted: false, recent: { ...recent, [cue]: inWindow } };
  }
  return { admitted: true, recent: { ...recent, [cue]: [...inWindow, nowMs] } };
}
