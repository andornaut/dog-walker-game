import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  readonly state: unknown;
}

// The history state of the extra entry that back pops instead of leaving the game.
export const BACK_GUARD_STATE = { dogWalkerBackGuard: true } as const;

// The player's input that pushes the guard entry when it is missing. Each one is, or comes with,
// a user activation, so the browser counts the entry when going back.
export const BACK_GUARD_GESTURES = ["keydown", "pointerdown", "pointerup"] as const;

function isBackGuardState(state: unknown): boolean {
  return (state as { dogWalkerBackGuard?: unknown } | null)?.dogWalkerBackGuard === true;
}

// Keeps back (Android gesture or button, or the browser's Back) on the game: a guard history
// entry for back to pop, pushed again on each pop. In a browser tab each back dispatches
// back-pressed on eventTarget; installed as an app (asApp), back does nothing.
// Chrome and Firefox skip an entry added without user activation when going back (Firefox skips
// the entry under it), so the guard is pushed from the player's first input, not at load, and
// again from any later input that finds it missing.
// This cannot stop the system closing the app or a browser showing its own leave prompt.
export function guardBackNavigation(
  asApp: boolean,
  eventTarget: EventTarget,
  history: HistoryLike,
): void {
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
    if (!asApp) {
      dispatchPhoneEvent(eventTarget, PHONE_EVENTS.backPressed);
    }
  };
  for (const type of BACK_GUARD_GESTURES) {
    eventTarget.addEventListener(type, pushGuard, { capture: true, passive: true });
  }
  eventTarget.addEventListener("popstate", onPopState);
}
