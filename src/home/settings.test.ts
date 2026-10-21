import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEFAULT_SETTINGS } from "../save/schema";
import { fitInFont } from "../testing/fontInk";
import {
  knobX,
  SETTINGS_ROW,
  settingsLayout,
  setVolumeSteps,
  type SliderTrack,
  soundVolumes,
  SWITCH_NOTE_FIT,
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
  const kinds = ["switch", "slider", "slider", "switch"] as const;

  it("centres the panel on the screen with its rows and title, and closes from the corner", () => {
    const layout = settingsLayout({ height: 560, width: 360 }, kinds);
    expect(layout.panel).toEqual({ height: 258, width: 248, x: 56, y: 151 });
    expect(layout.rows.map((row) => [row.y, row.height])).toEqual([
      [189, 62],
      [251, 44],
      [295, 44],
      [339, 62],
    ]);
    expect(layout.title).toEqual({ x: 180, y: 167 });
    expect(layout.track.x).toBe(72);
    expect(layout.close.hit).toEqual({ height: 44, width: 44, x: 316, y: 0 });
  });

  // 2x capitals are 10 rows and body descenders 4 more; the knob is 16 tall over the track.
  it.each(kinds.map((kind, i) => [i, kind] as const))("fits row %i's %s parts", (i, kind) => {
    const layout = settingsLayout({ height: 560, width: 360 }, kinds);
    const row = layout.rows[i];
    if (row === undefined) {
      throw new Error("no row");
    }
    if (kind === "switch") {
      const { labelDy, linePitch, noteDy, switch: face } = SETTINGS_ROW.switch;
      expect(labelDy + 10).toBeLessThan(noteDy);
      expect(noteDy + linePitch + 14).toBeLessThanOrEqual(row.height);
      expect(face.dy + face.height).toBeLessThanOrEqual(row.height);
      expect(SETTINGS_ROW.labelDx + SETTINGS_ROW.switch.noteWidth).toBeLessThan(face.dx);
    } else {
      const { labelDy } = SETTINGS_ROW.slider;
      expect(labelDy + 10).toBeLessThan(layout.track.dy - 3);
      expect(layout.track.dy + layout.track.height + 3).toBeLessThanOrEqual(row.height);
    }
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

describe("a switch row's note", () => {
  const { noteLines, noteWidth } = SETTINGS_ROW.switch;
  const { motionNote, soundNote } = gameData.menuText.settings;

  it.each([
    ["motionNote", motionNote],
    ["soundNote", soundNote],
  ])("sets %s on at most noteLines lines within noteWidth", (_, note) => {
    const fitted = fitInFont("font-body", SWITCH_NOTE_FIT.styles, SWITCH_NOTE_FIT.room, note);
    expect(fitted.lines.length).toBeLessThanOrEqual(noteLines);
    expect(fitted.widest).toBeLessThanOrEqual(noteWidth);
  });
});
