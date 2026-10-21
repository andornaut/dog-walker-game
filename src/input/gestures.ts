import type { LaneDirection } from "../layout/lanes";
import { containsPoint, type Point } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";

// Distances are in screen pixels. A lane-width is the road width over laneCount.
// swipeStartDistance: the travel that takes a drag's first lane step, and the travel back that
// turns it around.
export interface GestureConfig {
  laneCount: number;
  swipeStartDistance: number;
  tapMaxDistance: number;
}

export interface GestureContext {
  config: GestureConfig;
  layout: Pick<ScreenLayout, "road" | "topBar">;
}

export type GestureAction = { direction: LaneDirection; kind: "move" } | { kind: "pause" };

// One leg of a drag: a run of travel one way. Its lane steps count from anchorX: the first at
// swipeStartDistance and the Nth at N lane-widths. direction is the way its steps
// go, 0 before the first; steps is how many it has taken; peakX is the furthest x reached
// that way. Travelling back swipeStartDistance from peakX starts a new leg there.
export interface DragLeg {
  anchorX: number;
  direction: LaneDirection | 0;
  peakX: number;
  steps: number;
}

// start is where the press went down. tapping holds until the press leaves the tap distance
// or takes a lane step.
// topBar: a press on the top bar, which only pauses on a tap and never drags.
// dragging: a press anywhere else, steering by its current leg; x is the latest pointer x.
export type GestureState =
  | { kind: "idle" }
  | { kind: "topBar"; start: Point; tapping: boolean }
  | { kind: "dragging"; leg: DragLeg; start: Point; tapping: boolean; x: number };

export interface GestureResult {
  actions: GestureAction[];
  state: GestureState;
}

export const idleGesture: GestureState = { kind: "idle" };

// Split at the road's centre, so both halves of the road are the same width.
function tapDirection(layout: GestureContext["layout"], x: number): LaneDirection {
  return x < layout.road.x + layout.road.width / 2 ? -1 : 1;
}

const move = (direction: LaneDirection): GestureAction => ({ direction, kind: "move" });

// The direction of a mostly horizontal drag that has passed the minimum distance.
export function swipeDirection(
  minDistance: number,
  start: Point,
  end: Point,
): LaneDirection | undefined {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy)) {
    return undefined;
  }
  return dx < 0 ? -1 : 1;
}

// Past the distance a tap may move before it stops being a tap.
export function exceedsTapDistance(maxDistance: number, start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > maxDistance;
}

// Browser touch coordinates are float32 and then scaled to the game, so travel of exactly a
// lane-width can read about 1e-5px short of it. Travel within this many pixels of a distance
// counts as reaching it.
const PIXEL_TOLERANCE = 1e-3;

const legAt = (x: number): DragLeg => ({ anchorX: x, direction: 0, peakX: x, steps: 0 });

// The steps a leg has taken after travel from its anchor: none short of swipeStartDistance,
// then one per whole lane-width, and always at least one.
function legSteps({ config, layout }: GestureContext, travel: number): number {
  const distance = Math.abs(travel) + PIXEL_TOLERANCE;
  if (distance < config.swipeStartDistance) {
    return 0;
  }
  return Math.max(1, Math.floor((distance * config.laneCount) / layout.road.width));
}

// The pointer reached x: the leg's new steps, or a new leg from the peak once the pointer
// has turned back swipeStartDistance.
function dragTo(
  context: GestureContext,
  x: number,
  leg: DragLeg,
): { actions: GestureAction[]; leg: DragLeg } {
  const turnedBack = (leg.peakX - x) * leg.direction + PIXEL_TOLERANCE;
  if (leg.direction !== 0 && turnedBack >= context.config.swipeStartDistance) {
    return dragTo(context, x, legAt(leg.peakX));
  }
  const travel = x - leg.anchorX;
  const way: LaneDirection = (leg.direction === 0 ? travel : leg.direction) < 0 ? -1 : 1;
  const steps = travel * way > 0 ? Math.max(leg.steps, legSteps(context, travel)) : leg.steps;
  if (steps === 0) {
    return { actions: [], leg };
  }
  const peakX = leg.direction === 0 || (x - leg.peakX) * way > 0 ? x : leg.peakX;
  return {
    actions: Array.from({ length: steps - leg.steps }, () => move(way)),
    leg: { anchorX: leg.anchorX, direction: way, peakX, steps },
  };
}

// A press on the doghouses drags and taps like one anywhere on the walk.
export function pointerDown(context: GestureContext, point: Point): GestureResult {
  const state: GestureState = containsPoint(context.layout.topBar, point.x, point.y)
    ? { kind: "topBar", start: point, tapping: true }
    : { kind: "dragging", leg: legAt(point.x), start: point, tapping: true, x: point.x };
  return { actions: [], state };
}

// A drag steps as soon as it passes a distance, not on release, and goes on stepping as it
// travels on. Vertical travel never steps a lane.
export function pointerMove(
  context: GestureContext,
  point: Point,
  state: GestureState,
): GestureResult {
  if (state.kind === "idle") {
    return { actions: [], state };
  }
  const tapping =
    state.tapping && !exceedsTapDistance(context.config.tapMaxDistance, state.start, point);
  if (state.kind === "topBar") {
    return { actions: [], state: { ...state, tapping } };
  }
  const { actions, leg } = dragTo(context, point.x, state.leg);
  return {
    actions,
    state: { ...state, leg, tapping: tapping && actions.length === 0, x: point.x },
  };
}

// A tap on the top bar pauses; anywhere else, the doghouse cards included, it steers toward
// the tapped half of the road: the cards take no taps of their own.
function tapAction(layout: GestureContext["layout"], { x, y }: Point): GestureAction[] {
  if (containsPoint(layout.topBar, x, y)) {
    return [{ kind: "pause" }];
  }
  return [move(tapDirection(layout, x))];
}

// A tap acts on release, once it can no longer turn into a drag.
export function pointerUp(
  context: GestureContext,
  point: Point,
  state: GestureState,
): GestureResult {
  const { actions, state: moved } = pointerMove(context, point, state);
  if (moved.kind === "idle" || !moved.tapping) {
    return { actions, state: idleGesture };
  }
  return { actions: tapAction(context.layout, moved.start), state: idleGesture };
}
