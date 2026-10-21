import type { Input, Scene } from "phaser";

import { followOnePress } from "../input/onePress";
import type { PointerPhase } from "../input/pointerTracking";

// cancelled: the browser called the press off (a system gesture, an incoming call), so its
// release picks nothing. A release outside the canvas is an ordinary release.
interface OnePressHandlers {
  down: (pointer: Input.Pointer) => void;
  move?: (pointer: Input.Pointer) => void;
  up: (pointer: Input.Pointer, cancelled: boolean) => void;
}

// Every scene but the walk follows one finger: the first one down, until it lifts.
export function listenOnePress(scene: Scene, handlers: OnePressHandlers): void {
  let owner: number | undefined;
  const ownerDown = () =>
    scene.input.manager.pointers.some((pointer) => pointer.id === owner && pointer.isDown);
  const on = (phase: "down" | "move" | "up", pointer: Input.Pointer) => {
    const cancelled = phase === "up" && pointer.wasCanceled;
    const followed: PointerPhase = cancelled ? "cancel" : phase;
    const step = followOnePress(ownerDown(), followed, pointer.id, owner);
    owner = step.owner;
    if (!step.handle) {
      return;
    }
    if (phase === "down") {
      handlers.down(pointer);
    } else if (phase === "move") {
      handlers.move?.(pointer);
    } else {
      handlers.up(pointer, cancelled);
    }
  };
  scene.input.on("pointerdown", (pointer: Input.Pointer) => on("down", pointer));
  scene.input.on("pointermove", (pointer: Input.Pointer) => on("move", pointer));
  scene.input.on("pointerup", (pointer: Input.Pointer) => on("up", pointer));
  scene.input.on("pointerupoutside", (pointer: Input.Pointer) => on("up", pointer));
}
