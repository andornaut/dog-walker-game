import { describe, expect, it } from "vitest";

import {
  admitPlay,
  clampVolume,
  effectiveVolumes,
  hitCue,
  INITIAL_MIX,
  MAX_PLAYS_PER_WINDOW,
  type Mix,
  PAUSED_MUSIC_DUCK,
  PLAY_WINDOW_MS,
  type RecentPlays,
  type SoundCue,
  soundKeyFor,
  soundKeysOf,
  STAND_IN_SOUNDS,
} from "./sound";

const mix = (overrides: Partial<Mix>): Mix => ({
  ...INITIAL_MIX,
  volumes: { music: 0.8, sfx: 0.6 },
  ...overrides,
});

describe("soundKeysOf", () => {
  it("plays a cue's own sound, an obstacle hit's falling back to the bump", () => {
    const cases: [string, SoundCue, string[]][] = [
      ["plays a cue's own sound", "badge", ["sfx-badge"]],
      [
        "plays an encounter hit's own sound, falling back to the bump",
        hitCue("obstacle", "otherDog"),
        ["sfx-hit-other-dog", "sfx-bump"],
      ],
      [
        "plays the skunk hit's own sound",
        hitCue("obstacle", "skunk"),
        ["sfx-hit-skunk", "sfx-bump"],
      ],
    ];
    for (const [name, cue, expected] of cases) {
      expect(soundKeysOf(cue), name).toEqual(expected);
    }
  });

  it("plays a lucky hit's own sfx-<encounter> first, with no bump in its place", () => {
    const keys = soundKeysOf(hitCue("lucky", "lostWallet"));
    expect(keys[0]).toBe("sfx-lost-wallet");
    expect(keys).not.toContain("sfx-bump");
  });

  it("follows a key art has yet to draw with its stand-in", () => {
    const keys = soundKeysOf("dodge");
    const own = keys[0] ?? "";
    expect(keys).toEqual(Object.hasOwn(STAND_IN_SOUNDS, own) ? [own, STAND_IN_SOUNDS[own]] : [own]);
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

describe("effectiveVolumes", () => {
  it("mutes, ducks and clamps each channel as the mix says", () => {
    const cases: [string, Partial<Mix>, { music: number; sfx: number }][] = [
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
      [
        "keeps a paused game silent while muted",
        { muted: true, paused: true },
        { music: 0, sfx: 0 },
      ],
      [
        "clamps channel volumes read from settings",
        { volumes: { music: 2, sfx: -0.5 } },
        { music: 1, sfx: 0 },
      ],
    ];
    for (const [name, overrides, expected] of cases) {
      expect(effectiveVolumes(mix(overrides)), name).toEqual(expected);
    }
    expect(clampVolume(Number.NaN)).toBe(0);
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

  it("admits up to the limit within one window, and again once earlier plays leave it", () => {
    const burst = Array.from({ length: MAX_PLAYS_PER_WINDOW + 2 }, () => 1000);
    const expected = burst.map((_, index) => index < MAX_PLAYS_PER_WINDOW);
    expect(playAt({}, burst)).toEqual(expected);
    const full = burst.slice(0, MAX_PLAYS_PER_WINDOW);
    expect(playAt({}, [...full, 1000 + PLAY_WINDOW_MS - 1, 1000 + PLAY_WINDOW_MS])).toEqual([
      ...full.map(() => true),
      false,
      true,
    ]);
  });

  it("limits each cue separately", () => {
    const full: RecentPlays = { tip: Array.from({ length: MAX_PLAYS_PER_WINDOW }, () => 1000) };
    expect(admitPlay(full, "tip", 1000).admitted).toBe(false);
    expect(admitPlay(full, "treat", 1000).admitted).toBe(true);
    expect(admitPlay({ tip: [0, 50] }, "tip", 120).recent).toEqual({ tip: [50, 120] });
  });
});
