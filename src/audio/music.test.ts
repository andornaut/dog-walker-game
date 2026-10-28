import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import {
  advanceDeck,
  advanceMusic,
  FALLBACK_MUSIC_KEY,
  MUSIC_CROSS_FADE_MS,
  MUSIC_FADE_MS,
  MUSIC_STOPPED,
  type MusicDeck,
  musicKey,
  musicKeysOf,
  type MusicState,
  NO_MUSIC,
  playMusic,
  startMusic,
  stopAllMusic,
  stopMusic,
  trackVolume,
} from "./music";
import { INITIAL_MIX, type Mix, PAUSED_MUSIC_DUCK } from "./sound";

const fading = (
  level: number,
  toward: "playing" | "stopped",
  fadeMs = MUSIC_FADE_MS,
): MusicState => ({ fadeMs, kind: "fading", level, toward });
const PLAYING: MusicState = { kind: "playing" };
const FADE = MUSIC_FADE_MS;
const CROSS = MUSIC_CROSS_FADE_MS;

describe("musicKeysOf", () => {
  it("plays the zone's own loop, falling back to the walk loop", () => {
    expect(musicKeysOf({ art: "high-park" })).toEqual(["music-high-park", FALLBACK_MUSIC_KEY]);
  });

  it("gives every zone a loop of its own", () => {
    const keys = gameData.world.zones.map(musicKey);
    expect(new Set(keys).size).toBe(gameData.world.zones.length);
  });
});

describe("one loop's fade", () => {
  it.each<[string, MusicState, MusicState, MusicState]>([
    ["fades in from silence when started", MUSIC_STOPPED, fading(0, "playing"), MUSIC_STOPPED],
    [
      "ignores a start while playing, and fades out from full",
      PLAYING,
      PLAYING,
      fading(1, "stopped"),
    ],
    [
      "ignores a repeat of the fade it is in",
      fading(0.3, "playing"),
      fading(0.3, "playing"),
      fading(0.3, "stopped"),
    ],
    [
      "turns a fade-out around from its level",
      fading(0.4, "stopped"),
      fading(0.4, "playing"),
      fading(0.4, "stopped"),
    ],
  ])("%s", (_name, from, started, stopped) => {
    expect(startMusic(FADE, from)).toEqual(started);
    expect(stopMusic(FADE, from)).toEqual(stopped);
  });

  it.each<[string, MusicState, number, MusicState]>([
    ["fades in at a constant rate", fading(0, "playing", 1000), 500, fading(0.5, "playing", 1000)],
    ["settles playing at full", fading(0.5, "playing"), FADE / 2, PLAYING],
    ["fades out at a constant rate", fading(1, "stopped"), (FADE * 3) / 4, fading(0.25, "stopped")],
    ["settles stopped at silence", fading(0.25, "stopped"), FADE, MUSIC_STOPPED],
    ["holds while playing", PLAYING, 100, PLAYING],
    ["ignores negative time", fading(0.5, "playing"), -100, fading(0.5, "playing")],
  ])("%s", (_name, from, elapsedMs, expected) => {
    expect(advanceMusic(elapsedMs, from)).toEqual(expected);
  });
});

describe("the deck of loops", () => {
  const a = "music-a";
  const b = "music-b";

  it.each<[string, MusicDeck, string, MusicDeck]>([
    [
      "fades the first loop in from silence",
      NO_MUSIC,
      a,
      [{ key: a, state: fading(0, "playing") }],
    ],
    [
      "keeps the loop already playing",
      [{ key: a, state: PLAYING }],
      a,
      [{ key: a, state: PLAYING }],
    ],
    [
      "cross-fades from the loop playing to the next",
      [{ key: a, state: PLAYING }],
      b,
      [
        { key: a, state: fading(1, "stopped", CROSS) },
        { key: b, state: fading(0, "playing", CROSS) },
      ],
    ],
    [
      "turns a loop fading out back around mid cross-fade",
      [
        { key: a, state: fading(0.7, "stopped", CROSS) },
        { key: b, state: fading(0.3, "playing", CROSS) },
      ],
      a,
      [
        { key: b, state: fading(0.3, "stopped", CROSS) },
        { key: a, state: fading(0.7, "playing", CROSS) },
      ],
    ],
  ])("%s", (_name, deck, key, expected) => {
    expect(playMusic(key, deck)).toEqual(expected);
  });

  it("fades every loop out on a stop", () => {
    const deck: MusicDeck = [
      { key: a, state: fading(0.6, "stopped", CROSS) },
      { key: b, state: PLAYING },
    ];
    expect(stopAllMusic(deck)).toEqual([
      { key: a, state: fading(0.6, "stopped", CROSS) },
      { key: b, state: fading(1, "stopped") },
    ]);
  });

  it("drops a loop once it has faded out, and names it", () => {
    const crossing = playMusic(b, [{ key: a, state: PLAYING }]);
    expect(advanceDeck(CROSS / 2, crossing)).toEqual({
      deck: [
        { key: a, state: fading(0.5, "stopped", CROSS) },
        { key: b, state: fading(0.5, "playing", CROSS) },
      ],
      ended: [],
    });
    expect(advanceDeck(CROSS, crossing)).toEqual({
      deck: [{ key: b, state: PLAYING }],
      ended: [a],
    });
  });

  const mix = (overrides: Partial<Mix>): Mix => ({
    ...INITIAL_MIX,
    volumes: { music: 0.8, sfx: 1 },
    ...overrides,
  });

  // The effectiveVolumes tests cover the mix's pause, mute and hidden states; a loop scales the
  // mix's music volume by its fade.
  it("plays at the mix's music volume times the fade level", () => {
    const track = { key: a, state: fading(0.25, "stopped", CROSS) };
    expect(trackVolume(mix({ paused: true }), track)).toBeCloseTo(0.8 * 0.25 * PAUSED_MUSIC_DUCK);
  });
});
