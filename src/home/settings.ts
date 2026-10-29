import { laneDirectionForKey } from "../input/keyBindings";
import { clamp01 } from "../lib/numbers";
import type { Rect } from "../lib/rect";
import type { Settings } from "../save/schema";
import { type CloseControl, closeControl } from "../ui/closeControl";
import { type FontMetrics, helpCapDy, inkRowsOfLines, LABEL_HELP_GAP } from "../ui/fontMetrics";
import { TEXT_SCALE, textOnLines } from "../ui/textFit";
import { cardBand, HOME_LAYOUT } from "./homeLayout";

// The settings screen moves a volume in 5% steps, from 0 to 1.
export const VOLUME_STEPS = 20;

export type VolumeKey = "musicVolume" | "sfxVolume";

// The volume as a whole number of steps, from 0 to VOLUME_STEPS.
export function volumeSteps(volume: number): number {
  return Math.min(VOLUME_STEPS, Math.max(0, Math.round(volume * VOLUME_STEPS)));
}

// A volume slider's track, in screen pixels, and the width of the knob that slides along it.
export interface SliderTrack {
  knobWidth: number;
  width: number;
  x: number;
}

// The step a finger at x picks: the knob's centre follows the finger, held to the track.
export function volumeStepAt(track: SliderTrack, x: number): number {
  const fraction = (x - track.x - track.knobWidth / 2) / (track.width - track.knobWidth);
  return Math.round(clamp01(fraction) * VOLUME_STEPS);
}

// The knob's left edge at a step.
export function knobX(track: SliderTrack, steps: number): number {
  return track.x + Math.round(((track.width - track.knobWidth) * steps) / VOLUME_STEPS);
}

export function volumePercent(steps: number): number {
  return Math.round((steps * 100) / VOLUME_STEPS);
}

// The step a key moves a focused slider to: the arrows, A/D and H/L one step down or up,
// Home to 0 and End to the top. Undefined for any other key.
export function volumeStepForKey(key: string, steps: number): number | undefined {
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return VOLUME_STEPS;
  }
  const direction = laneDirectionForKey(key);
  return direction === undefined
    ? undefined
    : Math.min(VOLUME_STEPS, Math.max(0, steps + direction));
}

export function setVolumeSteps(key: VolumeKey, steps: number, settings: Settings): Settings {
  return { ...settings, [key]: Math.min(VOLUME_STEPS, Math.max(0, steps)) / VOLUME_STEPS };
}

// The soundboard's volumes from the saved settings.
export function soundVolumes(settings: Settings): { music: number; sfx: number } {
  return { music: settings.musicVolume, sfx: settings.sfxVolume };
}

export type SettingsRowKind = "button" | "slider" | "switch";

// A row as the layout needs it: its kind and, for a switch or button row, how many lines its
// note wraps onto.
export type SettingsRowShape =
  { kind: "button" | "switch"; noteLines: number } | { kind: "slider" };

export interface SettingsRowLayout {
  // The switch's or the button's face, or null on a slider row.
  control: Rect | null;
  // The note's first line's capitals' top, or null on a slider row.
  noteY: number | null;
  rect: Rect;
}

export interface SettingsLayout {
  // The title band across the card's top, its title placed beside the close control
  // (barTitleLeft).
  band: Rect;
  // The build label's capitals' top; the label is centred across the panel.
  buildLabelY: number;
  close: CloseControl;
  panel: Rect;
  // The rows, top to bottom.
  rows: SettingsRowLayout[];
  // A tan rule along the top of every row after the first, SEPARATOR_INSET in from its sides.
  separators: Rect[];
  track: SliderTrack & { dy: number; height: number };
}

// The fonts a settings row's height and its note's place follow.
export interface SettingsFonts {
  body: FontMetrics;
  title: FontMetrics;
}

