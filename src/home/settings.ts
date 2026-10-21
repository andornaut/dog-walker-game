import { laneDirectionForKey } from "../input/keyBindings";
import { type CloseControl, closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";
import type { Settings } from "../save/schema";

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

export type SettingsRowKind = "slider" | "switch";

export interface SettingsLayout {
  close: CloseControl;
  panel: Rect;
  // The rows, top to bottom.
  rows: Rect[];
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
  slider: { iconDy: 3, labelDy: 6 },
  switch: {
    iconDy: 5,
    labelDy: 8,
    linePitch: 20,
    noteDy: 24,
    // The most lines a note wraps to.
    noteLines: 2,
    noteWidth: 156,
    scale: 2,
    switch: { dx: 188, dy: 23, height: 16, width: 32 },
  },
} as const;

const PANEL = { width: 248 };
// The rows start under the title; the panel ends this far under the last.
const ROWS_TOP = 38;
const PANEL_FOOT = 8;

// The rows, by kind, on a panel centred on the screen, and the close control in the screen's
// corner. Settings covers the screen wherever it opens from.
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
  return {
    close: closeControl({ height: screen.height, width: screen.width, x: 0, y: 0 }),
    panel: { ...PANEL, height, x, y },
    rows,
    title: { x: x + 124, y: y + 16 },
    track: { dy: 24, height: 10, knobWidth: 10, width: 216, x: x + 16 },
  };
}
