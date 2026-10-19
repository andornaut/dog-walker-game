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

// Settings opens from the home screen or over the road, from the pause menu.
export type SettingsOrigin = "home" | "road";

export interface SettingsLayout {
  back: Rect;
  panel: Rect;
  // The first row; the rest follow it down, each its height below.
  row: Rect;
  title: { x: number; y: number };
  track: SliderTrack & { dy: number; height: number };
}

const PANEL_WIDTH = 248;
// Over the road, the panel sits where the menus mock puts it.
const ROAD_PANEL_X = 96;

// The menus mock's layout: four rows 44 tall and Back. On the home screen the panel is
// centred; over the road it keeps the mock's x.
export function settingsLayout(screenWidth: number, origin: SettingsOrigin): SettingsLayout {
  const x = origin === "home" ? Math.round((screenWidth - PANEL_WIDTH) / 2) : ROAD_PANEL_X;
  return {
    back: { height: 40, width: 200, x: x + 24, y: 499 },
    panel: { height: 276, width: PANEL_WIDTH, x, y: 277 },
    row: { height: 44, width: 232, x: x + 8, y: 315 },
    title: { x: x + 124, y: 293 },
    track: { dy: 24, height: 10, knobWidth: 10, width: 216, x: x + 16 },
  };
}
