import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

export interface HistoryLike {
  go(delta: number): void;
  pushState(data: unknown, unused: string): void;
  readonly state: unknown;
}

// What leaving the game needs of the page besides its history.
export interface LeaveHost {
  // Closes the window, where the browser lets a script close it.
  close(): void;
  setTimeout(handler: () => void, ms: number): unknown;
}

// The history state of the extra entry that back pops instead of leaving the game.
export const BACK_GUARD_STATE = { dogWalkerBackGuard: true } as const;

// The player's input that pushes the guard entry when it is missing. Each one is, or comes with,
// a user activation, so the browser counts the entry when going back.
export const BACK_GUARD_GESTURES = ["keydown", "pointerdown", "pointerup"] as const;

// How long leaving waits for the page to go before it tries closing the window instead.
export const LEAVE_WAIT_MS = 500;

export interface BackGuard {
  // Leaves the game: back over the guard entry, without pushing it again, then back past the
  // game's own entry to the previous page. With none (an installed app's launch, or a tab opened
  // on the game), it closes the window where the browser allows; where it doesn't, the game stays
  // on its own entry with no guard, so the next back is the browser's (an installed app closes)
  // unless the player's input first pushes the guard again.
  leave(): void;
}

function isBackGuardState(state: unknown): boolean {
  return (state as { dogWalkerBackGuard?: unknown } | null)?.dogWalkerBackGuard === true;
}

// Keeps back (Android gesture or button, or the browser's Back) on the game, in a browser tab or
// installed as an app: a guard history entry for back to pop, pushed again on each pop, and each
// back dispatches back-pressed on eventTarget for the scenes to act on.
// Chrome and Firefox skip an entry added without user activation when going back (Firefox skips
// the entry under it), so the guard is pushed from the player's first input, not at load, and
// again from any later input that finds it missing.
// This cannot stop the system closing the app or a browser showing its own leave prompt.
export function guardBackNavigation(
  eventTarget: EventTarget,
  host: LeaveHost,
  history: HistoryLike,
): BackGuard {
  // Whether leave has stepped back over the guard and goes on past the game's own entry once it
  // lands there.
  let leaving = false;
  const pushGuard = () => {
    if (!isBackGuardState(history.state)) {
      history.pushState(BACK_GUARD_STATE, "");
    }
  };
  const onPopState = () => {
    if (leaving) {
      leaving = false;
      history.go(-1);
      return;
    }
    // Forward onto the guard entry is not a back press.
    if (isBackGuardState(history.state)) {
      return;
    }
    pushGuard();
    dispatchPhoneEvent(eventTarget, PHONE_EVENTS.backPressed);
  };
  for (const type of BACK_GUARD_GESTURES) {
    eventTarget.addEventListener(type, pushGuard, { capture: true, passive: true });
  }
  eventTarget.addEventListener("popstate", onPopState);
  return {
    leave() {
      // A page kept for back-forward caching hides here: back on it later must not close it.
      let hidden = false;
      const onPageHide = () => {
        hidden = true;
      };
      eventTarget.addEventListener("pagehide", onPageHide, { once: true });
      leaving = isBackGuardState(history.state);
      history.go(-1);
      host.setTimeout(() => {
        eventTarget.removeEventListener("pagehide", onPageHide);
        if (!hidden) {
          host.close();
        }
      }, LEAVE_WAIT_MS);
    },
  };
}
