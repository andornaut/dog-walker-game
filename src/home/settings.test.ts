import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../save/schema";
import {
  knobX,
  setVolumeSteps,
  type SliderTrack,
  soundVolumes,
  volumeStepAt,
  volumeSteps,
} from "./settings";

const TRACK: SliderTrack = { knobWidth: 10, width: 216, x: 112 };

describe("volumeStepAt", () => {
  it("puts the knob's centre under the finger", () => {
    expect(volumeStepAt(TRACK, 112 + 5)).toBe(0);
    expect(volumeStepAt(TRACK, 112 + 5 + 103)).toBe(5);
    expect(volumeStepAt(TRACK, 112 + 216 - 5)).toBe(10);
  });

  it("holds to the ends past either end of the track", () => {
    expect(volumeStepAt(TRACK, 0)).toBe(0);
    expect(volumeStepAt(TRACK, 400)).toBe(10);
  });
});

describe("knobX", () => {
  it("runs the knob from the track's left edge to its right edge", () => {
    expect(knobX(TRACK, 0)).toBe(112);
    expect(knobX(TRACK, 10)).toBe(112 + 216 - 10);
  });

  it("is where volumeStepAt reads the same step back", () => {
    for (let steps = 0; steps <= 10; steps++) {
      expect(volumeStepAt(TRACK, knobX(TRACK, steps) + TRACK.knobWidth / 2)).toBe(steps);
    }
  });
});

describe("setVolumeSteps", () => {
  it("sets one volume in tenths, held within 0 and 1", () => {
    expect(setVolumeSteps("musicVolume", 3, DEFAULT_SETTINGS).musicVolume).toBe(0.3);
    expect(setVolumeSteps("sfxVolume", 12, DEFAULT_SETTINGS).sfxVolume).toBe(1);
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