// Offsets from a row's top-left corner, every text at 2x. Each row has its 16x16 icon 3px above
// its title-font label's capitals. A switch or button row has its note under them in body text,
// LABEL_HELP_GAP clear rows under the label font's lowest ink (helpCapDy), from the icon's
// column, wrapped onto up to note.lines lines, and inkFoot rows under the note's lowest ink.
// Its control sits pad in from the row's right, centred down from the label's capitals to the
// note's lowest ink. A slider row is slider.height tall, with its percentage on the label's
// line, ending pad in from the row's right, and its track under them, pad in from either side.
export const SETTINGS_ROW = {
  button: { height: 24, width: 80 },
  // Between a note's room and the control beside it.
  controlGap: 10,
  icon: { dx: 6, dy: 9 },
  inkFoot: 14,
  label: { dx: 26, dy: 12 },
  note: { dx: 6, lines: 2 },
  pad: 8,
  slider: { height: 56 },
  switch: { height: 16, width: 32 },
  track: { dy: 30, height: 10, knobWidth: 10 },
  width: 328,
} as const;

// The room a switch or button row's note wraps in: from the icon's column to controlGap short
// of its control.
export function noteRoom(kind: "button" | "switch"): number {
  const { controlGap, note, pad, width } = SETTINGS_ROW;
  return width - pad - SETTINGS_ROW[kind].width - controlGap - note.dx;
}

// A note: at 2x, wrapped onto up to note.lines lines.
export const SETTINGS_NOTE_STYLE = textOnLines(SETTINGS_ROW.note.lines);

// The note's first line's capitals' top, from the row's top, under its title-font label.
export function noteDy(title: FontMetrics): number {
  return SETTINGS_ROW.label.dy + helpCapDy(title, TEXT_SCALE);
}

const PANEL = { width: 344 };
// The first row starts at the band's bottom edge, as each later row starts at its separator, so
// its icon and label are as far under the band as a later row's are under its separator.
const ROWS_TOP = HOME_LAYOUT.card.band.inset + HOME_LAYOUT.card.band.height;
const SEPARATOR_INSET = 4;

// The build label (BUILD_LABEL) closes the card in 1x dark brown body text, centred across the
// panel with no separator over it: its capitals LABEL_HELP_GAP clear rows under the last row's
// lowest ink, as a note sits under its label, and its lowest ink BUILD_LABEL_FOOT clear rows over
// the card's inner bottom edge. The last row ends halfway down that gap, so a tap on the label
// misses the row and the row's focus ring stays clear of it.
export const SETTINGS_BUILD_LABEL = {
  colour: "darkBrown",
  room: SETTINGS_ROW.width,
  style: { scale: 1 },
} as const;
const BUILD_LABEL_FOOT = 6;
// ui-detail-card's frame along its bottom: a tan shade, a dark brown line and an ink line.
const CARD_FRAME_BOTTOM = 3;

// The note's lowest ink, from the row's top.
function noteInkBottom(fonts: SettingsFonts, noteLines: number): number {
  return noteDy(fonts.title) + inkRowsOfLines(fonts.body, noteLines) * TEXT_SCALE;
}

function rowHeight(fonts: SettingsFonts, shape: SettingsRowShape): number {
  return shape.kind === "slider"
    ? SETTINGS_ROW.slider.height
    : noteInkBottom(fonts, shape.noteLines) + SETTINGS_ROW.inkFoot;
}

// A switch or button row's control, right-aligned and centred down from the label's capitals to
// the note's lowest ink.
function rowControl(fonts: SettingsFonts, row: Rect, shape: SettingsRowShape): Rect | null {
  if (shape.kind === "slider") {
    return null;
  }
  const size = SETTINGS_ROW[shape.kind];
  const middle = Math.floor((SETTINGS_ROW.label.dy + noteInkBottom(fonts, shape.noteLines)) / 2);
  return {
    ...size,
    x: row.x + row.width - SETTINGS_ROW.pad - size.width,
    y: row.y + middle - size.height / 2,
  };
}

// A row's lowest ink, from its top: a noted row's note or control, whichever reaches lower. A
// slider row counts whole, its knob's art setting its lowest ink.
function rowInkBottom(fonts: SettingsFonts, shape: SettingsRowShape): number {
  if (shape.kind === "slider") {
    return SETTINGS_ROW.slider.height;
  }
  const control = rowControl(fonts, { height: 0, width: 0, x: 0, y: 0 }, shape);
  return Math.max(
    noteInkBottom(fonts, shape.noteLines),
    (control?.y ?? 0) + (control?.height ?? 0),
  );
}

