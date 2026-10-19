import type { LaneDirection } from "../layout/lanes";
import { containsPoint, type Point } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";

// tapMaxDistance is in screen pixels. A lane step is the road width over laneCount.
export interface GestureConfig {
  laneCount: number;
  tapMaxDistance: number;
}

export interface GestureContext {
  config: GestureConfig;
  layout: Pick<ScreenLayout, "dogRow" | "dogSlots" | "road" | "topBar">;
}

export type GestureAction =
  { direction: LaneDirection; kind: "move" } | { kind: "pause" } | { kind: "treat"; slot: number };

// start is where the press went down. tapping holds until the press leaves the tap distance
// or takes a lane step.
// topBar: a press on the top bar, which only pauses on a tap and never drags.
// dragging: a press anywhere else. Lane steps count from anchorX, steps is the net number
// already emitted since the anchor, and x is the latest pointer x.
export type GestureState =
  | { kind: "idle" }
  | { kind: "topBar"; start: Point; tapping: boolean }
  | { anchorX: number; kind: "dragging"; start: Point; steps: number; tapping: boolean; x: number };

export interface GestureResult {
  actions: GestureAction[];
  state: GestureState;
}

export const idleGesture: GestureState = { kind: "idle" };

// The row is split into equal bands, one per slot. x is inside the row, so the band is a
// valid slot.
function dogSlotAt(layout: GestureContext["layout"], x: number): number {
  const { dogRow, dogSlots } = layout;
  return Math.floor(((x - dogRow.x) * dogSlots.length) / dogRow.width);
}

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
// lane-width can read about 1e-5px short of it. Travel within this many lanes of a whole
// lane-width counts as reaching it.
const LANE_TOLERANCE = 1e-4;

// Whole lane-widths from the anchor, rounded toward zero so both directions step at the
// same distance.
function laneOffset({ config, layout }: GestureContext, anchorX: number, x: number): number {
  const lanes = ((x - anchorX) * config.laneCount) / layout.road.width;
  return Math.trunc(lanes + Math.sign(lanes) * LANE_TOLERANCE);
}

// One move per lane boundary crossed; the sign is the direction.
function laneSteps(count: number): GestureAction[] {
  return Array.from({ length: Math.abs(count) }, () => move(count < 0 ? -1 : 1));
}

// A press on the doghouses can drag too; it gives a treat only on a tap.
export function pointerDown(context: GestureContext, point: Point): GestureResult {
  const state: GestureState = containsPoint(context.layout.topBar, point.x, point.y)
    ? { kind: "topBar", start: point, tapping: true }
    : { anchorX: point.x, kind: "dragging", start: point, steps: 0, tapping: true, x: point.x };
  return { actions: [], state };
}

// Vertical travel never steps a lane, and travelling back undoes steps one at a time.
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
  const steps = laneOffset(context, state.anchorX, point.x);
  return {
    actions: laneSteps(steps - state.steps),
    state: { ...state, steps, tapping: tapping && steps === state.steps, x: point.x },
  };
}

function tapAction(layout: GestureContext["layout"], { x, y }: Point): GestureAction {
  if (containsPoint(layout.topBar, x, y)) {
    return { kind: "pause" };
  }
  if (containsPoint(layout.dogRow, x, y)) {
    return { kind: "treat", slot: dogSlotAt(layout, x) };
  }
  return move(tapDirection(layout, x));
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
  return { actions: [tapAction(context.layout, moved.start)], state: idleGesture };
}

// A pull moved the pack: lane steps count again from the pointer's latest position, so the
// next step is a whole lane-width away.
export function reanchorDrag(state: GestureState): GestureState {
  return state.kind === "dragging" ? { ...state, anchorX: state.x, steps: 0 } : state;
}
