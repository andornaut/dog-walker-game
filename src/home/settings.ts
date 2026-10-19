import type { Settings } from "../save/schema";

// The settings screen moves a volume in tenths, from 0 to 1.
export const VOLUME_STEPS = 10;

export type VolumeKey = "musicVolume" | "sfxVolume";

// The volume as a whole number of steps, from 0 to VOLUME_STEPS.
export function volumeSteps(volume: number): number {
  return Math.min(VOLUME_STEPS, Math.max(0, Math.round(volume * VOLUME_STEPS)));
}

// One step up (+1) or down (-1), snapped to a step and held within 0 and 1.
export function stepVolume(key: VolumeKey, direction: -1 | 1, settings: Settings): Settings {
  const steps = Math.min(VOLUME_STEPS, Math.max(0, volumeSteps(settings[key]) + direction));
  return { ...settings, [key]: steps / VOLUME_STEPS };
}

// The soundboard's volumes from the saved settings.
export function soundVolumes(settings: Settings): { music: number; sfx: number } {
  return { music: settings.musicVolume, sfx: settings.sfxVolume };
}
