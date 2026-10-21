import { describe, expect, it } from "vitest";

import {
  admitPlay,
  advanceMusic,
  clampVolume,
  effectiveVolumes,
  hitCue,
  INITIAL_MIX,
  MAX_PLAYS_PER_WINDOW,
  type Mix,
  MUSIC_FADE_MS,
  MUSIC_STOPPED,
  musicLevel,
  type MusicState,
  PAUSED_MUSIC_DUCK,
  PLAY_WINDOW_MS,
  type RecentPlays,
  type SoundCue,
  soundKeyFor,
  soundKeysOf,
  startMusic,
  stopMusic,
} from "./sound";

const mix = (overrides: Partial<Mix>): Mix => ({
  ...INITIAL_MIX,
  volumes: { music: 0.8, sfx: 0.6 },
  ...overrides,
});

const fading = (level: number, toward: "playing" | "stopped"): MusicState => ({
  kind: "fading",
  level,
  toward,
});
const PLAYING: MusicState = { kind: "playing" };

describe("soundKeysOf", () => {
  it.each<[string, SoundCue, string[]]>([
    ["plays a cue's own sound", "badge", ["sfx-badge"]],
    [
      "plays an encounter hit's own sound, falling back to the bump",
      hitCue("obstacle", "otherDog"),
      ["sfx-hit-other-dog", "sfx-bump"],
    ],
    ["plays the skunk hit's own sound", hitCue("obstacle", "skunk"), ["sfx-hit-skunk", "sfx-bump"]],
    [
      "plays a lucky hit's own sfx-<encounter>, with no bump in its place",
      hitCue("lucky", "lostWallet"),
      ["sfx-lost-wallet"],
    ],
  ])("%s", (_name, cue, expected) => {
    expect(soundKeysOf(cue)).toEqual(expected);
  });

  it("picks the first key that loaded, or none", () => {
    const loaded = (keys: string[]) => (key: string) => keys.includes(key);
    const hit = hitCue("obstacle", "puddle");
    expect(soundKeyFor(loaded(["sfx-hit-puddle", "sfx-bump"]), hit)).toBe("sfx-hit-puddle");
    expect(soundKeyFor(loaded(["sfx-bump"]), hit)).toBe("sfx-bump");
    expect(soundKeyFor(loaded([]), hit)).toBeUndefined();
    expect(soundKeyFor(loaded([]), "badge")).toBeUndefined();
  });
});

describe("clampVolume", () => {
  it.each([
    ["keeps a volume in range", 0.25, 0.25],
    ["raises a negative volume to 0", -1, 0],
    ["lowers a volume past 1 to 1", 3, 1],
    ["silences a volume that is not a number", Number.NaN, 0],
  ])("%s", (_name, volume, expected) => {
    expect(clampVolume(volume)).toBe(expected);
  });
});

describe("effectiveVolumes", () => {
  it.each<[string, Partial<Mix>, { music: number; sfx: number }]>([
    ["plays each channel at its own volume when nothing mutes it", {}, { music: 0.8, sfx: 0.6 }],
    ["mutes both channels while the app is hidden", { hidden: true }, { music: 0, sfx: 0 }],
    ["silences both channels while the player has muted", { muted: true }, { music: 0, sfx: 0 }],
    [
      "ducks the music and silences the effects while the player has paused",
      { paused: true },
      { music: 0.8 * PAUSED_MUSIC_DUCK, sfx: 0 },
    ],
    [
      "keeps a paused game silent while hidden",
      { hidden: true, paused: true },
      { music: 0, sfx: 0 },
    ],
    ["keeps a paused game silent while muted", { muted: true, paused: true }, { music: 0, sfx: 0 }],
    [
      "clamps channel volumes read from settings",
      { volumes: { music: 2, sfx: -0.5 } },
      { music: 1, sfx: 0 },
    ],
  ])("%s", (_name, overrides, expected) => {
    expect(effectiveVolumes(mix(overrides))).toEqual(expected);
  });
});

