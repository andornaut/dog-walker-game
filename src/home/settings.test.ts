import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { fillLine } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { DEFAULT_SETTINGS } from "../save/schema";
import { fitInFont, fontFileMetrics, gameGlyphs, inkWidth, placedInk } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { SETTINGS_EXPORT_ROWS } from "../tools/layoutExport";
import { closeFace } from "../ui/closeControl";
import { fittingTextsAlike, type TextFitStyle } from "../ui/textFit";
import { MENU_TEXT_FIELDS } from "./menuText";
import {
  INSTALL_STEPS,
  INSTALL_STEPS_FIT,
  installStepsLayout,
  knobX,
  noteRoom,
  SETTINGS_NOTE_STYLES,
  SETTINGS_ROW,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  type SliderTrack,
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

// The rows as the scene builds them with the install row, each note fitted alike in its room
// from the shipped text.
const words = gameData.menuText.settings;
type ShippedRow =
  { kind: "button" | "switch"; label: string; note: string } | { kind: "slider"; label: string };
const SHIPPED_ROWS: readonly ShippedRow[] = [
  { kind: "switch", label: words.sound, note: words.soundNote },
  { kind: "slider", label: words.music },
  { kind: "slider", label: words.effects },
  { kind: "switch", label: words.motion, note: words.motionNote },
  { kind: "button", label: words.install, note: words.installNote },
];
const notedRows = SHIPPED_ROWS.flatMap((row) => (row.kind === "slider" ? [] : [row]));
const fittedNotes = fittingTextsAlike(
  SETTINGS_NOTE_STYLES,
  notedRows.map((row) => ({
    inkWidth: (style: TextFitStyle, line: string) => inkWidth("font-body", style, line),
    room: noteRoom(row.kind),
    text: row.note,
  })),
);
const shapes: SettingsRowShape[] = SHIPPED_ROWS.map((row) =>
  row.kind === "slider"
    ? { kind: "slider" }
    : { kind: row.kind, noteLines: fittedNotes[notedRows.indexOf(row)]?.lines.length ?? 0 },
);
const bodyFont = fontFileMetrics("font-body");
const titleFont = fontFileMetrics("font-title");
const layout = settingsLayout({ body: bodyFont, title: titleFont }, SCREEN_CONFIG, shapes);
const screen: Rect = { ...SCREEN_CONFIG, x: 0, y: 0 };
const TWO_X = { letterSpacing: 0, scale: 2 };
const KNOB_RISE = 3;
const KNOB_HEIGHT = 16;

// The rows below a line's top that text's glyphs ink, in a font at 2x.
function inkRows(font: string, text: string): { bottom: number; top: number } {
  const glyphs = [...text]
    .map((char) => gameGlyphs(font).get(char))
    .filter((glyph) => glyph !== undefined && glyph.height > 0);
  return {
    bottom: Math.max(...glyphs.map((glyph) => (glyph?.yOffset ?? 0) + (glyph?.height ?? 0))) * 2,
    top: Math.min(...glyphs.map((glyph) => glyph?.yOffset ?? 0)) * 2,
  };
}

// A label's ink from its capitals' top at y: its rows, and its columns from x.
function labelInk(font: string, text: string, x: number, y: number): Rect {
  const capTop = fontFileMetrics(font).capTop * 2;
  const rows = inkRows(font, text);
  const columns = placedInk(font, TWO_X, text);
  return {
    height: rows.bottom - rows.top,
    width: columns.right - columns.left,
    x: x + columns.left,
    y: y + rows.top - capTop,
  };
}

// Each row's parts as drawn: its label's, its note's, its control's and its track's ink.
function rowParts(i: number): [string, Rect][] {
  const row = SHIPPED_ROWS[i];
  const placed = layout.rows[i];
  if (row === undefined || placed === undefined) {
    throw new Error(`no row ${i}`);
  }
  const { rect } = placed;
  const { icon, label } = SETTINGS_ROW;
  const parts: [string, Rect][] = [
    ["icon", { height: 16, width: 16, x: rect.x + icon.dx, y: rect.y + icon.dy }],
    ["label", labelInk("font-title", row.label, rect.x + label.dx, rect.y + label.dy)],
  ];
  if (row.kind === "slider") {
    const { track } = layout;
    const percent = fillLine(MENU_TEXT_FIELDS.settings, words, "volume", { percent: "100" });
    const percentInk = labelInk("font-title", percent, 0, rect.y + label.dy);
    const right = track.x + track.width;
    return [
      ...parts,
      ["percentage", { ...percentInk, x: right - percentInk.width }],
      [
        "knob",
        { height: KNOB_HEIGHT, width: track.width, x: track.x, y: rect.y + track.dy - KNOB_RISE },
      ],
    ];
  }
  const fitted = fittedNotes[notedRows.indexOf(row)];
  const noteY = placed.noteY ?? 0;
  const lines = fitted?.lines ?? [];
  // A note line's rows run from its capitals to the font's lowest ink, descenders included.
  const noteInk = (line: string, n: number): Rect => {
    const columns = placedInk("font-body", TWO_X, line);
    return {
      height: (bodyFont.inkBottom - bodyFont.capTop) * 2,
      width: columns.right - columns.left,
      x: rect.x + SETTINGS_ROW.note.dx + columns.left,
      y: noteY + n * bodyFont.lineHeight * 2,
    };
  };
  return [
    ...parts,
    ...lines.map((line, n): [string, Rect] => [`note line ${n + 1}`, noteInk(line, n)]),
    ["control", placed.control ?? rect],
  ];
}

describe("the settings card", () => {
  const { band, close, panel, rows, title: titleAt } = layout;
  const bandBottom = band.y + band.height;
  const capHeight = titleFont.capHeight * 2;

  it("sets every note at 2x with the glyphs' own spacing, within its lines and room", () => {
    for (const [i, fitted] of fittedNotes.entries()) {
      const row = notedRows[i];
      expect(fitted.style).toMatchObject(TWO_X);
      expect(fitted.lines.length).toBeLessThanOrEqual(SETTINGS_ROW.note.lines);
      for (const line of fitted.lines) {
        expect(inkWidth("font-body", TWO_X, line)).toBeLessThanOrEqual(
          noteRoom(row?.kind ?? "switch"),
        );
      }
    }
  });

  it("exports the rows the shipped notes wrap to", () => {
    expect(SETTINGS_EXPORT_ROWS).toEqual(shapes);
  });

  it.each<[string, Rect, Rect]>([
    ["the card with every row", panel, screen],
    ["the band", band, panel],
    ["the title's capitals", { height: capHeight, width: 0, x: titleAt.x, y: titleAt.y }, band],
    ["the close control's face", closeFace(close), band],
    ["the close control's hit area", close.hit, panel],
    ...rows.map(({ rect }, i): [string, Rect, Rect] => [`row ${i + 1}`, rect, panel]),
    ...rows.flatMap(({ rect }, i) =>
      rowParts(i).map(([part, ink]): [string, Rect, Rect] => [`row ${i + 1}'s ${part}`, ink, rect]),
    ),
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("centres the title on the card, and starts the rows 8px under the band", () => {
    expect(titleAt.x).toBe(panel.x + panel.width / 2);
    expect(rows[0]?.rect.y).toBe(bandBottom + 8);
  });

  it.each(SHIPPED_ROWS.map((row, i) => [row.label, i] as const))(
    "makes the %s row a tap target at least 44 px each way",
    (_, i) => {
      const rect = rows[i]?.rect;
      expect(Math.min(rect?.height ?? 0, rect?.width ?? 0)).toBeGreaterThanOrEqual(44);
    },
  );

  // The row's parts in reading order: nothing overlaps, and the label's line and the note's
  // lines run left of the control or the percentage.
  it.each(SHIPPED_ROWS.map((row, i) => [row.label, i] as const))(
    "keeps the %s row's parts apart",
    (_, i) => {
      const parts = new Map(rowParts(i));
      const control = parts.get("control") ?? parts.get("percentage");
      for (const [name, ink] of parts) {
        if (name.startsWith("note") || name === "label") {
          expect(ink.x + ink.width, name).toBeLessThan(control?.x ?? 0);
        }
      }
      const label = parts.get("label");
      const below = parts.get("note line 1") ?? parts.get("knob");
      expect((label?.y ?? 0) + (label?.height ?? 0)).toBeLessThan(below?.y ?? 0);
    },
  );

  it.each(notedRows.map((row) => [row.label, SHIPPED_ROWS.indexOf(row)] as const))(
    "leaves 10 clear rows between the %s label's lowest ink and its note's capitals",
    (_, i) => {
      const parts = new Map(rowParts(i));
      const label = parts.get("label");
      const noteCaps = layout.rows[i]?.noteY ?? 0;
      expect(noteCaps - ((label?.y ?? 0) + (label?.height ?? 0))).toBe(10);
    },
  );

  // Centred within a pixel down from the label's top to the note's lowest ink.
  it.each(notedRows.map((row) => [row.label, SHIPPED_ROWS.indexOf(row)] as const))(
    "centres the %s row's control on its label and note",
    (_, i) => {
      const parts = rowParts(i);
      const control = new Map(parts).get("control");
      const inks = parts.filter(([name]) => name === "label" || name.startsWith("note"));
      const top = Math.min(...inks.map(([, ink]) => ink.y));
      const bottom = Math.max(...inks.map(([, ink]) => ink.y + ink.height));
      const above = (control?.y ?? 0) - top;
      const under = bottom - (control?.y ?? 0) - (control?.height ?? 0);
      expect(Math.abs(above - under)).toBeLessThanOrEqual(1);
    },
  );

  it("sets the install button's label at 2x within its face", () => {
    const control = layout.rows.at(-1)?.control;
    expect(inkWidth("font-title", TWO_X, words.installButton)).toBeLessThan(
      (control?.width ?? 0) - 8,
    );
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
