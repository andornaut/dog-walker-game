import { laneDirectionForKey } from "../input/keyBindings";
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

export interface SettingsLayout {
  back: Rect;
  panel: Rect;
  // The first row; the rest follow it down, each its height below.
  row: Rect;
  title: { x: number; y: number };
  track: SliderTrack & { dy: number; height: number };
}

const PANEL = { height: 276, width: 248 };

// The menus mock's layout: four rows 44 tall and Back, the panel centred on the screen,
// which it covers wherever it opens from.
export function settingsLayout(screen: { height: number; width: number }): SettingsLayout {
  const x = Math.round((screen.width - PANEL.width) / 2);
  const y = Math.round((screen.height - PANEL.height) / 2);
  return {
    back: { height: 40, width: 200, x: x + 24, y: y + 222 },
    panel: { ...PANEL, x, y },
    row: { height: 44, width: 232, x: x + 8, y: y + 38 },
    title: { x: x + 124, y: y + 16 },
    track: { dy: 24, height: 10, knobWidth: 10, width: 216, x: x + 16 },
  };
}
