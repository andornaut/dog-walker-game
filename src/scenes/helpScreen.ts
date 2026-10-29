import type { Scene } from "phaser";

import { openOverlay } from "./overlay";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";

// Pauses the calling scene and opens help over it; help resumes it on close. Returns whether it
// opened, as openOverlay does.
export function openHelp(scene: Scene, resume: SceneKey): boolean {
  return openOverlay(scene, SCENE_KEYS.help, { resume });
}
