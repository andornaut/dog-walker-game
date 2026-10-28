import { laneDirectionForKey } from "../input/keyBindings";
import { clamp01 } from "../lib/numbers";
import type { Rect } from "../lib/rect";
import type { Settings } from "../save/schema";
import { type CloseControl, closeControl } from "../ui/closeControl";
import { textFitStylesOnLines } from "../ui/textFit";
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

// Offsets from a row's top-left corner. Every text is at 2x. A button row has its 16x16 icon
// and its title-font label centred down it. A slider row has its 16x16 icon, its title-font
// label and its percentage over the track. A switch row has its icon and label over its note,
// wrapped to noteWidth in up to two body-font lines a linePitch apart, with the switch centred
// down the row's right side.
export const SETTINGS_ROW = {
  button: { iconDy: 14, labelDy: 17 },
  height: { button: 44, slider: 44, switch: 62 },
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
  const band = cardBand(panel);
  return {
    band,
    close: closeControl(panel),
    panel,
    rows,
    separators: rows.slice(1).map((row) => ({
      height: 1,
      width: row.width - 2 * SEPARATOR_INSET,
      x: row.x + SEPARATOR_INSET,
      y: row.y,
    })),
    title: { x: x + PANEL.width / 2, y: band.y + HOME_LAYOUT.card.band.titleY },
    track: { dy: 26, height: 10, knobWidth: 10, width: 216, x: x + 16 },
  };
}

// The iOS install steps: a detail card, wide enough for its title clear of the close control,
// centred on the screen, with its title band and close control, and under the band the 16x16
// icon-share, centred on the first line's capitals (icon.dy from their top), then the steps in
// body text, wrapped to up to lines lines a linePitch apart.
export const INSTALL_STEPS = {
  icon: { dy: -2, gap: 6, size: 16 },
  linePitch: SETTINGS_ROW.switch.linePitch,
  lines: 3,
  pad: HOME_LAYOUT.card.pad,
  stepsDy: 4,
  width: HOME_LAYOUT.card.width,
} as const;

export const INSTALL_STEPS_FIT = {
  room:
    INSTALL_STEPS.width - 2 * INSTALL_STEPS.pad - INSTALL_STEPS.icon.size - INSTALL_STEPS.icon.gap,
  styles: textFitStylesOnLines(INSTALL_STEPS.lines),
};

export interface InstallStepsLayout {
  band: Rect;
  card: Rect;
  close: CloseControl;
  // icon-share's top-left corner.
  icon: { x: number; y: number };
  // The steps' first line's left edge and capitals' top.
  steps: { x: number; y: number };
  title: { x: number; y: number };
}

// The card for steps wrapped onto lines lines.
export function installStepsLayout(
  screen: { height: number; width: number },
  lines: number,
): InstallStepsLayout {
  const height = ROWS_TOP + lines * INSTALL_STEPS.linePitch + PANEL_FOOT;
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
    title: { x: card.x + INSTALL_STEPS.width / 2, y: band.y + HOME_LAYOUT.card.band.titleY },
  };
}
