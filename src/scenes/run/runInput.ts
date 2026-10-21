import type { Input, Scene } from "phaser";

import { gameData } from "../../data";
import { LANE_COUNT, SCREEN_CONFIG } from "../../data/screen";
import { onStrip, stripItems } from "../../hud/stateStrip";
import { gameplayAllowed, pressesHeld, type RunPause, topBarButtonAt } from "../../hud/topBar";
import type { GestureAction, GestureContext } from "../../input/gestures";
import { walkKeyAction } from "../../input/keyBindings";
import {
  idleTrack,
  type PointerSample,
  type PointerTrack,
  trackPointer,
} from "../../input/pointerTracking";
import { giveTreat } from "../../rules/treats";
import { read } from "../../rules/units";
import { gestureAfterPulls, type PullStep } from "../../runner/pulls";
import type { SessionInput } from "../../runner/session";
import type { Walk } from "../../runner/walk";
import { LAYOUT } from "./stage";

// What the walk's input reads of the run, and the pause it opens.
export interface RunInputHost {
  openPause: () => void;
  // Whether a replay drives the run, which then takes no live lane moves or treats.
  replaying: () => boolean;
  runPause: () => RunPause;
  walk: () => Walk | undefined;
}

// Keys, the press driving the walk's gestures, and the lane moves and treats they queue for
// the next simulation step.
export class RunInput {
  private readonly host: RunInputHost;
  private pending: SessionInput[] = [];
  private pointers: PointerTrack = idleTrack;
  private readonly scene: Scene;

  constructor(scene: Scene, host: RunInputHost) {
    this.scene = scene;
    this.host = host;
  }

  listen(): void {
    const { input } = this.scene;
    input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event));
    input.on("pointerdown", (pointer: Input.Pointer) => this.onPointer("down", pointer));
    input.on("pointermove", (pointer: Input.Pointer) => this.onPointer("move", pointer));
    input.on("pointerup", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    input.on("pointerupoutside", (pointer: Input.Pointer) => this.onPointer("up", pointer));
  }

  // The lane moves and treats queued for the next step, which the pack's drawing leads with.
  queued(): readonly SessionInput[] {
    return this.pending;
  }

  // The lane moves and treats queued since the last step.
  takePending(): SessionInput[] {
    const inputs = this.pending;
    this.pending = [];
    return inputs;
  }

  // A press under way when a card or the menu opens, or the page loses focus, is dropped:
  // its release may never arrive.
  dropPress(): void {
    this.pointers = idleTrack;
  }

  // A pull that moved the pack re-anchors the drag.
  afterPulls(pulled: PullStep["pulled"]): void {
    this.pointers = { ...this.pointers, gesture: gestureAfterPulls(pulled, this.pointers.gesture) };
  }

  // M, P and Escape are the top bar's keys, which the HUD handles. Phaser hands a key down to
  // this listener as the browser fires it, auto-repeats included.
  private onKey(event: KeyboardEvent): void {
    const action = walkKeyAction(SCREEN_CONFIG.dogSlotCount, event.key, event.repeat);
    if (action !== undefined) {
      this.act(action);
    }
  }

  // Phaser reports a cancelled touch as a release with wasCanceled set. The run scene keeps
  // running while a card or the pause menu covers the walk, and the press is theirs then, as
  // is the press that closes the state strip's bubble.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    const walk = this.host.walk();
    const walking = walk !== undefined && walk.run.phase.kind === "walking";
    const held = !walking || pressesHeld(this.host.runPause());
    const sample: PointerSample = {
      onButton: phase === "down" && topBarButtonAt(pointer.x, pointer.y) !== undefined,
      onStrip:
        phase === "down" &&
        walk !== undefined &&
        onStrip(SCREEN_CONFIG.width, stripItems(gameData, walk.run).length, pointer),
      phase: phase === "up" && pointer.wasCanceled ? "cancel" : phase,
      point: { x: pointer.x, y: pointer.y },
      press: { downTime: pointer.downTime, id: pointer.id },
    };
    const result = trackPointer(gestureContext(walk), held, sample, this.pointers);
    this.pointers = result.track;
    result.actions.forEach((action) => this.act(action));
  }

  // Lane moves wait for the next simulation step, where they are logged.
  private act(action: GestureAction): void {
    const walk = this.host.walk();
    if (walk === undefined || walk.run.phase.kind !== "walking") {
      return;
    }
    if (action.kind !== "pause" && !gameplayAllowed(this.host.runPause())) {
      return;
    }
    switch (action.kind) {
      case "move":
        if (!this.host.replaying()) {
          this.pending.push({ direction: action.direction, kind: "lane" });
        }
        return;
      case "pause":
        this.host.openPause();
        return;
      case "treat":
        if (!this.host.replaying()) {
          this.pending.push({ kind: "treat", slot: action.slot });
        }
        return;
      default:
        action satisfies never;
    }
  }
}

// TREAT TAP (delete with the doghouse treat tap): whether a tap on the doghouse in the slot
// gives its dog a treat.
function treatToGive(walk: Walk | undefined, slot: number): boolean {
  const dog = walk?.run.pack[slot]?.dog;
  return (
    walk !== undefined && dog !== undefined && giveTreat(gameData, dog, walk.run).change !== null
  );
}

function gestureContext(walk: Walk | undefined): GestureContext {
  return {
    config: {
      laneCount: LANE_COUNT,
      swipeStartDistance: read(gameData.tuning, "pixels", "swipeStartDistance"),
      tapMaxDistance: read(gameData.tuning, "pixels", "tapMaxDistance"),
    },
    layout: LAYOUT,
    treatToGive: (slot) => treatToGive(walk, slot),
  };
}
