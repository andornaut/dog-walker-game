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

// What the walk's presses do. steer: they drive the gestures, and a hold explains. explain: only
// a hold explains, while a menu pauses the walk but leaves what explains itself in view. none:
// an overlay takes every press.
export type PressMode = "explain" | "none" | "steer";

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

// The press driving the gesture; undefined exactly while the gesture is idle. hold: the press
// went down on an element that explains itself, a hold candidate until it moves or lifts.
// open: the explanation a hold opened, which stays open after its press lifts. closing: a press
// that went down while it was open, whose release closes it.
export interface PointerTrack<Target> {
  readonly closing: Press | undefined;
  readonly gesture: GestureState;
  readonly hold: HoldPress | undefined;
  readonly open: Target | undefined;
  readonly press: Press | undefined;
}

export const idleTrack: PointerTrack<never> = {
  closing: undefined,
  gesture: idleGesture,
  hold: undefined,
  open: undefined,
  press: undefined,
};

// The walk's gestures, the hold that explains, what a press at a point would explain, and
// whether a tap opens that explanation too.
export interface TrackContext<Target> extends GestureContext {
  explainAt: (point: Point) => Target | undefined;
  hold: HoldRule;
  opensOnTap: (target: Target) => boolean;
}

// tapped: where a tap landed on something that opens its explanation on a tap. The caller opens
// it (explainAt there) once the tap's burst has played out, as a button opens what it opens.
interface PointerResult<Target> {
  actions: GestureAction[];
  tapped?: Point;
  track: PointerTrack<Target>;
}

// Whether a press that went down at start and lifts at point, short of the hold's time, taps
// something that opens on a tap: it stayed within the hold's slop.
function tapOpens<Target>(context: TrackContext<Target>, hold: HoldPress, point: Point): boolean {
  const target = context.explainAt(hold.start);
  return (
    target !== undefined && context.opensOnTap(target) && moveHold(point, hold).state === "holding"
  );
}

const samePress = (a: Press | undefined, b: Press): boolean =>
  a !== undefined && a.id === b.id && a.downTime === b.downTime;

// A pointer presses once at a time, so a later press of the tracked pointer means the tracked
// press ended without its release reaching this scene.
function endedUnseen<Target>(press: Press, track: PointerTrack<Target>): PointerTrack<Target> {
  return track.press?.id === press.id && !samePress(track.press, press) ? idleTrack : track;
}

// The explanation of what the hold went down on, if it still explains something, opened with
// every press dropped, so neither the press that opened it nor any finger still down steers.
function opened<Target>(context: TrackContext<Target>, hold: HoldPress): PointerTrack<Target> {
  return { ...idleTrack, open: context.explainAt(hold.start) };
}

// While an explanation is open, every press is its: a press that goes down there, on a walk-bar
// button too, closes it when it lifts and does nothing else, and the press that opened it
// lifts without closing it.
function whileOpen<Target>(
  sample: PointerSample,
  track: PointerTrack<Target>,
): PointerTrack<Target> {
  const { phase, press } = sample;
  if (phase === "down") {
    return { ...track, closing: press };
  }
  if (!samePress(track.closing, press)) {
    return track;
  }
  if (phase === "up") {
    return idleTrack;
  }
  return phase === "cancel" ? { ...track, closing: undefined } : track;
}

