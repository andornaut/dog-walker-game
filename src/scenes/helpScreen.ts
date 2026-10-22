import type { Scene } from "phaser";

import { openOverlay } from "./overlay";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";

// Pauses the calling scene and opens help over it; help resumes it on close.
export function openHelp(scene: Scene, resume: SceneKey): void {
  openOverlay(scene, SCENE_KEYS.help, { resume });
}
