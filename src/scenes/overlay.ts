import type { Scene } from "phaser";

import { gameData } from "../data";
import {
  type OutsideArea,
  type OutsidePress,
  outsidePressDown,
  outsidePressMove,
  outsideTapped,
} from "../input/outsideTap";
import { read } from "../rules/units";
import { listenOnePress } from "./onePress";
import type { SceneKey } from "./sceneKeys";

// What every overlay is launched with: the scene under it, which it resumes on close.
export interface OverlayData {
  resume?: SceneKey;
}

// Pauses scene and launches the overlay key over it.
export function openOverlay(scene: Scene, key: SceneKey, data: OverlayData): void {
  scene.scene.pause();
  scene.scene.launch(key, data);
}

// Resumes the scene under overlay, if it has one, and stops overlay.
export function closeOverlay(resume: SceneKey | undefined, overlay: Scene): void {
  if (resume !== undefined) {
    overlay.scene.resume(resume);
  }
  overlay.scene.stop();
}

// Listens for a window event, such as PHONE_EVENTS.backPressed, until scene shuts down.
export function onWindowEvent(scene: Scene, type: string, listener: () => void): void {
  window.addEventListener(type, listener);
  scene.events.once("shutdown", () => window.removeEventListener(type, listener));
}

// Calls onTap on a tap on the dimmed area outside the overlay's panel, as its close control
// or Resume would. A press that travels past the tap distance is a drag and taps nothing.
export function listenOutsideTap(scene: Scene, area: OutsideArea, onTap: () => void): void {
  const tapMaxDistance = read(gameData.tuning, "pixels", "tapMaxDistance");
  let press: OutsidePress | undefined;
  listenOnePress(scene, {
    down: (pointer) => {
      press = outsidePressDown(area, { x: pointer.x, y: pointer.y });
    },
    move: (pointer) => {
      if (press !== undefined) {
        press = outsidePressMove(tapMaxDistance, { x: pointer.x, y: pointer.y }, press);
      }
    },
    up: (pointer, cancelled) => {
      const point = { x: pointer.x, y: pointer.y };
      const tapped = outsideTapped(area, tapMaxDistance, cancelled, press, point);
      press = undefined;
      if (tapped) {
        onTap();
      }
    },
  });
}
