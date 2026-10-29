import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

export interface HistoryLike {
  go(delta: number): void;
  // How many entries the window's session history holds, before and after the current one.
  readonly length: number;
  pushState(data: unknown, unused: string): void;
  readonly state: unknown;
}

// The part of a CloseWatcher the game uses: it fires close on a close request (the Android back
// gesture or button, or Escape on a keyboard) and is spent by it. TypeScript's DOM lib has no
// CloseWatcher type.
export interface CloseWatcherLike extends EventTarget {
  destroy(): void;
}

// Creates a CloseWatcher, where the browser has them.
export type CloseWatcherFactory = () => CloseWatcherLike;

// What leaving the game needs of the page besides its history.
export interface LeaveHost {
  // Closes the window, where the browser lets a script close it.
  close(): void;
  setTimeout(handler: () => void, ms: number): unknown;
}

// The history state of the extra entry that back pops instead of leaving the game.
export const BACK_GUARD_STATE = { dogWalkerBackGuard: true } as const;

// The player's input that pushes the guard entry, or creates the close watcher, when it is
// missing. Each one is, or comes with, a user activation, so the browser counts the entry when
// going back.
export const BACK_GUARD_GESTURES = ["keydown", "pointerdown", "pointerup"] as const;

// How long leaving waits for the page to go before it tries closing the window instead.
export const LEAVE_WAIT_MS = 500;

// The key that is a close request on a keyboard. The game's own keys handle it, so the close it
// causes is not a back press.
const ESCAPE_KEY = "Escape";

export interface BackGuard {
  // Leaves the game. With nothing before the game's entry (an installed app's launch, or a tab
  // opened on the game), it closes the window, which the browser allows while the history holds
  // only that entry. Otherwise it goes back over the guard entry, without pushing it again, and
  // past the game's own entry to the previous page, and closes the window if the page is still
  // there after LEAVE_WAIT_MS. Where the window stays, nothing catches the next back (an
  // installed app closes) unless the player's input first restores the guard or the watcher.
  leave(): void;
}

function isBackGuardState(state: unknown): boolean {
  return (state as { dogWalkerBackGuard?: unknown } | null)?.dogWalkerBackGuard === true;
}

function eventKey(event: Event): unknown {
  return (event as { key?: unknown }).key;
}

// Keeps back (Android gesture or button, or the browser's Back) on the game, in a browser tab or
// installed as an app; each back dispatches back-pressed on eventTarget for the scenes to act on.
// Two ways catch it:
// - A close watcher, where the browser has CloseWatcher, created at load and again after each
//   close it fires. It adds no history entry, so with nothing before the game the history holds
//   one entry and leave may close the window.
// - A guard history entry for back to pop, pushed again on each pop, where there is no
//   CloseWatcher or the history already holds more than one entry, so the window could not close
//   anyway. It also catches a desktop browser's Back button, which is not a close request.
//   Chrome and Firefox skip an entry added without user activation when going back (Firefox
//   skips the entry under it), so the guard is pushed from the player's first input, not at
//   load, and again from any later input that finds it missing.
// This cannot stop the system closing the app or a browser showing its own leave prompt.
export function guardBackNavigation(
  eventTarget: EventTarget,
  host: LeaveHost,
  createCloseWatcher: CloseWatcherFactory | undefined,
  history: HistoryLike,
): BackGuard {
  // Whether leave has stepped back over the guard and goes on past the game's own entry once it
  // lands there.
  let leaving = false;
  // Whether an Escape keydown is being handled: the close it causes is the keyboard's, not back.
  let escaping = false;
  let watcher: CloseWatcherLike | undefined;

  const usesGuard = () => createCloseWatcher === undefined || history.length > 1;
  const pushGuard = () => {
    if (usesGuard() && !isBackGuardState(history.state)) {
      history.pushState(BACK_GUARD_STATE, "");
    }
  };
  const onClose = () => {
    watcher = undefined;
    watchClose();
    if (!escaping) {
      dispatchPhoneEvent(eventTarget, PHONE_EVENTS.backPressed);
    }
  };
  const watchClose = () => {
    if (createCloseWatcher !== undefined && watcher === undefined) {
      watcher = createCloseWatcher();
      watcher.addEventListener("close", onClose, { once: true });
    }
  };
  const onGesture = (event: Event) => {
    if (event.type === "keydown" && eventKey(event) === ESCAPE_KEY) {
      escaping = true;
      host.setTimeout(() => {
        escaping = false;
      }, 0);
    }
    pushGuard();
    watchClose();
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
    eventTarget.addEventListener(type, onGesture, { capture: true, passive: true });
  }
  eventTarget.addEventListener("popstate", onPopState);
  // A page restored from the back-forward cache after leaving catches back again.
  eventTarget.addEventListener("pageshow", watchClose);
  watchClose();
  return {
    leave() {
      watcher?.removeEventListener("close", onClose);
      watcher?.destroy();
      watcher = undefined;
      if (history.length <= 1) {
        host.close();
        return;
      }
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
