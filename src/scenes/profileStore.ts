import type { Scene } from "phaser";

import { gameData } from "../data";
import { emptyLoadout, type HomeLoadout, type HomeProfile } from "../home/home";
import { sampleProfile } from "../home/sampleProfile";

const PROFILE_KEY = "homeProfile";
const LOADOUT_KEY = "homeLoadout";

// The player's profile and last loadout, held in the game's registry for this session only.
// The save module replaces this with a profile loaded from storage.
export function homeProfile(scene: Scene): HomeProfile {
  if (!scene.registry.has(PROFILE_KEY)) {
    scene.registry.set(PROFILE_KEY, sampleProfile(gameData));
  }
  return scene.registry.get(PROFILE_KEY) as HomeProfile;
}

export function setHomeProfile(scene: Scene, profile: HomeProfile): void {
  scene.registry.set(PROFILE_KEY, profile);
}

export function lastLoadout(scene: Scene): HomeLoadout {
  return (scene.registry.get(LOADOUT_KEY) as HomeLoadout | undefined) ?? emptyLoadout;
}

export function setLastLoadout(scene: Scene, loadout: HomeLoadout): void {
  scene.registry.set(LOADOUT_KEY, loadout);
}
