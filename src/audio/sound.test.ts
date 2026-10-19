import { describe, expect, it } from "vitest";

import {
  admitPlay,
  advanceMusic,
  CARD_OPEN_MUSIC_DUCK,
  clampVolume,
  effectiveVolumes,
  hitCue,
  INITIAL_MIX,
  MAX_PLAYS_PER_WINDOW,
  type Mix,
  MUSIC_FADE_MS,
  MUSIC_KEY,
  MUSIC_STOPPED,
  musicLevel,
  type MusicState,
  PLAY_WINDOW_MS,
  type RecentPlays,
  SOUND_KEYS,
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

describe("SOUND_KEYS", () => {
  it("maps each cue to the art agent's manifest key", () => {
    expect(SOUND_KEYS).toEqual({
      badge: "sfx-badge",
      bark: "sfx-bark",
      bump: "sfx-bump",
      cardOpen: "sfx-card",
      fired: "sfx-fired",
      newBest: "sfx-new-best",
      tip: "sfx-tip",
      treat: "sfx-treat",
    });
    expect(MUSIC_KEY).toBe("music-walk");
  });
});

describe("soundKeysOf", () => {
  it("plays an encounter hit's own sound, falling back to the bump", () => {
    expect(soundKeysOf(hitCue("otherDog"))).toEqual(["sfx-hit-other-dog", "sfx-bump"]);
    expect(soundKeysOf(hitCue("skunk"))).toEqual(["sfx-hit-skunk", "sfx-bump"]);
    expect(soundKeysOf("badge")).toEqual(["sfx-badge"]);
  });

  it("picks the first key that loaded, or none", () => {
    const loaded = (keys: string[]) => (key: string) => keys.includes(key);
    const hit = hitCue("puddle");
    expect(soundKeyFor(loaded(["sfx-hit-puddle", "sfx-bump"]), hit)).toBe("sfx-hit-puddle");
    expect(soundKeyFor(loaded(["sfx-bump"]), hit)).toBe("sfx-bump");
    expect(soundKeyFor(loaded([]), hit)).toBeUndefined();
    expect(soundKeyFor(loaded([]), "badge")).toBeUndefined();
  });
});

describe("clampVolume", () => {
  it("keeps a volume between 0 and 1", () => {
    expect(clampVolume(0.25)).toBe(0.25);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(3)).toBe(1);
  });

  it("silences a volume that is not a number", () => {
    expect(clampVolume(Number.NaN)).toBe(0);
  });
});

describe("effectiveVolumes", () => {
  it("plays each channel at its own volume when nothing mutes it", () => {
    expect(effectiveVolumes(mix({}))).toEqual({ music: 0.8, sfx: 0.6 });
  });

  it("mutes both channels while the app is hidden", () => {
    expect(effectiveVolumes(mix({ hidden: true }))).toEqual({ music: 0, sfx: 0 });
  });

  it("silences both channels while the player has muted", () => {
    expect(effectiveVolumes(mix({ muted: true }))).toEqual({ music: 0, sfx: 0 });
  });

  it("mutes both channels while the game is paused", () => {
    expect(effectiveVolumes(mix({ paused: true }))).toEqual({ music: 0, sfx: 0 });
  });

  it("ducks only the music while a card is open", () => {
    expect(effectiveVolumes(mix({ cardOpen: true }))).toEqual({
      music: 0.8 * CARD_OPEN_MUSIC_DUCK,
      sfx: 0.6,
    });
  });

  it("clamps channel volumes read from settings", () => {
    expect(effectiveVolumes(mix({ volumes: { music: 2, sfx: -0.5 } }))).toEqual({
      music: 1,
      sfx: 0,
    });
  });
});

describe("music state machine", () => {
  it("fades in from silence when started", () => {
    expect(startMusic(MUSIC_STOPPED)).toEqual(fading(0, "playing"));
  });

  it("ignores a start while already playing or fading in", () => {
    expect(startMusic({ kind: "playing" })).toEqual({ kind: "playing" });
    expect(startMusic(fading(0.3, "playing"))).toEqual(fading(0.3, "playing"));
  });

  it("fades out from full when stopped while playing", () => {
    expect(stopMusic({ kind: "playing" })).toEqual(fading(1, "stopped"));
  });

  it("ignores a stop while already stopped or fading out", () => {
    expect(stopMusic(MUSIC_STOPPED)).toEqual(MUSIC_STOPPED);
    expect(stopMusic(fading(0.3, "stopped"))).toEqual(fading(0.3, "stopped"));
  });

  it("turns a fade around from its current level", () => {
    expect(startMusic(fading(0.4, "stopped"))).toEqual(fading(0.4, "playing"));
    expect(stopMusic(fading(0.4, "playing"))).toEqual(fading(0.4, "stopped"));
  });

  it("raises a fade-in at a constant rate until it is playing", () => {
    const halfway = advanceMusic(fading(0, "playing"), MUSIC_FADE_MS / 2);
    expect(halfway).toEqual(fading(0.5, "playing"));
    expect(advanceMusic(halfway, MUSIC_FADE_MS / 2)).toEqual({ kind: "playing" });
  });

  it("lowers a fade-out until it is stopped", () => {
    const quarter = advanceMusic(fading(1, "stopped"), (MUSIC_FADE_MS * 3) / 4);
    expect(quarter).toEqual(fading(0.25, "stopped"));
    expect(advanceMusic(quarter, MUSIC_FADE_MS)).toEqual(MUSIC_STOPPED);
  });

  it("leaves a settled state and a negative step alone", () => {
    expect(advanceMusic({ kind: "playing" }, 100)).toEqual({ kind: "playing" });
    expect(advanceMusic(MUSIC_STOPPED, 100)).toEqual(MUSIC_STOPPED);
    expect(advanceMusic(fading(0.5, "playing"), -100)).toEqual(fading(0.5, "playing"));
  });

  it("reports the gain of each state", () => {
    expect(musicLevel(MUSIC_STOPPED)).toBe(0);
    expect(musicLevel({ kind: "playing" })).toBe(1);
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
