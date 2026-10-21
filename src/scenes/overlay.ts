import type { Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  type OutsideArea,
  type OutsidePress,
  outsidePressDown,
  outsidePressMove,
  outsideTapped,
  screenArea,
} from "../input/outsideTap";
import { gamePoint, onBarePage } from "../input/pageTap";
import type { Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
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
// button, and a tap outside it (listenOutsideTap) on the screen around covered, its panel and
// any control drawn outside the panel, or on the page beside the game. A full-screen page
// covers the screen itself, so only the page beside the game counts. back is what the back
// button does, as Escape does (isPauseKey): close unless a card is open over the overlay, which
// closes first.
export function listenDismiss(
  scene: Scene,
  covered: readonly Rect[],
  close: () => void,
  back: () => void = close,
): void {
  onBackPressed(scene, back);
  const area = screenArea(SCREEN_CONFIG, covered);
  listenOutsideTap(scene, () => area, close);
}

// Calls onTap on a tap on the dimmed area outside the overlay's panel, or on the bare page
// beside the game, as its close control or Resume would. A press that travels past the tap
// distance is a drag and taps nothing. area is read as each press lands: undefined while no
// panel is open, so the press taps nothing.
export function listenOutsideTap(
  scene: Scene,
  area: () => OutsideArea | undefined,
  onTap: () => void,
): void {
  const tapMaxDistance = read(gameData.tuning, "pixels", "tapMaxDistance");
  listenPageTap(scene, tapMaxDistance, () => area() !== undefined, onTap);
  let press: { readonly area: OutsideArea; readonly press: OutsidePress } | undefined;
  listenOnePress(scene, {
    down: (pointer) => {
      const open = area();
      const landed =
        open === undefined ? undefined : outsidePressDown(open, { x: pointer.x, y: pointer.y });
      press =
        open === undefined || landed === undefined ? undefined : { area: open, press: landed };
    },
    move: (pointer) => {
      if (press !== undefined) {
        const moved = outsidePressMove(tapMaxDistance, { x: pointer.x, y: pointer.y }, press.press);
        press = { ...press, press: moved };
      }
    },
    up: (pointer, cancelled) => {
      const point = { x: pointer.x, y: pointer.y };
      const tapped =
        press !== undefined &&
        outsideTapped(press.area, tapMaxDistance, cancelled, press.press, point);
      press = undefined;
      if (tapped) {
        onTap();
      }
    },
  });
}

// Calls onTap on a tap on the bare page beside the game's canvas (onBarePage) while scene is
// running and open says a panel is open, so an overlay paused under another never takes it.
// The page's listeners go when the scene shuts down.
function listenPageTap(
  scene: Scene,
  tapMaxDistance: number,
  open: () => boolean,
  onTap: () => void,
): void {
  const { canvas } = scene.game;
  const bare = [document.documentElement, document.body, canvas.parentElement];
  const toGame = (event: PointerEvent) =>
    gamePoint(canvas.getBoundingClientRect(), scene.scale.width, {
      x: event.clientX,
      y: event.clientY,
    });
  const counts = (event: PointerEvent) =>
    scene.sys.isActive() && open() && onBarePage(bare, event.target);
  let press: OutsidePress | undefined;
  const down = (event: PointerEvent) => {
    press = counts(event) ? { start: toGame(event), tapping: true } : undefined;
  };
  const move = (event: PointerEvent) => {
    if (press !== undefined) {
      press = outsidePressMove(tapMaxDistance, toGame(event), press);
    }
  };
  const up = (event: PointerEvent) => {
    const tapped =
      press !== undefined &&
      counts(event) &&
      outsidePressMove(tapMaxDistance, toGame(event), press).tapping;
    press = undefined;
    if (tapped) {
      onTap();
    }
  };
  const cancel = () => {
    press = undefined;
  };
  document.addEventListener("pointerdown", down);
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  scene.events.once("shutdown", () => {
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
  });
}
