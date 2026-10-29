import type { Input, Scene } from "phaser";

import { pressDown, pressUp, type TargetPress } from "../input/targetPress";
import { listenOnePress } from "./onePress";
import { afterMsUnderOverlay } from "./overlayClock";

interface TargetPressHandlers<T> {
  // How long a tapped target stays pressed before onTap, counted from the press. 0 by default.
  dipMs?: (target: T) => number;
  // After onPressed, on each press: for a tap burst, or a hold timer.
  onDown?: (pointer: Input.Pointer, target: T | undefined) => void;
  // As the followed press moves: for a hold's slop.
  onMove?: (pointer: Input.Pointer) => void;
  // The target a press shows pressed: the one under it as it lands, then undefined once it
  // ends, before any onTap but one that opens a page or card.
  onPressed: (target: T | undefined) => void;
  onTap: (target: T) => void;
  // Whether a tap on the target opens a page or card: onTap runs as the press lifts, and the
  // target shows pressed under what it opened until its dip ends. None by default.
  opens?: (target: T) => boolean;
  // Whether two targets are the same one. === by default.
  same?: (a: T, b: T) => boolean;
  targetAt: (x: number, y: number) => T | undefined;
}

export interface TargetPressListener {
  // Drops the press under way, so its release taps nothing; for a press a hold has taken.
  cancel(): void;
}

const NO_DIP = () => 0;
const OPENS_NOTHING = () => false;
const IDENTICAL = <T>(a: T, b: T) => a === b;

// Whether two targets are alike as JSON, for targets made afresh on each press with their keys in
// one order.
export function sameByValue<T>(a: T, b: T | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// One finger presses a target, and releasing it over the same target taps it.
export function listenTargetPress<T>(
  scene: Scene,
  handlers: TargetPressHandlers<T>,
): TargetPressListener {
  const rule = {
    dipMs: handlers.dipMs ?? NO_DIP,
    opens: handlers.opens ?? OPENS_NOTHING,
    same: handlers.same ?? IDENTICAL,
  };
  let press: TargetPress<T> | undefined;
  listenOnePress(scene, {
    down: (pointer) => {
      const target = handlers.targetAt(pointer.x, pointer.y);
      press = pressDown(scene.time.now, target);
      handlers.onPressed(target);
      handlers.onDown?.(pointer, target);
    },
    move: (pointer) => handlers.onMove?.(pointer),
    up: (pointer, cancelled) => {
      const released = cancelled ? undefined : handlers.targetAt(pointer.x, pointer.y);
      const release = pressUp(rule, scene.time.now, cancelled, press, released);
      press = undefined;
      // A press that landed during the dip keeps showing pressed.
      const lift = () => {
        if (press === undefined) {
          handlers.onPressed(undefined);
        }
      };
      if (release.kind === "tap" && release.delayMs > 0) {
        scene.time.delayedCall(release.delayMs, () => {
          lift();
          handlers.onTap(release.target);
        });
        return;
      }
      if (release.kind === "tap" && release.liftMs > 0) {
        afterMsUnderOverlay(scene, release.liftMs, lift);
      } else {
        handlers.onPressed(undefined);
      }
      if (release.kind === "tap") {
        handlers.onTap(release.target);
      }
    },
  });
  return {
    cancel: () => {
      press = undefined;
    },
  };
}
