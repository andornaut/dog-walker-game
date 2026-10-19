import type { LaneDirection } from "../layout/lanes";
import type { Rect } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";

// A pointer position in screen pixels, at a time in milliseconds on one clock.
export interface PointerSample {
  timeMs: number;
  x: number;
  y: number;
}

// Distances in screen pixels, times in milliseconds.
export interface GestureConfig {
  holdDelayMs: number;
  holdRepeatMs: number;
  swipeMinDistance: number;
  tapMaxDistance: number;
}

export interface GestureContext {
  config: GestureConfig;
  layout: Pick<ScreenLayout, "dogColumn" | "dogSlots" | "road">;
}

export type GestureAction =
  { direction: LaneDirection; kind: "move" } | { kind: "treat"; slot: number };

// pressed: still within the tap distance, so a tap, hold or swipe.
// dragging: past the tap distance, so only a swipe.
// holding: repeating moves until the pointer lifts; movement no longer counts.
// spent: swiped, so ignored until the pointer lifts.
export type GestureState =
  | { kind: "idle" }
  | { kind: "pressed"; start: PointerSample }
  | { kind: "dragging"; start: PointerSample }
  | { direction: LaneDirection; kind: "holding"; nextRepeatMs: number }
  | { kind: "spent" };

export interface GestureResult {
  actions: GestureAction[];
  state: GestureState;
}

export const idleGesture: GestureState = { kind: "idle" };

const contains = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;

// The column is split into equal bands, so the padding around a slot still counts as it.
function dogSlotAt(layout: GestureContext["layout"], y: number): number {
  const { dogColumn, dogSlots } = layout;
  const band = Math.floor(((y - dogColumn.y) * dogSlots.length) / dogColumn.height);
  return Math.min(dogSlots.length - 1, Math.max(0, band));
}

// Split at the road's centre, so both halves of the road are the same width.
function tapDirection(layout: GestureContext["layout"], x: number): LaneDirection {
  return x < layout.road.x + layout.road.width / 2 ? -1 : 1;
}

const move = (direction: LaneDirection): GestureAction => ({ direction, kind: "move" });

// Emits every hold move due by nowMs. The scene calls this each frame; the pointer
// handlers call it first, so a late frame does not reorder a hold and a release.
export function advanceGesture(
  context: GestureContext,
  nowMs: number,
  state: GestureState,
): GestureResult {
  const { config, layout } = context;
  let current = state;
  if (current.kind === "pressed") {
    const { start } = current;
    const holdAtMs = start.timeMs + config.holdDelayMs;
    if (nowMs < holdAtMs || contains(layout.dogColumn, start.x, start.y)) {
      return { actions: [], state };
    }
    current = { direction: tapDirection(layout, start.x), kind: "holding", nextRepeatMs: holdAtMs };
  }
  if (current.kind !== "holding") {
    return { actions: [], state };
  }
  const actions: GestureAction[] = [];
  let { nextRepeatMs } = current;
  while (nextRepeatMs <= nowMs) {
    actions.push(move(current.direction));
    nextRepeatMs = config.holdRepeatMs > 0 ? nextRepeatMs + config.holdRepeatMs : Infinity;
  }
  return { actions, state: { ...current, nextRepeatMs } };
}

export function pointerDown(
  context: GestureContext,
  point: PointerSample,
  state: GestureState,
): GestureResult {
  const { actions } = advanceGesture(context, point.timeMs, state);
  return { actions, state: { kind: "pressed", start: point } };
}

// A horizontal swipe moves once, as soon as it passes the minimum distance.
export function pointerMove(
  context: GestureContext,
  point: PointerSample,
  state: GestureState,
): GestureResult {
  const { config } = context;
  const advanced = advanceGesture(context, point.timeMs, state);
  const current = advanced.state;
  if (current.kind !== "pressed" && current.kind !== "dragging") {
    return advanced;
  }
  const dx = point.x - current.start.x;
  const dy = point.y - current.start.y;
  if (Math.abs(dx) >= config.swipeMinDistance && Math.abs(dx) >= Math.abs(dy)) {
    return { actions: [...advanced.actions, move(dx < 0 ? -1 : 1)], state: { kind: "spent" } };
  }
  if (current.kind === "pressed" && Math.hypot(dx, dy) > config.tapMaxDistance) {
    return { actions: advanced.actions, state: { kind: "dragging", start: current.start } };
  }
  return advanced;
}

// A tap acts on release, once it can no longer turn into a swipe or a hold.
export function pointerUp(
  context: GestureContext,
  point: PointerSample,
  state: GestureState,
): GestureResult {
  const { layout } = context;
  const moved = pointerMove(context, point, state);
  if (moved.state.kind !== "pressed") {
    return { actions: moved.actions, state: idleGesture };
  }
  const { start } = moved.state;
  const tap: GestureAction = contains(layout.dogColumn, start.x, start.y)
    ? { kind: "treat", slot: dogSlotAt(layout, start.y) }
    : move(tapDirection(layout, start.x));
  return { actions: [...moved.actions, tap], state: idleGesture };
}