describe("music state machine", () => {
  it.each<[string, (state: MusicState) => MusicState, MusicState, MusicState]>([
    ["fades in from silence when started", startMusic, MUSIC_STOPPED, fading(0, "playing")],
    ["ignores a start while playing", startMusic, PLAYING, PLAYING],
    ["ignores a start while fading in", startMusic, fading(0.3, "playing"), fading(0.3, "playing")],
    ["fades out from full when stopped while playing", stopMusic, PLAYING, fading(1, "stopped")],
    ["ignores a stop while stopped", stopMusic, MUSIC_STOPPED, MUSIC_STOPPED],
    ["ignores a stop while fading out", stopMusic, fading(0.3, "stopped"), fading(0.3, "stopped")],
    [
      "turns a fade-out around from its level",
      startMusic,
      fading(0.4, "stopped"),
      fading(0.4, "playing"),
    ],
    [
      "turns a fade-in around from its level",
      stopMusic,
      fading(0.4, "playing"),
      fading(0.4, "stopped"),
    ],
  ])("%s", (_name, apply, from, expected) => {
    expect(apply(from)).toEqual(expected);
  });

  it("raises a fade-in at a constant rate until it is playing", () => {
    const halfway = advanceMusic(fading(0, "playing"), MUSIC_FADE_MS / 2);
    expect(halfway).toEqual(fading(0.5, "playing"));
    expect(advanceMusic(halfway, MUSIC_FADE_MS / 2)).toEqual(PLAYING);
  });

  it("lowers a fade-out until it is stopped", () => {
    const quarter = advanceMusic(fading(1, "stopped"), (MUSIC_FADE_MS * 3) / 4);
    expect(quarter).toEqual(fading(0.25, "stopped"));
    expect(advanceMusic(quarter, MUSIC_FADE_MS)).toEqual(MUSIC_STOPPED);
  });

  it("leaves a settled state and a negative step alone", () => {
    expect(advanceMusic(PLAYING, 100)).toEqual(PLAYING);
    expect(advanceMusic(MUSIC_STOPPED, 100)).toEqual(MUSIC_STOPPED);
    expect(advanceMusic(fading(0.5, "playing"), -100)).toEqual(fading(0.5, "playing"));
  });

  it("reports the gain of each state", () => {
    expect(musicLevel(MUSIC_STOPPED)).toBe(0);
    expect(musicLevel(PLAYING)).toBe(1);
    expect(musicLevel(fading(0.7, "stopped"))).toBe(0.7);
  });
});

describe("admitPlay", () => {
  const playAt = (recent: RecentPlays, times: number[]): boolean[] => {
    let current = recent;
    return times.map((nowMs) => {
      const { admitted, recent: next } = admitPlay(current, "tip", nowMs);
      current = next;
      return admitted;
    });
  };

  it("admits up to the limit within one window and rejects the rest", () => {
    const burst = Array.from({ length: MAX_PLAYS_PER_WINDOW + 2 }, () => 1000);
    const expected = burst.map((_, index) => index < MAX_PLAYS_PER_WINDOW);
    expect(playAt({}, burst)).toEqual(expected);
  });

  it("admits again once the earlier plays leave the window", () => {
    const burst = Array.from({ length: MAX_PLAYS_PER_WINDOW }, () => 1000);
    expect(playAt({}, [...burst, 1000 + PLAY_WINDOW_MS - 1, 1000 + PLAY_WINDOW_MS])).toEqual([
      ...burst.map(() => true),
      false,
      true,
    ]);
  });

  it("limits each cue separately", () => {
    const full: RecentPlays = { tip: Array.from({ length: MAX_PLAYS_PER_WINDOW }, () => 1000) };
    expect(admitPlay(full, "tip", 1000).admitted).toBe(false);
    expect(admitPlay(full, "treat", 1000).admitted).toBe(true);
  });

  it("forgets plays that have left the window", () => {
    expect(admitPlay({ tip: [0, 50] }, "tip", 120).recent).toEqual({ tip: [50, 120] });
  });
});
