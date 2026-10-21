import type { LaneDirection } from "../layout/lanes";
import type { ScreenLayout } from "../layout/screenLayout";
import { containsPoint, type Point, type Rect } from "../lib/rect";

// Distances are in screen pixels. A lane-width is the road width over laneCount.
// swipeStartDistance: the travel that takes a drag's first lane step, and the travel back that
// turns it around.
interface GestureConfig {
  laneCount: number;
  swipeStartDistance: number;
}

// quietTaps: where a tap does nothing, as on the walk bar, though a drag that starts there
// still steers. stepMoves: whether a lane step that way would move the pack now; false at the
// road's edge, or while steering is dropped.
export interface GestureContext {
  config: GestureConfig;
  layout: Pick<ScreenLayout, "dogRow" | "road" | "topBar">;
  quietTaps?: readonly Rect[];
  stepMoves: (direction: LaneDirection) => boolean;
}

export type GestureAction = { direction: LaneDirection; kind: "move" };

// One leg of a drag: a run of travel one way. Its lane steps count from anchorX: the first at
// swipeStartDistance and the Nth at N lane-widths. direction is the way its steps
// go, 0 before the first; steps is how many it has taken; peakX is the furthest x reached
// that way. Travelling back swipeStartDistance from peakX starts a new leg there.
interface DragLeg {
  anchorX: number;
  direction: LaneDirection | 0;
  peakX: number;
  steps: number;
}

// topBar: a press on the walk bar, which never drags and whose tap does nothing.
// dragging: a press anywhere else, steering by its current leg. tap: the way the press's tap
// moved the pack, until the drag's first step takes it over; 0 when it moved nothing.
// releaseTap: where a press on the doghouse row landed, which taps on release unless its drag
// steps first.
export type GestureState =
  | { kind: "idle" }
  | { kind: "topBar" }
  | { kind: "dragging"; leg: DragLeg; releaseTap: Point | undefined; tap: LaneDirection | 0 };

// stepped: the drag took a lane step, counting one its tap had already taken.
export interface GestureResult {
  actions: GestureAction[];
  state: GestureState;
  stepped: boolean;
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

// A tap on the walk bar or a quiet rect does nothing; anywhere else, the dog cards included, it
// steers toward the pressed half of the road, if a step that way would move the pack: the cards
// take no taps of their own.
function tapAt(context: GestureContext, { x, y }: Point): LaneDirection | 0 {
  const quiet = [context.layout.topBar, ...(context.quietTaps ?? [])];
  if (quiet.some((rect) => containsPoint(rect, x, y))) {
    return 0;
  }
  const direction = tapDirection(context.layout, x);
  return context.stepMoves(direction) ? direction : 0;
}

// A tap acts as the press lands, so every press that never steps a drag counts as one. On the
// doghouse row it acts on release instead, so a press held there to explain a dog card never
// steers; a drag from the row steers like one anywhere on the walk.
export function pointerDown(context: GestureContext, point: Point): GestureResult {
  const { dogRow, topBar } = context.layout;
  if (containsPoint(topBar, point.x, point.y)) {
    return { actions: [], state: { kind: "topBar" }, stepped: false };
  }
  const leg = legAt(point.x);
  if (containsPoint(dogRow, point.x, point.y)) {
    return {
      actions: [],
      state: { kind: "dragging", leg, releaseTap: point, tap: 0 },
      stepped: false,
    };
  }
  const tap = tapAt(context, point);
  return {
    actions: tap === 0 ? [] : [move(tap)],
    state: { kind: "dragging", leg, releaseTap: undefined, tap },
    stepped: false,
  };
}

// The drag's first steps, given the way its tap moved the pack: the tap was the first step
// that way, and a first step the other way takes the tap back too, so the pack ends where the
// drag alone would put it.
function afterTap(tap: LaneDirection | 0, actions: GestureAction[]): GestureAction[] {
  const [first] = actions;
  if (tap === 0 || first === undefined) {
    return actions;
  }
  return first.direction === tap ? actions.slice(1) : [first, ...actions];
}

// A drag steps as soon as it passes a distance, not on release, and goes on stepping as it
// travels on, relative to where the press landed. Vertical travel never steps a lane.
export function pointerMove(
  context: GestureContext,
  point: Point,
  state: GestureState,
): GestureResult {
  if (state.kind !== "dragging") {
    return { actions: [], state, stepped: false };
  }
  const { actions, leg } = dragTo(context, point.x, state.leg);
  const stepped = actions.length > 0;
  return {
    actions: stepped ? afterTap(state.tap, actions) : [],
    state: {
      kind: "dragging",
      leg,
      releaseTap: stepped ? undefined : state.releaseTap,
      tap: stepped ? 0 : state.tap,
    },
    stepped,
  };
}

// The release steps any travel since the last move, taps for a doghouse-row press whose drag
// never stepped, and ends the press.
export function pointerUp(
  context: GestureContext,
  point: Point,
  state: GestureState,
): GestureResult {
  const moved = pointerMove(context, point, state);
  const releaseTap = moved.state.kind === "dragging" ? moved.state.releaseTap : undefined;
  const tap = releaseTap === undefined ? 0 : tapAt(context, releaseTap);
  const actions = tap === 0 ? moved.actions : [move(tap)];
  return { actions, state: idleGesture, stepped: moved.stepped };
}
