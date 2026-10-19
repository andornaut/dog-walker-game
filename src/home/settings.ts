import type { Settings } from "../save/schema";

// The settings screen moves a volume in tenths, from 0 to 1.
export const VOLUME_STEPS = 10;

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

export function setVolumeSteps(key: VolumeKey, steps: number, settings: Settings): Settings {
  return { ...settings, [key]: Math.min(VOLUME_STEPS, Math.max(0, steps)) / VOLUME_STEPS };
}

// The soundboard's volumes from the saved settings.
export function soundVolumes(settings: Settings): { music: number; sfx: number } {
  return { music: settings.musicVolume, sfx: settings.sfxVolume };
}
