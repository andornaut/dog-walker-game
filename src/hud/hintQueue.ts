import type { HintId } from "../data/types";

// The first-time hint queue. One hint shows at a time, in the order raised. A hint belongs to
// what was on screen when it was raised: the walk, or a hold (a card or the pause menu up).
// - A walk hint never shows during a hold: one showing when a hold starts is put back at the
//   front of the queue, and its clock and its age stop until the hold ends.
// - A hold hint shows only during a hold, and is dropped when the hold ends.
// - A hint still queued staleMs after it was raised, counting only time in its own context, is
//   dropped unshown; the caller marks a hint shown only when it starts, so it is raised again
//   the next time it triggers.
// - While blocked (the state strip's bubble is open), no hint starts.
export type HintContext = "hold" | "walk";

export interface RaisedHint {
  readonly id: HintId;
  readonly text: string;
}

export interface QueuedHint extends RaisedHint {
  readonly ageMs: number;
  readonly context: HintContext;
  // What is left of its time on screen, the fade included.
  readonly leftMs: number;
}

export interface HintQueue {
  readonly queue: readonly QueuedHint[];
  readonly shown: QueuedHint | null;
}

export interface HintTiming {
  readonly fadeMs: number;
  readonly holdMs: number;
  readonly staleMs: number;
}

export interface HintTick {
  readonly blocked: boolean;
  readonly dtMs: number;
  readonly held: boolean;
  readonly raised: readonly RaisedHint[];
}

export const EMPTY_HINT_QUEUE: HintQueue = { queue: [], shown: null };

export function stepHintQueue(timing: HintTiming, tick: HintTick, state: HintQueue): HintQueue {
  const context: HintContext = tick.held ? "hold" : "walk";
  const onScreenMs = timing.holdMs + timing.fadeMs;
  const all = state.shown === null ? state.queue : [state.shown, ...state.queue];
  const ids = new Set(all.map(({ id }) => id));
  let queue: QueuedHint[] = [...state.queue];
  for (const hint of tick.raised) {
    if (!ids.has(hint.id)) {
      ids.add(hint.id);
      queue.push({ ...hint, ageMs: 0, context, leftMs: onScreenMs });
    }
  }
  let shown = state.shown;
  if (shown !== null && shown.context !== context) {
    queue = shown.context === "walk" ? [shown, ...queue] : queue;
    shown = null;
  }
  if (shown !== null) {
    const leftMs = shown.leftMs - tick.dtMs;
    shown = leftMs > 0 ? { ...shown, leftMs } : null;
  }
  // A walk hint put back by a hold has been seen, so it resumes however old it is.
  const fresh = (hint: QueuedHint) => hint.leftMs < onScreenMs || hint.ageMs <= timing.staleMs;
  queue = queue
    .filter((hint) => tick.held || hint.context === "walk")
    .map((hint) => (hint.context === context ? { ...hint, ageMs: hint.ageMs + tick.dtMs } : hint))
    .filter((hint) => hint.context !== context || fresh(hint));
  if (shown === null && !tick.blocked) {
    const next = queue.find((hint) => hint.context === context);
    if (next !== undefined) {
      shown = next;
      queue = queue.filter((hint) => hint !== next);
    }
  }
  return { queue, shown };
}

// Closes the hint on screen, as the strip's bubble opening does. It counts as shown.
export function dismissHint(state: HintQueue): HintQueue {
  return { ...state, shown: null };
}

// How opaque the hint on screen is: whole until its last fadeMs, then fading out.
export function hintAlpha(timing: HintTiming, hint: QueuedHint): number {
  return Math.min(1, hint.leftMs / timing.fadeMs);
}
