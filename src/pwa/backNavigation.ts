import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  readonly state: unknown;
}

// The history state of the extra entry that back pops instead of leaving the game.
export const BACK_GUARD_STATE = { dogWalkerBackGuard: true } as const;

function isBackGuardState(state: unknown): boolean {
  return (state as { dogWalkerBackGuard?: unknown } | null)?.dogWalkerBackGuard === true;
}

// Keeps the first back (Android gesture or button, or the browser's Back) on the game: pushes a
// history entry for back to pop, then dispatches back-pressed on eventTarget and pushes the entry
// again. Chrome skips an entry pushed without a user gesture when going back, until the page
// next gets one, so during play, where every lane change is a tap, the entry is always counted.
// Returns a function that stops handling back; the pushed entry stays.
export function guardBackNavigation(eventTarget: EventTarget, history: HistoryLike): () => void {
  const pushGuard = () => {
    if (!isBackGuardState(history.state)) {
      history.pushState(BACK_GUARD_STATE, "");
    }
  };
  const onPopState = () => {
    // Forward onto the guard entry is not a back press.
    if (isBackGuardState(history.state)) {
      return;
    }
    pushGuard();
    dispatchPhoneEvent(eventTarget, PHONE_EVENTS.backPressed);
  };
  pushGuard();
  eventTarget.addEventListener("popstate", onPopState);
  return () => eventTarget.removeEventListener("popstate", onPopState);
}
