import type { Input, Scene } from "phaser";

import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import { gameplayAllowed, type RunPause, topBarButtonAt, walkPresses } from "../../hud/topBar";
import {
  debuffBarRects,
  type ExplainShown,
  type ExplainTarget,
  explainTargetAt,
  opensOnTap,
} from "../../hud/walkHud";
import type { GestureAction } from "../../input/gestures";
import { holdRule } from "../../input/hold";
import { walkKeyAction } from "../../input/keyBindings";
import {
  idleTrack,
  type PointerSample,
  type PointerTrack,
  type PressMode,
  tickTrack,
  type TrackContext,
  trackPointer,
} from "../../input/pointerTracking";
import type { LaneDirection } from "../../layout/lanes";
import type { Point } from "../../lib/rect";
import { read } from "../../rules/units";
import type { SessionInput } from "../../runner/session";
import { steerWalk, type Walk } from "../../runner/walk";
import { addTapBurst, afterTapFx } from "../uiKit";
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
// simulation step, and the explanation a still press on a HUD element opens.
export class RunInput {
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
  // its release may never arrive. An open explanation closes with it.
  dropPress(): void {
    this.pointers = idleTrack;
  }

  // The explanation a hold opened, while it is open; the walk stays paused until a tap closes
  // it.
  explanation(): ExplainTarget | undefined {
    return this.pointers.open;
  }

  // Each frame: a press held still on an element long enough opens its explanation.
  tick(nowMs: number): void {
    const presses = this.presses();
    this.pointers = tickTrack(this.context(presses), presses, nowMs, this.pointers);
  }

  // M, P and Escape are the walk bar's keys, which the HUD handles. Phaser hands a key down to
  // this listener as the browser fires it, auto-repeats included.
  private onKey(event: KeyboardEvent): void {
    const action = walkKeyAction(event.key, event.repeat);
    if (action !== undefined) {
      this.act(action);
    }
  }

  // What the walk's presses do now: nothing once the walk is over or before it starts. A card
  // open is part of the walk.
  private presses(): PressMode {
    const walk = this.host.walk();
    const going = walk !== undefined && walk.run.phase.kind !== "ended";
    return going ? walkPresses(this.host.runPause()) : "none";
  }

  // Phaser reports a cancelled touch as a release with wasCanceled set. The run scene keeps
  // running while a card, the zone celebration or the pause menu covers the walk, and the press
  // is theirs then, but for what explains itself in what they leave in view. A press on what
  // opens on a tap bursts as it lands, as a button's does, and its tap opens the explanation once
  // the burst has played out.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    const presses = this.presses();
    const context = this.context(presses);
    const point = { x: pointer.x, y: pointer.y };
    if (phase === "down" && presses !== "none" && this.pointers.open === undefined) {
      const target = context.explainAt(point);
      if (target !== undefined && context.opensOnTap(target)) {
        addTapBurst(this.scene, point.x, point.y);
      }
    }
    const sample: PointerSample = {
      onButton: phase === "down" && topBarButtonAt(pointer.x, pointer.y) !== undefined,
      phase: phase === "up" && pointer.wasCanceled ? "cancel" : phase,
      point,
      press: { downTime: pointer.downTime, id: pointer.id },
      timeMs: this.scene.game.loop.time,
    };
    const result = trackPointer(context, presses, sample, this.pointers);
    this.pointers = result.track;
    result.actions.forEach((action) => this.act(action));
    const { tapped } = result;
    if (tapped !== undefined) {
      afterTapFx(this.scene, () => this.openTapped(tapped));
    }
  }

  // Opens the explanation of what a tap at point landed on, if presses still reach it and it
  // still explains itself, dropping every press as a hold's opening does.
  private openTapped(point: Point): void {
    const presses = this.presses();
    if (presses === "none" || this.pointers.open !== undefined) {
      return;
    }
    const open = this.context(presses).explainAt(point);
    if (open !== undefined) {
      this.pointers = { ...idleTrack, open };
    }
  }

  private context(presses: PressMode): TrackContext<ExplainTarget> {
    const stepMoves = (direction: LaneDirection) => this.stepMoves(direction);
    return trackContext(presses === "explain", this.host.explainShown(), stepMoves);
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

// A tap on a debuff bar does nothing, and a press on anything that explains itself opens its
// explanation once still for holdSeconds within swipeStartDistance, the drag's first
// step, or on a tap within it for what opens on a tap (opensOnTap). dimmed: an overlay's dim
// takes the presses on the walk view.
function trackContext(
  dimmed: boolean,
  shown: ExplainShown,
  stepMoves: (direction: LaneDirection) => boolean,
): TrackContext<ExplainTarget> {
  const swipeStartDistance = read(gameData.tuning, "pixels", "swipeStartDistance");
  return {
    config: { laneCount: LANE_COUNT, swipeStartDistance },
    explainAt: (point) => explainTargetAt(LAYOUT, shown, dimmed, point),
    hold: holdRule(gameData.tuning, swipeStartDistance),
    layout: LAYOUT,
    opensOnTap: (target) => opensOnTap(shown, target),
    quietTaps: debuffBarRects(LAYOUT.topBar, shown.debuffs.length),
    stepMoves,
  };
}