// The latest press drives the gestures, so a finger resting on the screen never holds the
// steering from the one that lands after it. A press on a walk-bar button is the HUD's and
// drives none. Under none, the press under way is dropped, along with an open explanation; under
// explain, only a hold acts (holdOnly). A hit stop is no hold: its lane moves are dropped where
// they act, and the drag goes on. A press on an element that explains itself opens its
// explanation once it has stayed within the hold's slop for its time (tickTrack), or lifts after
// that time before a frame ticks; one that moves past the slop, or takes a lane step, steers as
// any drag does. A tap on one that opens on a tap reports where it landed (tapped).
export function trackPointer<Target>(
  context: TrackContext<Target>,
  presses: PressMode,
  sample: PointerSample,
  track: PointerTrack<Target>,
): PointerResult<Target> {
  const { phase, point, press } = sample;
  if (presses === "none") {
    return { actions: [], track: idleTrack };
  }
  if (track.open !== undefined) {
    return { actions: [], track: whileOpen(sample, track) };
  }
  const current = endedUnseen(press, track);
  if (presses === "explain") {
    return holdOnly(context, sample, current);
  }
  if (phase === "down") {
    if (sample.onButton) {
      return { actions: [], track: current };
    }
    const hold =
      context.explainAt(point) === undefined
        ? undefined
        : startHold(context.hold, point, sample.timeMs);
    const { actions, state } = pointerDown(context, point);
    return { actions, track: { ...idleTrack, gesture: state, hold, press } };
  }
  if (!samePress(current.press, press)) {
    return { actions: [], track: current };
  }
  if (phase === "cancel") {
    return { actions: [], track: idleTrack };
  }
  if (phase === "move") {
    const { actions, state, stepped } = pointerMove(context, point, current.gesture);
    return {
      actions,
      track: { ...current, gesture: state, hold: steered(current.hold, point, stepped) },
    };
  }
  // A hold whose time came up between frames opens, and its release steps nothing.
  const { hold } = current;
  if (hold !== undefined && releaseHold(sample.timeMs, hold) === "hold") {
    return { actions: [], track: opened(context, hold) };
  }
  const { actions } = pointerUp(context, point, current.gesture);
  if (hold !== undefined && tapOpens(context, hold, point)) {
    return { actions, tapped: hold.start, track: idleTrack };
  }
  return { actions, track: idleTrack };
}

// A press while only what explains itself acts: one that goes down on such an element opens its
// explanation as a hold does, or as a tap does on what opens on a tap. Any other press, or a
// press that moves past the slop, does nothing, so its release never steers once the walk goes
// on.
function holdOnly<Target>(
  context: TrackContext<Target>,
  sample: PointerSample,
  track: PointerTrack<Target>,
): PointerResult<Target> {
  const { phase, point, press } = sample;
  if (phase === "down") {
    if (sample.onButton || context.explainAt(point) === undefined) {
      return { actions: [], track: idleTrack };
    }
    const hold = startHold(context.hold, point, sample.timeMs);
    return { actions: [], track: { ...idleTrack, hold, press } };
  }
  const { hold } = track;
  if (hold === undefined || !samePress(track.press, press)) {
    return { actions: [], track };
  }
  if (phase === "move") {
    const moved = moveHold(point, hold);
    return { actions: [], track: moved.state === "moved" ? idleTrack : { ...track, hold: moved } };
  }
  if (phase === "up" && releaseHold(sample.timeMs, hold) === "hold") {
    return { actions: [], track: opened(context, hold) };
  }
  if (phase === "up" && tapOpens(context, hold, point)) {
    return { actions: [], tapped: hold.start, track: idleTrack };
  }
  return { actions: [], track: idleTrack };
}

// A hold candidate that moved past its slop, or whose drag took a lane step, steers instead.
function steered(
  hold: HoldPress | undefined,
  point: Point,
  stepped: boolean,
): HoldPress | undefined {
  if (hold === undefined) {
    return undefined;
  }
  const press = moveHold(point, hold);
  return stepped || press.state === "moved" ? undefined : press;
}

// Each frame: a hold candidate that has stayed still for the hold's time opens its explanation.
// Under none, the press under way and an open explanation drop, as a press then drops them.
export function tickTrack<Target>(
  context: TrackContext<Target>,
  presses: PressMode,
  nowMs: number,
  track: PointerTrack<Target>,
): PointerTrack<Target> {
  if (presses === "none") {
    return idleTrack;
  }
  const { hold } = track;
  if (hold === undefined || !tickHold(nowMs, hold).fire) {
    return track;
  }
  return opened(context, hold);
}
