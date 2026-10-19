import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../save/schema";
import {
  knobX,
  settingsLayout,
  setVolumeSteps,
  type SliderTrack,
  soundVolumes,
  volumePercent,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "./settings";

const TRACK: SliderTrack = { knobWidth: 10, width: 216, x: 112 };

describe("knobX and volumeStepAt", () => {
  it("runs the knob from the track's left edge to its right edge", () => {
    expect(knobX(TRACK, 0)).toBe(112);
    expect(knobX(TRACK, 20)).toBe(112 + 216 - 10);
  });

  it("reads each step back with the knob's centre under the finger", () => {
    for (let steps = 0; steps <= 20; steps++) {
      expect(volumeStepAt(TRACK, knobX(TRACK, steps) + TRACK.knobWidth / 2)).toBe(steps);
    }
  });

  it("holds to the ends past either end of the track", () => {
    expect(volumeStepAt(TRACK, 0)).toBe(0);
    expect(volumeStepAt(TRACK, 400)).toBe(20);
  });
});

describe("setVolumeSteps", () => {
  it("sets one volume in 5% steps, held within 0 and 1", () => {
    expect(setVolumeSteps("musicVolume", 3, DEFAULT_SETTINGS).musicVolume).toBeCloseTo(0.15);
    expect(setVolumeSteps("sfxVolume", 24, DEFAULT_SETTINGS).sfxVolume).toBe(1);
  });
});

describe("volumeSteps", () => {
  it("counts the volume in 5% steps", () => {
    expect(volumeSteps(0)).toBe(0);
    expect(volumeSteps(0.6)).toBe(12);
    expect(volumeSteps(0.85)).toBe(17);
    expect(volumeSteps(1)).toBe(20);
  });
});

describe("volumePercent", () => {
  it("reads a step count as a percentage", () => {
    expect(volumePercent(0)).toBe(0);
    expect(volumePercent(13)).toBe(65);
    expect(volumePercent(20)).toBe(100);
  });
});

describe("volumeStepForKey", () => {
  it.each<[string, string[], number, number | undefined]>([
    ["steps down, in either case", ["ArrowLeft", "a", "A", "h", "H"], 12, 11],
    ["steps up, in either case", ["ArrowRight", "d", "D", "l", "L"], 12, 13],
    ["stops at 0", ["ArrowLeft"], 0, 0],
    ["stops at the top", ["ArrowRight"], 20, 20],
    ["goes to 0", ["Home"], 12, 0],
    ["goes to 100%", ["End"], 12, 20],
    ["ignores the key", ["ArrowUp", "Enter"], 12, undefined],
  ])("%s on %j from step %i", (_name, keys, from, expected) => {
    for (const key of keys) {
      expect(volumeStepForKey(key, from), key).toBe(expected);
    }
  });
});

describe("settingsLayout", () => {
  it("centres the panel on the screen, its rows, title and Back inside it", () => {
    const layout = settingsLayout({ height: 560, width: 360 });
    expect(layout.panel).toEqual({ height: 276, width: 248, x: 56, y: 142 });
    expect(layout.row).toEqual({ height: 44, width: 232, x: 64, y: 180 });
    expect(layout.title).toEqual({ x: 180, y: 158 });
    expect(layout.track.x).toBe(72);
    expect(layout.back).toEqual({ height: 40, width: 200, x: 80, y: 364 });
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
