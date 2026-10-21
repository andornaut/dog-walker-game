import type { Input, Scene } from "phaser";

import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import { gameplayAllowed, pressesHeld, type RunPause, topBarButtonAt } from "../../hud/topBar";
import {
  debuffBarRects,
  type ExplainShown,
  type ExplainTarget,
  explainTargetAt,
} from "../../hud/walkHud";
import type { GestureAction } from "../../input/gestures";
import { walkKeyAction } from "../../input/keyBindings";
import {
  type ExplainChange,
  idleTrack,
  type PointerSample,
  type PointerTrack,
  tickTrack,
  type TrackContext,
  trackPointer,
} from "../../input/pointerTracking";
import type { LaneDirection } from "../../layout/lanes";
import { read } from "../../rules/units";
import type { SessionInput } from "../../runner/session";
import { steerWalk, type Walk } from "../../runner/walk";
import { leadWalk } from "./interpolate";
import { LAYOUT } from "./stage";

// What the walk's input reads of the run. explainShown: what the HUD shows that a held press
// can explain.
interface RunInputHost {
  explainShown: () => ExplainShown;
  // Whether a replay drives the run, which then takes no live lane moves.
  replaying: () => boolean;
  runPause: () => RunPause;
  walk: () => Walk | undefined;
}

// Keys, the press driving the walk's gestures, the lane moves they queue for the next
// simulation step, and the HUD element a still press holds to explain.
export class RunInput {
  private explained: ExplainTarget | undefined;
  private readonly host: RunInputHost;
  private pending: SessionInput[] = [];
  private pointers: PointerTrack<ExplainTarget> = idleTrack;
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

  // The lane moves queued for the next step, which the pack's drawing leads with.
  queued(): readonly SessionInput[] {
    return this.pending;
  }

  // The lane moves queued since the last step.
  takePending(): SessionInput[] {
    const inputs = this.pending;
    this.pending = [];
    return inputs;
  }

  // A press under way when a card or the menu opens, or the page loses focus, is dropped:
  // its release may never arrive. An explanation it held up ends.
  dropPress(): void {
    this.pointers = idleTrack;
    this.explained = undefined;
  }

  // What a held press explains, while it does; the walk stays paused until it lifts.
  explanation(): ExplainTarget | undefined {
    return this.explained;
  }

  // Each frame: a press held still on an element long enough starts its explanation.
  tick(nowMs: number): void {
    const { explain, track } = tickTrack(nowMs, this.pointers);
    this.pointers = track;
    this.explain(explain);
  }

  private explain(change: ExplainChange<ExplainTarget> | undefined): void {
    if (change !== undefined) {
      this.explained = change.kind === "start" ? change.target : undefined;
    }
  }

  // M, P and Escape are the walk bar's keys, which the HUD handles. Phaser hands a key down to
  // this listener as the browser fires it, auto-repeats included.
  private onKey(event: KeyboardEvent): void {
    const action = walkKeyAction(event.key, event.repeat);
    if (action !== undefined) {
      this.act(action);
    }
  }

  // Phaser reports a cancelled touch as a release with wasCanceled set. The run scene keeps
  // running while a card or the pause menu covers the walk, and the press is theirs then.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    const walk = this.host.walk();
    const walking = walk !== undefined && walk.run.phase.kind === "walking";
    const held = !walking || pressesHeld(this.host.runPause());
    const sample: PointerSample = {
      onButton: phase === "down" && topBarButtonAt(pointer.x, pointer.y) !== undefined,
      phase: phase === "up" && pointer.wasCanceled ? "cancel" : phase,
      point: { x: pointer.x, y: pointer.y },
      press: { downTime: pointer.downTime, id: pointer.id },
      timeMs: this.scene.game.loop.time,
    };
    const shown = this.host.explainShown();
    const stepMoves = (direction: LaneDirection) => this.stepMoves(direction);
    const result = trackPointer(trackContext(shown, stepMoves), held, sample, this.pointers);
    this.pointers = result.track;
    this.explain(result.explain);
    result.actions.forEach((action) => this.act(action));
  }

  // The walk that takes live lane moves now, if any does.
  private steerable(): Walk | undefined {
    const walk = this.host.walk();
    if (walk === undefined || walk.run.phase.kind !== "walking") {
      return undefined;
    }
    if (!gameplayAllowed(this.host.runPause()) || this.host.replaying()) {
      return undefined;
    }
    return walk;
  }

  // Lane moves wait for the next simulation step, where they are logged.
  private act(action: GestureAction): void {
    if (this.steerable() !== undefined) {
      this.pending = [...this.pending, { direction: action.direction, kind: "lane" }];
    }
  }

  // Whether a lane move that way, after the ones queued, would move the pack's target lane.
  private stepMoves(direction: LaneDirection): boolean {
    const walk = this.steerable();
    if (walk === undefined) {
      return false;
    }
    const queued = leadWalk(gameData, LANE_COUNT, 0, this.pending, walk);
    const stepped = steerWalk(gameData, LANE_COUNT, direction, queued);
    return stepped.road.control.target !== queued.road.control.target;
  }
}

// A tap on a debuff bar does nothing, and a press on anything that explains itself holds to
// explain once still for explainHoldSeconds within swipeStartDistance, the drag's first step.
function trackContext(
  shown: ExplainShown,
  stepMoves: (direction: LaneDirection) => boolean,
): TrackContext<ExplainTarget> {
  const swipeStartDistance = read(gameData.tuning, "pixels", "swipeStartDistance");
  return {
    config: { laneCount: LANE_COUNT, swipeStartDistance },
    explainAt: (point) => explainTargetAt(LAYOUT, shown, point),
    hold: {
      holdMs: read(gameData.tuning, "seconds", "explainHoldSeconds") * 1000,
      slopPx: swipeStartDistance,
    },
    layout: LAYOUT,
    quietTaps: debuffBarRects(LAYOUT.topBar, shown.debuffs.length),
    stepMoves,
  };
}
