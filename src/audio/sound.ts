// Game events, the manifest sound keys they play, and the mixing rules. No Phaser here: the
// soundboard in src/scenes/ applies these to the sound manager.

import { clamp01 } from "@andornaut/game-kit/numbers";

import { kebabCase } from "../assets/spriteKeys";
import type { Encounter, EncounterId } from "../data/types";

export type BaseCue =
  | "badge"
  | "bark"
  | "bump"
  | "cardOpen"
  | "dodge"
  | "fired"
  | "gearFound"
  | "heartLost"
  | "newBest"
  | "pull"
  | "tip"
  | "treat"
  | "zoneDone";
// An encounter's hit moment, played with its own sound: an obstacle's or a lucky find's.
type HitCue = `hit:${EncounterId}` | `luckyHit:${EncounterId}`;
export type SoundCue = BaseCue | HitCue;

const HIT_PREFIX = "hit:";
const LUCKY_HIT_PREFIX = "luckyHit:";

export const SOUND_KEYS: Readonly<Record<BaseCue, string>> = {
  badge: "sfx-badge",
  bark: "sfx-bark",
  bump: "sfx-bump",
  cardOpen: "sfx-card",
  dodge: "sfx-dodge",
  fired: "sfx-fired",
  gearFound: "sfx-gear-found",
  heartLost: "sfx-heart-lost",
  newBest: "sfx-new-best",
  // A squirrel's pull, the only pull there is, plays the squirrel's own sound.
  pull: "sfx-hit-squirrel",
  tip: "sfx-tip",
  treat: "sfx-treat",
  zoneDone: "sfx-zone-done",
};

// The cues the home screen and the menus it opens play: Settings' volume preview and a
// celebration's badge. Boot loads their sounds before the home screen shows, the rest after.
export const HOME_CUES: readonly BaseCue[] = ["badge", "tip"];

export function hitCue(kind: Encounter["kind"], encounter: EncounterId): HitCue {
  return kind === "lucky" ? `${LUCKY_HIT_PREFIX}${encounter}` : `${HIT_PREFIX}${encounter}`;
}

// The keys a cue may play, in preference order: an obstacle hit's own sfx-hit-<encounter>,
// then the bump; a lucky hit's own sfx-<encounter>, with nothing in its place.
export function soundKeysOf(cue: SoundCue): readonly string[] {
  if (isBaseCue(cue)) {
    return [SOUND_KEYS[cue]];
  }
  return cue.startsWith(HIT_PREFIX)
    ? [`sfx-hit-${kebabCase(cue.slice(HIT_PREFIX.length))}`, SOUND_KEYS.bump]
    : [`sfx-${kebabCase(cue.slice(LUCKY_HIT_PREFIX.length))}`];
}

function isBaseCue(cue: SoundCue): cue is BaseCue {
  return Object.hasOwn(SOUND_KEYS, cue);
}

// The first of the cue's keys that loaded, or undefined with none.
export function soundKeyFor(isLoaded: (key: string) => boolean, cue: SoundCue): string | undefined {
  return soundKeysOf(cue).find(isLoaded);
}

// The music plays at this fraction of the player's music volume while the player has paused the
// walk (the pause menu, Settings, Help, the Home question or a strip bubble).
export const PAUSED_MUSIC_DUCK = 0.3;

// At most this many plays of one effect start within the window, so a burst does not stack.
export const MAX_PLAYS_PER_WINDOW = 2;
export const PLAY_WINDOW_MS = 100;

// Each channel from 0 (silent) to 1 (full).
export interface Volumes {
  music: number;
  sfx: number;
}

export interface Mix {
  hidden: boolean;
  muted: boolean;
  paused: boolean;
  volumes: Volumes;
}

const FULL_VOLUMES: Volumes = { music: 1, sfx: 1 };

export const INITIAL_MIX: Mix = {
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
  return clamp01(volume);
}

// Channel volume times the master mute (silent while muted or hidden). While the player has
// paused, the music ducks to PAUSED_MUSIC_DUCK of its volume and the effects are silent.
export function effectiveVolumes(mix: Mix): Volumes {
  const master = mix.muted || mix.hidden ? 0 : 1;
  return {
    music: clampVolume(mix.volumes.music) * master * (mix.paused ? PAUSED_MUSIC_DUCK : 1),
    sfx: clampVolume(mix.volumes.sfx) * master * (mix.paused ? 0 : 1),
  };
}

// The start times of recent plays, per cue.
export type RecentPlays = Readonly<Partial<Record<SoundCue, readonly number[]>>>;

interface PlayDecision {
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
