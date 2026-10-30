import {
  type OutsideArea,
  type OutsidePress,
  outsidePressMove,
} from "@andornaut/game-kit/input/outsideTap";
import { catchOutsideTaps } from "@andornaut/game-kit/input/phaser/catchOutsideTaps";
import type { Events, Scene } from "phaser";

import { gameData } from "../data";
import { openGuard } from "../input/openGuard";
import { PHONE_EVENTS } from "../pwa";
import { read } from "../rules/units";
import { listenPagePresses } from "./pagePresses";
import type { SceneKey } from "./sceneKeys";

// Emitted on game.events, with whether sound is now muted, when a top bar's Sound button is
// tapped over an overlay (the home top bar's, or the walk bar's), so the screen under it and the
// settings redraw and say so.
export const BAR_MUTED_EVENT = "bar-muted";

// What every overlay is launched with: the scene under it, which it resumes on close.
export interface OverlayData {
  resume?: SceneKey;
}

const overlayGuard = openGuard();

// Pauses scene and launches the overlay key over it at once, a tap's burst playing on over the
// overlay (addTapBurst). Phaser applies both at its next step, so a second open asked of scene
// before then is dropped (openGuard). Returns whether it opened.
export function openOverlay(scene: Scene, key: SceneKey, data: OverlayData): boolean {
  return overlayGuard(scene.game.events, scene, () => {
    scene.scene.pause();
    scene.scene.launch(key, data);
  });
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

// Listens for an event on emitter, such as game.events, another scene's events or the scene's
// own, until scene shuts down, so a scene started again never hears it twice.
export function onSceneEvent<Args extends unknown[]>(
  scene: Scene,
  emitter: Events.EventEmitter,
  type: string,
  listener: (...args: Args) => void,
): void {
  emitter.on(type, listener);
  scene.events.once("shutdown", () => emitter.off(type, listener));
}

// Listens once for an event on emitter, as onSceneEvent does, dropping the listener unheard if
// scene shuts down first.
export function onceSceneEvent<Args extends unknown[]>(
  scene: Scene,
  emitter: Events.EventEmitter,
  type: string,
  listener: (...args: Args) => void,
): void {
  emitter.once(type, listener);
  scene.events.once("shutdown", () => emitter.off(type, listener));
}

// Calls back on the phone's back button while scene is running, so a screen paused under an
// overlay leaves the press to the overlay.
export function onBackPressed(scene: Scene, back: () => void): void {
  onWindowEvent(scene, PHONE_EVENTS.backPressed, () => {
    if (scene.sys.isActive()) {
      back();
    }
  });
}

// Closes an overlay the ways every overlay closes besides its own controls: the phone's back
// button, and a tap outside it (listenOutsideTap) in area, around its panel and any control
// drawn outside the panel, or on the page beside the game. A full-screen page covers the screen
// itself, so only the page beside the game counts. back is what the back button does, as Escape
// does (isPauseKey): close unless a card is open over the overlay, which closes first.
export function listenDismiss(
  scene: Scene,
  area: OutsideArea,
  close: () => void,
  back: () => void = close,
): void {
  onBackPressed(scene, back);
  listenOutsideTap(scene, () => area, close);
}

// Calls onTap on a tap in area outside the overlay's panel, or on the bare page beside the game,
// as its close control or Resume would. A press that travels past the tap distance is a drag and
// taps nothing. A press that lands outside on the canvas never reaches the scenes under the
// overlay (the kit's catchOutsideTaps), so the tap that closes it selects and presses nothing
// there. area is read as each press lands: undefined while no panel is open, so the press taps
// nothing.
export function listenOutsideTap(
  scene: Scene,
  area: () => OutsideArea | undefined,
  onTap: () => void,
): void {
  const tapMaxDistance = read(gameData.tuning, "pixels", "tapMaxDistance");
  listenPageTap(scene, tapMaxDistance, () => area() !== undefined, onTap);
  catchOutsideTaps(tapMaxDistance, scene, area, onTap);
}

// Calls onTap on a tap on the bare page beside the game's canvas (listenPagePresses) while scene
// is running, takes input and open says a panel is open, so an overlay paused under another, or
// holding its input off (guardScreenInput), never takes it.
function listenPageTap(
  scene: Scene,
  tapMaxDistance: number,
  open: () => boolean,
  onTap: () => void,
): void {
  const counts = () => scene.sys.isActive() && scene.input.enabled && open();
  let press: OutsidePress | undefined;
  listenPagePresses(scene, {
    cancel: () => {
      press = undefined;
    },
    down: (_press, point) => {
      press = counts() ? { start: point, tapping: true } : undefined;
    },
    move: (_press, point) => {
      if (press !== undefined) {
        press = outsidePressMove(tapMaxDistance, point, press);
      }
    },
    up: (_press, point, onBare) => {
      const tapped =
        press !== undefined &&
        onBare &&
        counts() &&
        outsidePressMove(tapMaxDistance, point, press).tapping;
      press = undefined;
      if (tapped) {
        onTap();
      }
    },
  });
}