// The rows on a card centred on the screen, under its title band with the close control in it,
// and the build label under them. Settings covers the screen wherever it opens from.
export function settingsLayout(
  fonts: SettingsFonts,
  screen: { height: number; width: number },
  shapes: readonly SettingsRowShape[],
): SettingsLayout {
  const lastShape = shapes.at(-1);
  const lastInk = lastShape === undefined ? 0 : rowInkBottom(fonts, lastShape);
  const heights = shapes.map((shape, i) =>
    i === shapes.length - 1 ? lastInk + Math.floor(LABEL_HELP_GAP / 2) : rowHeight(fonts, shape),
  );
  // From the panel's top: the last row's lowest ink (the band's bottom with no rows), and the
  // build label's capitals.
  const rowsInk = ROWS_TOP + heights.slice(0, -1).reduce((sum, rows) => sum + rows, 0) + lastInk;
  const labelDy = rowsInk + LABEL_HELP_GAP;
  // The label's digits, hex letters and "v" stand on the baseline, so its ink ends with its
  // capitals.
  const labelInk = fonts.body.capHeight * SETTINGS_BUILD_LABEL.style.scale;
  const height = labelDy + labelInk + BUILD_LABEL_FOOT + CARD_FRAME_BOTTOM;
  const x = Math.round((screen.width - PANEL.width) / 2);
  const y = Math.round((screen.height - height) / 2);
  const rowX = x + (PANEL.width - SETTINGS_ROW.width) / 2;
  let rowY = y + ROWS_TOP;
  const rows = shapes.map((shape, i) => {
    const rect = { height: heights[i] ?? 0, width: SETTINGS_ROW.width, x: rowX, y: rowY };
    rowY += rect.height;
    return {
      control: rowControl(fonts, rect, shape),
      noteY: shape.kind === "slider" ? null : rect.y + noteDy(fonts.title),
      rect,
    };
  });
  const panel = { ...PANEL, height, x, y };
  const band = cardBand(panel);
  const { pad, track } = SETTINGS_ROW;
  return {
    band,
    buildLabelY: y + labelDy,
    close: closeControl(panel),
    panel,
    rows,
    separators: rows.slice(1).map(({ rect }) => ({
      height: 1,
      width: rect.width - 2 * SEPARATOR_INSET,
      x: rect.x + SEPARATOR_INSET,
      y: rect.y,
    })),
    track: { ...track, width: SETTINGS_ROW.width - 2 * pad, x: rowX + pad },
  };
}

// The install steps for a browser's own menu: a detail card, wide enough for its title clear of
// the close control, centred on the screen, with its title band and close control, and under the
// band the 16x16 glyph of the browser's button, centred on the first line's capitals (icon.dy
// from their top), then the steps in body text, wrapped to up to lines lines a linePitch apart.
export const INSTALL_STEPS = {
  foot: 14,
  icon: { dy: -2, gap: 6, size: 16 },
  // The body's line pitch at 2x.
  linePitch: 20,
  lines: 3,
  pad: HOME_LAYOUT.card.pad,
  stepsDy: 4,
  width: HOME_LAYOUT.card.width,
} as const;

export const INSTALL_STEPS_FIT = {
  room:
    INSTALL_STEPS.width - 2 * INSTALL_STEPS.pad - INSTALL_STEPS.icon.size - INSTALL_STEPS.icon.gap,
  style: textOnLines(INSTALL_STEPS.lines),
};

export interface InstallStepsLayout {
  band: Rect;
  card: Rect;
  close: CloseControl;
  // The button glyph's top-left corner.
  icon: { x: number; y: number };
  // The steps' first line's left edge and capitals' top.
  steps: { x: number; y: number };
}

// The card for steps wrapped onto lines lines.
export function installStepsLayout(
  screen: { height: number; width: number },
  lines: number,
): InstallStepsLayout {
  const height = ROWS_TOP + lines * INSTALL_STEPS.linePitch + INSTALL_STEPS.foot;
  const card = {
    height,
    width: INSTALL_STEPS.width,
    x: Math.round((screen.width - INSTALL_STEPS.width) / 2),
    y: Math.round((screen.height - height) / 2),
  };
  const band = cardBand(card);
  const { icon, pad, stepsDy } = INSTALL_STEPS;
  const stepsY = card.y + ROWS_TOP + stepsDy;
  return {
    band,
    card,
    close: closeControl(card),
    icon: { x: card.x + pad, y: stepsY + icon.dy },
    steps: { x: card.x + pad + icon.size + icon.gap, y: stepsY },
  };
}
