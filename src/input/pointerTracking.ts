import type { Point } from "../lib/rect";
import {
  type GestureAction,
  type GestureContext,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "./gestures";
import { type HoldPress, type HoldRule, moveHold, releaseHold, startHold, tickHold } from "./hold";

// cancel: the browser called the press off (a system gesture, an incoming call).
export type PointerPhase = "cancel" | "down" | "move" | "up";

// One press of a pointer. downTime tells it from the pointer's next press, so the events of a
// press whose down went to another scene are never taken for the tracked one's.
export interface Press {
  readonly downTime: number;
  readonly id: number;
}

// onButton: the press went down on a walk-bar button. timeMs: when the event came.
export interface PointerSample {
  readonly onButton: boolean;
  readonly phase: PointerPhase;
  readonly point: Point;
  readonly press: Press;
  readonly timeMs: number;
}

// A press on an element that explains itself: a hold candidate until it moves or lifts, and
// explaining once the hold has fired.
export interface Holding<Target> {
  readonly press: HoldPress;
  readonly target: Target;
}

// The press driving the gesture; undefined exactly while the gesture is idle. hold: the press
// went down on an element that explains itself.
export interface PointerTrack<Target> {
  readonly gesture: GestureState;
  readonly hold: Holding<Target> | undefined;
  readonly press: Press | undefined;
}

export const idleTrack: PointerTrack<never> = {
  gesture: idleGesture,
  hold: undefined,
  press: undefined,
};

// The walk's gestures, the hold that explains, and what a press at a point would explain.
export interface TrackContext<Target> extends GestureContext {
  explainAt: (point: Point) => Target | undefined;
  hold: HoldRule;
}

// explain: an explanation starts with its target, or the one showing ends.
export type ExplainChange<Target> = { kind: "end" } | { kind: "start"; target: Target };

interface PointerResult<Target> {
  actions: GestureAction[];
  explain: ExplainChange<Target> | undefined;
  track: PointerTrack<Target>;
}

// Whether the track's press is holding an explanation up.
export function explaining<Target>(track: PointerTrack<Target>): boolean {
  return track.hold?.press.state === "held";
}

const samePress = (a: Press | undefined, b: Press): boolean =>
  a !== undefined && a.id === b.id && a.downTime === b.downTime;

// A pointer presses once at a time, so a later press of the tracked pointer means the tracked
// press ended without its release reaching this scene.
function endedUnseen<Target>(press: Press, track: PointerTrack<Target>): PointerTrack<Target> {
  return track.press?.id === press.id && !samePress(track.press, press) ? idleTrack : track;
}

// The explanation ends whenever the track that held it up stops holding it.
function result<Target>(
  before: PointerTrack<Target>,
  actions: GestureAction[],
  track: PointerTrack<Target>,
): PointerResult<Target> {
  const ended = explaining(before) && !explaining(track);
  return { actions, explain: ended ? { kind: "end" } : undefined, track };
}

// The latest press drives the gestures, so a finger resting on the screen never holds the
// steering from the one that lands after it. A press on a walk-bar button is the HUD's and
// drives none. held: a card or a menu takes every press, and the one under way is dropped. A hit
// stop is no hold: its lane moves are dropped where they act, and the drag goes on. A press on
// an element that explains itself holds to explain once it has stayed within the hold's slop
// for its time (tickTrack); one that moves past it, or takes a lane step, steers as any drag
// does. Its tap steers as the press lands all the same, as on a dog card. While it explains, it
// moves nothing, and its release ends it.
export function trackPointer<Target>(
  context: TrackContext<Target>,
  held: boolean,
  sample: PointerSample,
  track: PointerTrack<Target>,
): PointerResult<Target> {
  const { phase, point, press } = sample;
  const current = endedUnseen(press, track);
  if (held) {
    return result(track, [], idleTrack);
  }
  if (phase === "down") {
    if (sample.onButton) {
      return result(track, [], current);
    }
    const target = context.explainAt(point);
    const hold =
      target === undefined
        ? undefined
        : { press: startHold(context.hold, point, sample.timeMs), target };
    const { actions, state } = pointerDown(context, point);
    return result(track, actions, { gesture: state, hold, press });
  }
  if (!samePress(current.press, press)) {
    return result(track, [], current);
  }
  if (phase === "cancel") {
    return result(track, [], idleTrack);
  }
  if (explaining(current)) {
    return result(track, [], phase === "up" ? idleTrack : current);
  }
  if (phase === "move") {
    const { actions, state, stepped } = pointerMove(context, point, current.gesture);
    return result(track, actions, {
      gesture: state,
      hold: steered(current.hold, point, stepped),
      press,
    });
  }
  // A hold whose time came up between frames is a hold, and its release steps nothing.
  const { hold } = current;
  if (hold !== undefined && releaseHold(hold.press, sample.timeMs) === "hold") {
    return result(track, [], idleTrack);
  }
  return result(track, pointerUp(context, point, current.gesture).actions, idleTrack);
}

// A hold candidate that moved past its slop, or whose drag took a lane step, steers instead.
function steered<Target>(
  hold: Holding<Target> | undefined,
  point: Point,
  stepped: boolean,
): Holding<Target> | undefined {
  if (hold === undefined) {
    return undefined;
  }
  const press = moveHold(hold.press, point);
  return stepped || press.state === "moved" ? undefined : { ...hold, press };
}

// Each frame: a hold candidate that has stayed still for the hold's time starts explaining its
// target.
export function tickTrack<Target>(
  nowMs: number,
  track: PointerTrack<Target>,
): { explain: ExplainChange<Target> | undefined; track: PointerTrack<Target> } {
  const { hold } = track;
  if (hold === undefined) {
    return { explain: undefined, track };
  }
  const { fire, press } = tickHold(hold.press, nowMs);
  if (!fire) {
    return { explain: undefined, track };
  }
  return {
    explain: { kind: "start", target: hold.target },
    track: { ...track, hold: { ...hold, press } },
  };
}
