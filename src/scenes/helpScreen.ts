import type { Scene } from "phaser";

import type { HelpSceneData } from "./HelpScene";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";

// Pauses the calling scene and opens help over it; help resumes it on close.
export function openHelp(scene: Scene, resume: SceneKey): void {
  const data: HelpSceneData = { resume };
  scene.scene.pause();
  scene.scene.launch(SCENE_KEYS.help, data);
}
