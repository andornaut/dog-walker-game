import { laneDirectionForKey } from "../input/keyBindings";
import type { Rect } from "../lib/rect";
import type { Settings } from "../save/schema";
import { type CloseControl, closeControl } from "../ui/closeControl";
import { textFitStylesOnLines } from "../ui/textFit";

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
  return Math.round(Math.min(1, Math.max(0, fraction)) * VOLUME_STEPS);
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

type SettingsRowKind = "slider" | "switch";

export interface SettingsLayout {
  // The title band across the card's top, the title's capitals centred on it.
  band: Rect;
  close: CloseControl;
  panel: Rect;
  // The rows, top to bottom.
  rows: Rect[];
  // A tan rule along the top of every row after the first, SEPARATOR_INSET in from its sides.
  separators: Rect[];
  title: { x: number; y: number };
  track: SliderTrack & { dy: number; height: number };
}

// Offsets from a row's top-left corner. Every text is at 2x. A slider row has its 16x16 icon,
// its 2x title-font label and its percentage over the track. A switch row has its icon and
// label over its note, wrapped to noteWidth in up to two body-font lines a linePitch apart,
// with the switch centred down the row's right side.
export const SETTINGS_ROW = {
  height: { slider: 44, switch: 62 },
  labelDx: 26,
  slider: { iconDy: 5, labelDy: 8 },
  switch: {
    iconDy: 5,
    labelDy: 8,
    linePitch: 20,
    noteDy: 24,
    // The most lines a note wraps to.
    noteLines: 2,
    noteWidth: 156,
    scale: 2,
    switch: { dx: 192, dy: 23, height: 16, width: 32 },
  },
} as const;

// A switch row's note: up to noteLines lines at 2x within noteWidth, its glyphs closer or at
// 1x where they would not fit.
export const SWITCH_NOTE_FIT = {
  room: SETTINGS_ROW.switch.noteWidth,
  styles: textFitStylesOnLines(SETTINGS_ROW.switch.noteLines),
};

const PANEL = { width: 248 };
// The card's title band, inset from its top and sides, with the title's capitals titleY under
// the card's top.
const BAND = { height: 24, inset: 6, titleY: 13 };
// The rows start under the band; the panel ends this far under the last.
const ROWS_TOP = 38;
const PANEL_FOOT = 14;
const SEPARATOR_INSET = 4;

// The rows, by kind, on a card centred on the screen, under its title band with the close
// control in it. Settings covers the screen wherever it opens from.
export function settingsLayout(
  screen: { height: number; width: number },
  kinds: readonly SettingsRowKind[],
): SettingsLayout {
  const rowsHeight = kinds.reduce((sum, kind) => sum + SETTINGS_ROW.height[kind], 0);
  const height = ROWS_TOP + rowsHeight + PANEL_FOOT;
  const x = Math.round((screen.width - PANEL.width) / 2);
  const y = Math.round((screen.height - height) / 2);
  let rowY = y + ROWS_TOP;
  const rows = kinds.map((kind) => {
    const row = { height: SETTINGS_ROW.height[kind], width: 232, x: x + 8, y: rowY };
    rowY += row.height;
    return row;
  });
  const panel = { ...PANEL, height, x, y };
  return {
    band: {
      height: BAND.height,
      width: PANEL.width - 2 * BAND.inset,
      x: x + BAND.inset,
      y: y + BAND.inset,
    },
    close: closeControl(panel),
    panel,
    rows,
    separators: rows.slice(1).map((row) => ({
      height: 1,
      width: row.width - 2 * SEPARATOR_INSET,
      x: row.x + SEPARATOR_INSET,
      y: row.y,
    })),
    title: { x: x + PANEL.width / 2, y: y + BAND.titleY },
    track: { dy: 26, height: 10, knobWidth: 10, width: 216, x: x + 16 },
  };
}
