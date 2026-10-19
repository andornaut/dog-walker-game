import type { Point } from "../layout/rect";
import {
  type GestureAction,
  type GestureContext,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "./gestures";

// cancel: the browser called the press off (a system gesture, an incoming call).
export type PointerPhase = "cancel" | "down" | "move" | "up";

// One press of a pointer. downTime tells it from the pointer's next press, so the events of a
// press whose down went to another scene are never taken for the tracked one's.
export interface Press {
  readonly downTime: number;
  readonly id: number;
}

// onButton: the press went down on a top-bar button.
export interface PointerSample {
  readonly onButton: boolean;
  readonly phase: PointerPhase;
  readonly point: Point;
  readonly press: Press;
}

// The press driving the gesture; undefined exactly while the gesture is idle.
export interface PointerTrack {
  readonly gesture: GestureState;
  readonly press: Press | undefined;
}

export const idleTrack: PointerTrack = { gesture: idleGesture, press: undefined };

export interface PointerResult {
  actions: GestureAction[];
  track: PointerTrack;
}

const none = (track: PointerTrack): PointerResult => ({ actions: [], track });

const samePress = (a: Press | undefined, b: Press): boolean =>
  a !== undefined && a.id === b.id && a.downTime === b.downTime;

// A pointer presses once at a time, so a later press of the tracked pointer means the tracked
// press ended without its release reaching this scene.
function endedUnseen(press: Press, track: PointerTrack): PointerTrack {
  return track.press?.id === press.id && !samePress(track.press, press) ? idleTrack : track;
}

// The latest press drives the gestures. A press on a top-bar button is the HUD's and drives
// none. held: a card or a menu takes every press, and the one under way is dropped. A hit stop
// is no hold: its lane moves are dropped where they act, as a lock's are, and the drag goes on.
export function trackPointer(
  context: GestureContext,
  held: boolean,
  sample: PointerSample,
  track: PointerTrack,
): PointerResult {
  const { phase, point, press } = sample;
  const current = endedUnseen(press, track);
  if (held) {
    return none(idleTrack);
  }
  if (phase === "down") {
    return none(sample.onButton ? current : { gesture: pointerDown(context, point).state, press });
  }
  if (!samePress(current.press, press)) {
    return none(current);
  }
  if (phase === "cancel") {
    return none(idleTrack);
  }
  if (phase === "move") {
    const { actions, state } = pointerMove(context, point, current.gesture);
    return { actions, track: { gesture: state, press } };
  }
  return { actions: pointerUp(context, point, current.gesture).actions, track: idleTrack };
}
