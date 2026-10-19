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

describe("volumeStepAt", () => {
  it("puts the knob's centre under the finger", () => {
    expect(volumeStepAt(TRACK, 112 + 5)).toBe(0);
    expect(volumeStepAt(TRACK, 112 + 5 + 103)).toBe(10);
    expect(volumeStepAt(TRACK, 112 + 216 - 5)).toBe(20);
  });

  it("holds to the ends past either end of the track", () => {
    expect(volumeStepAt(TRACK, 0)).toBe(0);
    expect(volumeStepAt(TRACK, 400)).toBe(20);
  });
});

describe("knobX", () => {
  it("runs the knob from the track's left edge to its right edge", () => {
    expect(knobX(TRACK, 0)).toBe(112);
    expect(knobX(TRACK, 20)).toBe(112 + 216 - 10);
  });

  it("is where volumeStepAt reads the same step back", () => {
    for (let steps = 0; steps <= 20; steps++) {
      expect(volumeStepAt(TRACK, knobX(TRACK, steps) + TRACK.knobWidth / 2)).toBe(steps);
    }
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
  it("steps down with Left, A and H, and up with Right, D and L, in either case", () => {
    for (const key of ["ArrowLeft", "a", "A", "h", "H"]) {
      expect(volumeStepForKey(key, 12)).toBe(11);
    }
    for (const key of ["ArrowRight", "d", "D", "l", "L"]) {
      expect(volumeStepForKey(key, 12)).toBe(13);
    }
  });

  it("stops at 0 and the top", () => {
    expect(volumeStepForKey("ArrowLeft", 0)).toBe(0);
    expect(volumeStepForKey("ArrowRight", 20)).toBe(20);
  });

  it("goes to 0 with Home and to 100% with End", () => {
    expect(volumeStepForKey("Home", 12)).toBe(0);
    expect(volumeStepForKey("End", 12)).toBe(20);
  });

  it("ignores every other key", () => {
    expect(volumeStepForKey("ArrowUp", 12)).toBeUndefined();
    expect(volumeStepForKey("Enter", 12)).toBeUndefined();
  });
});

describe("settingsLayout", () => {
  it("centres the panel on the home screen", () => {
    const layout = settingsLayout(360, "home");
    expect(layout.panel).toEqual({ height: 276, width: 248, x: 56, y: 277 });
    expect(layout.row.x).toBe(64);
    expect(layout.title.x).toBe(180);
    expect(layout.track.x).toBe(72);
    expect(layout.back.x).toBe(80);
  });

  it("keeps the menus mock's x over the road", () => {
    const layout = settingsLayout(360, "road");
    expect(layout.panel.x).toBe(96);
    expect(layout.row.x).toBe(104);
    expect(layout.title.x).toBe(220);
    expect(layout.track.x).toBe(112);
    expect(layout.back.x).toBe(120);
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
