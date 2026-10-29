import type { Point } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";

import { gamePoint, onBarePage } from "../input/pageTap";
import type { Press } from "../input/pointerTracking";

// What a press on the bare page does, at points in game pixels, unclamped. onBare: whether the
// release came on the bare page.
export interface PagePressHandlers {
  cancel?: (press: Press, point: Point) => void;
  down: (press: Press, point: Point) => void;
  move?: (press: Press, point: Point) => void;
  up: (press: Press, point: Point, onBare: boolean) => void;
}

// Follows each press that lands on the bare page beside the game's canvas (onBarePage) while
// scene is running and takes input, wherever it then travels, until it lifts or the browser
// cancels it. Phaser hears these only as presses outside the canvas, with no moves. A press's id
// is negative, so it is never taken for a Phaser pointer's, which count from 0. The page's
// listeners go when the scene shuts down.
export function listenPagePresses(scene: Scene, handlers: PagePressHandlers): void {
  const { canvas } = scene.game;
  const bare = [document.documentElement, document.body, canvas.parentElement];
  const presses = new Map<number, Press>();
  const toGame = (event: PointerEvent) =>
    gamePoint(canvas.getBoundingClientRect(), scene.scale.width, {
      x: event.clientX,
      y: event.clientY,
    });
  const down = (event: PointerEvent) => {
    if (!scene.sys.isActive() || !scene.input.enabled || !onBarePage(bare, event.target)) {
      return;
    }
    const press: Press = { downTime: event.timeStamp, id: -1 - event.pointerId };
    presses.set(event.pointerId, press);
    handlers.down(press, toGame(event));
  };
  const move = (event: PointerEvent) => {
    const press = presses.get(event.pointerId);
    if (press !== undefined) {
      handlers.move?.(press, toGame(event));
    }
  };
  const up = (event: PointerEvent) => {
    const press = presses.get(event.pointerId);
    presses.delete(event.pointerId);
    if (press !== undefined) {
      handlers.up(press, toGame(event), onBarePage(bare, event.target));
    }
  };
  const cancel = (event: PointerEvent) => {
    const press = presses.get(event.pointerId);
    presses.delete(event.pointerId);
    if (press !== undefined) {
      handlers.cancel?.(press, toGame(event));
    }
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
