import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../lib/rect";
import { DEFAULT_SETTINGS } from "../save/schema";
import { fitInFont, fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { closeFace } from "../ui/closeControl";
import {
  INSTALL_STEPS,
  INSTALL_STEPS_FIT,
  installStepsLayout,
  knobX,
  SETTINGS_ROW,
  settingsLayout,
  setVolumeSteps,
  type SliderTrack,
  SWITCH_NOTE_FIT,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "./settings";

const TRACK: SliderTrack = { knobWidth: 10, width: 216, x: 112 };

describe("the volume slider", () => {
  it("runs the knob end to end, reads each step back under the finger and holds past the ends", () => {
    expect(knobX(TRACK, 0)).toBe(112);
    expect(knobX(TRACK, 20)).toBe(112 + 216 - 10);
    for (let steps = 0; steps <= 20; steps++) {
      expect(volumeStepAt(TRACK, knobX(TRACK, steps) + TRACK.knobWidth / 2)).toBe(steps);
    }
    expect(volumeStepAt(TRACK, 0)).toBe(0);
    expect(volumeStepAt(TRACK, 400)).toBe(20);
  });

  it("sets and counts a volume in 5% steps, held within 0 and 1", () => {
    expect(setVolumeSteps("musicVolume", 3, DEFAULT_SETTINGS).musicVolume).toBeCloseTo(0.15);
    expect(setVolumeSteps("sfxVolume", 24, DEFAULT_SETTINGS).sfxVolume).toBe(1);
    expect(volumeSteps(0.85)).toBe(17);
  });
});

describe("volumeStepForKey", () => {
  it("steps the volume down and up by lane keys, stops at the ends, jumps with Home and End", () => {
    const cases: readonly [string, string[], number, number | undefined][] = [
      ["steps down, in either case", ["ArrowLeft", "a", "A", "h", "H"], 12, 11],
      ["steps up, in either case", ["ArrowRight", "d", "D", "l", "L"], 12, 13],
      ["stops at 0", ["ArrowLeft"], 0, 0],
      ["stops at the top", ["ArrowRight"], 20, 20],
      ["goes to 0", ["Home"], 12, 0],
      ["goes to 100%", ["End"], 12, 20],
      ["ignores the key", ["ArrowUp", "Enter"], 12, undefined],
    ];
    for (const [, keys, from, expected] of cases) {
      for (const key of keys) {
        expect(volumeStepForKey(key, from), key).toBe(expected);
      }
    }
  });
});

describe("settingsLayout", () => {
  const kinds = ["switch", "slider", "slider", "switch"] as const;

  // 2x capitals are 10 rows and body descenders 4 more; the knob is 16 tall over the track.
  it("fits every row's label, note, switch and slider inside the row", () => {
    for (const [i, kind] of kinds.map((kind, i) => [i, kind] as const)) {
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
        expect(face.dx + face.width).toBeLessThanOrEqual(row.width);
        expect(SETTINGS_ROW.labelDx + SETTINGS_ROW.switch.noteWidth).toBeLessThan(face.dx);
      } else {
        const { labelDy } = SETTINGS_ROW.slider;
        expect(labelDy + 10).toBeLessThan(layout.track.dy - 3);
        expect(layout.track.dy + layout.track.height + 3).toBeLessThanOrEqual(row.height);
      }
    }
  });
});

// The standard card: the title's capitals and the close control's face inside the title band,
// the close control's hit area on the card, and the rows starting 8px under the band.
describe("the settings card", () => {
  const layout = settingsLayout({ height: 560, width: 360 }, [
    "switch",
    "slider",
    "slider",
    "switch",
  ]);
  const { band, close, panel, rows, title } = layout;
  const bandBottom = band.y + band.height;
  const capHeight = fontFileMetrics("font-title").capHeight * 2;
  const face = closeFace(close);

  it.each<[string, Rect, Rect]>([
    ["the band", band, panel],
    ["the title's capitals", { height: capHeight, width: 0, x: title.x, y: title.y }, band],
    ["the close control's face", face, band],
    ["the close control's hit area", close.hit, panel],
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("centres the title on the card, and starts the rows 8px under the band", () => {
    expect(title.x).toBe(panel.x + panel.width / 2);
    expect(rows[0]?.y).toBe(bandBottom + 8);
  });
});

describe("a switch row's note", () => {
  const { noteLines, noteWidth } = SETTINGS_ROW.switch;
  const { motionNote, soundNote } = gameData.menuText.settings;

  it("sets every switch's note within its lines and width", () => {
    for (const note of [motionNote, soundNote]) {
      const fitted = fitInFont("font-body", SWITCH_NOTE_FIT.styles, SWITCH_NOTE_FIT.room, note);
      expect(fitted.lines.length).toBeLessThanOrEqual(noteLines);
      expect(fitted.widest).toBeLessThanOrEqual(noteWidth);
    }
  });
});

describe("the Install app row", () => {
  const kinds = ["switch", "slider", "slider", "switch", "button"] as const;
  const layout = settingsLayout(SCREEN_CONFIG, kinds);
  const row = layout.rows.at(-1) as Rect;
  const { iconDy, labelDy } = SETTINGS_ROW.button;
  const capHeight = fontFileMetrics("font-title").capHeight * 2;
  const screen: Rect = { ...SCREEN_CONFIG, x: 0, y: 0 };

  it.each<[string, Rect, Rect]>([
    ["the card with every row", layout.panel, screen],
    ["the row", row, layout.panel],
    ["the icon", { height: 16, width: 16, x: row.x + 6, y: row.y + iconDy }, row],
    ["the label's capitals", { height: capHeight, width: 0, x: row.x, y: row.y + labelDy }, row],
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("is a tap target at least 44 px each way, its icon and label centred down it", () => {
    expect(Math.min(row.height, row.width)).toBeGreaterThanOrEqual(44);
    expect(2 * iconDy + 16).toBe(row.height);
    expect(2 * labelDy + capHeight).toBe(row.height);
  });

  it("sets its label at 2x within the row", () => {
    const style = { letterSpacing: 0, scale: 2 };
    const label = inkWidth("font-title", style, gameData.menuText.settings.install);
    expect(SETTINGS_ROW.labelDx + label).toBeLessThanOrEqual(row.width - 6);
  });
});

describe("the iOS install steps' card", () => {
  const { installSteps, installStepsTitle } = gameData.menuText.settings;
  const { room, styles } = INSTALL_STEPS_FIT;
  const fitted = fitInFont("font-body", styles, room, installSteps);
  const { band, card, close, icon, steps, title } = installStepsLayout(
    SCREEN_CONFIG,
    fitted.lines.length,
  );
  const capHeight = fontFileMetrics("font-title").capHeight * 2;
  const body = fontFileMetrics("font-body");
  // From the first line's capitals to the last line's lowest ink, at 2x.
  const stepsHeight =
    (fitted.lines.length - 1) * INSTALL_STEPS.linePitch + (body.inkBottom - body.capTop) * 2;
  const titleWidth = inkWidth("font-title", { letterSpacing: 0, scale: 2 }, installStepsTitle);
  const screen: Rect = { ...SCREEN_CONFIG, x: 0, y: 0 };
  const { size } = INSTALL_STEPS.icon;
  const glyph: Rect = { height: size, width: size, ...icon };

  it("sets the steps at 2x within their lines and room", () => {
    expect(fitted.style.scale).toBe(2);
    expect(fitted.lines.length).toBeLessThanOrEqual(INSTALL_STEPS.lines);
    expect(fitted.widest).toBeLessThanOrEqual(room);
  });

  it.each<[string, Rect, Rect]>([
    ["the card", card, screen],
    ["the band", band, card],
    ["the title's capitals", { height: capHeight, width: 0, x: title.x, y: title.y }, band],
    ["the close control's face", closeFace(close), band],
    ["the close control's hit area", close.hit, card],
    ["the steps", { height: stepsHeight, width: room, x: steps.x, y: steps.y }, card],
    ["the Share glyph", glyph, card],
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("keeps the centred title clear of the close control, and the steps under the band", () => {
    expect(title.x + titleWidth / 2).toBeLessThan(closeFace(close).x);
    expect(steps.y).toBeGreaterThan(band.y + band.height);
  });

  it("centres the Share glyph on the first line's capitals, left of the steps", () => {
    expect(2 * (icon.y - steps.y) + size).toBe(body.capHeight * 2);
    expect(icon.x + size).toBeLessThan(steps.x);
    expect(glyph.y).toBeGreaterThan(band.y + band.height);
  });
});
