// The walk's music: which loop each neighbourhood plays, and the fades between loops. No Phaser
// here: the soundboard in src/scenes/ applies these to the sound manager.

import type { Zone } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { effectiveVolumes, type Mix } from "./sound";

// CLEANUP (added 2026-10-27): the single walk loop each zone plays until its own loads. Remove
// it, and its manifest sound, once all six zone loops are in the manifest.
export const FALLBACK_MUSIC_KEY = "music-walk";

// A fade between silence and full volume as a walk starts or ends.
export const MUSIC_FADE_MS = 500;

// The fade out of one zone's loop and into the next at the next zone's banner.
export const MUSIC_CROSS_FADE_MS = 1000;

// Zone music is keyed by the zone's art, as its backdrop is: music-high-park and so on.
export function musicKey(zone: Pick<Zone, "art">): string {
  return `music-${zone.art}`;
}

// The keys a zone may play, in preference order.
export function musicKeysOf(zone: Pick<Zone, "art">): readonly string[] {
  return [musicKey(zone), FALLBACK_MUSIC_KEY];
}

// level is the fade's current gain, from 0 (silent) to 1 (full); a fade moves the whole way in
// fadeMs.
export type MusicState =
  | { fadeMs: number; kind: "fading"; level: number; toward: "playing" | "stopped" }
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
export function startMusic(fadeMs: number, state: MusicState): MusicState {
  if (state.kind === "playing" || (state.kind === "fading" && state.toward === "playing")) {
    return state;
  }
  return { fadeMs, kind: "fading", level: musicLevel(state), toward: "playing" };
}

export function stopMusic(fadeMs: number, state: MusicState): MusicState {
  if (state.kind === "stopped" || (state.kind === "fading" && state.toward === "stopped")) {
    return state;
  }
  return { fadeMs, kind: "fading", level: musicLevel(state), toward: "stopped" };
}

// Moves a fade at a constant rate, so reversing halfway takes half a fade to undo.
export function advanceMusic(elapsedMs: number, state: MusicState): MusicState {
  if (state.kind !== "fading") {
    return state;
  }
  const step = Math.max(0, elapsedMs) / state.fadeMs;
  if (state.toward === "playing") {
    const level = state.level + step;
    return level >= 1 ? { kind: "playing" } : { ...state, level };
  }
  const level = state.level - step;
  return level <= 0 ? MUSIC_STOPPED : { ...state, level };
}

// One loop and its fade.
export interface MusicTrack {
  key: string;
  state: MusicState;
}

// The loops playing or fading out, at most one of them fading in or playing. A loop leaves once
// it has faded out.
export type MusicDeck = readonly MusicTrack[];

export const NO_MUSIC: MusicDeck = [];

// Fades key's loop in and every other loop out: a cross-fade when another loop is sounding,
// else a fade in from silence. Playing the loop already playing changes nothing.
export function playMusic(key: string, deck: MusicDeck): MusicDeck {
  const others = deck.filter((track) => track.key !== key);
  const fadeMs = others.length > 0 ? MUSIC_CROSS_FADE_MS : MUSIC_FADE_MS;
  const own = deck.find((track) => track.key === key)?.state ?? MUSIC_STOPPED;
  return [
    ...others.map((track) => ({ key: track.key, state: stopMusic(fadeMs, track.state) })),
    { key, state: startMusic(fadeMs, own) },
  ];
}

export function stopAllMusic(deck: MusicDeck): MusicDeck {
  return deck.map((track) => ({ key: track.key, state: stopMusic(MUSIC_FADE_MS, track.state) }));
}

interface AdvancedDeck {
  deck: MusicDeck;
  // The keys whose loops faded out this step, for the soundboard to stop.
  ended: readonly string[];
}

export function advanceDeck(elapsedMs: number, deck: MusicDeck): AdvancedDeck {
  const advanced = deck.map((track) => ({
    key: track.key,
    state: advanceMusic(elapsedMs, track.state),
  }));
  return {
    deck: advanced.filter((track) => track.state.kind !== "stopped"),
    ended: advanced.filter((track) => track.state.kind === "stopped").map(({ key }) => key),
  };
}

// Each loop's volume: the mix's music volume (ducked under a pause, silent while muted or
// hidden) times the loop's fade level.
export function trackVolume(mix: Mix, track: MusicTrack): number {
  return effectiveVolumes(mix).music * musicLevel(track.state);
}
