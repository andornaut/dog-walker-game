import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../save/schema";
import { soundVolumes, stepVolume, volumeSteps } from "./settings";

describe("stepVolume", () => {
  it("moves one volume by a tenth and leaves the rest alone", () => {
    const louder = stepVolume("musicVolume", 1, { ...DEFAULT_SETTINGS, musicVolume: 0.6 });
    expect(louder).toEqual({ ...DEFAULT_SETTINGS, musicVolume: 0.7 });
  });

  it("holds within 0 and 1", () => {
    expect(stepVolume("sfxVolume", 1, { ...DEFAULT_SETTINGS, sfxVolume: 1 }).sfxVolume).toBe(1);
    expect(stepVolume("sfxVolume", -1, { ...DEFAULT_SETTINGS, sfxVolume: 0 }).sfxVolume).toBe(0);
  });

  it("snaps an off-step volume to the nearest step first", () => {
    expect(
      stepVolume("musicVolume", -1, { ...DEFAULT_SETTINGS, musicVolume: 0.33 }).musicVolume,
    ).toBe(0.2);
  });
});

describe("volumeSteps", () => {
  it("counts the volume in tenths", () => {
    expect(volumeSteps(0)).toBe(0);
    expect(volumeSteps(0.8)).toBe(8);
    expect(volumeSteps(1)).toBe(10);
  });
});

describe("soundVolumes", () => {
  it("maps the saved volumes onto the soundboard's channels", () => {
    expect(soundVolumes({ ...DEFAULT_SETTINGS, musicVolume: 0.2, sfxVolume: 0.9 })).toEqual({
      music: 0.2,
      sfx: 0.9,
    });
  });
});
