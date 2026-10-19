// The message a page posts to a waiting service worker to make it take over now.
// serviceWorker.ts imports only its type, so the worker still builds with no imports.
export const SKIP_WAITING_MESSAGE = "skip-waiting";
export type SkipWaitingMessage = typeof SKIP_WAITING_MESSAGE;

// The parts of the Service Worker API this uses, so tests can pass fakes.
export interface ServiceWorkerLike extends EventTarget {
  postMessage(message: unknown): void;
  readonly state: string;
}

export interface RegistrationLike extends EventTarget {
  readonly installing: ServiceWorkerLike | null;
  readonly waiting: ServiceWorkerLike | null;
}

export interface ContainerLike extends EventTarget {
  readonly controller: unknown;
}

export interface UpdateNoticeState {
  // The player is on the home screen, never mid-walk or in a menu over it.
  onHome: boolean;
  // Reload was pressed and the page is about to reload.
  reloading: boolean;
  // A new version has installed and waits behind the running one.
  waiting: boolean;
}

export const NO_UPDATE: UpdateNoticeState = { onHome: false, reloading: false, waiting: false };

export function showsUpdateNotice({ onHome, reloading, waiting }: UpdateNoticeState): boolean {
  return waiting && onHome && !reloading;
}

// Calls onWaiting with a new version's worker once it has installed and waits behind the one
// controlling the page, including one already waiting at registration. A first install has no
// controller to wait behind, so it never counts.
export function watchForWaitingWorker(
  container: ContainerLike,
  onWaiting: (worker: ServiceWorkerLike) => void,
  registration: RegistrationLike,
): void {
  const check = () => {
    if (registration.waiting !== null && container.controller !== null) {
      onWaiting(registration.waiting);
    }
  };
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") {
        check();
      }
    });
  });
  check();
}

// Tells the waiting worker to take over, then reloads once it controls the page. Without this a
// waiting worker activates on the next launch, and controllerchange never fires mid-session.
export function activateWaitingWorker(
  container: ContainerLike,
  reload: () => void,
  worker: ServiceWorkerLike,
): void {
  let reloaded = false;
  container.addEventListener("controllerchange", () => {
    if (!reloaded) {
      reloaded = true;
      reload();
    }
  });
  worker.postMessage(SKIP_WAITING_MESSAGE);
}

// The game's size, and where the notice sits in it: over the gate scene's street, under the
// top bar, clear of the home screen's steps and Start walk at the bottom.
const GAME = { height: 640, width: 360 } as const;
const NOTICE = { maxWidth: 260, top: 48 } as const;

export interface BoxLike {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

// Where the notice goes, in page pixels, for the canvas's bounding box: centred on it
// (centreX is the notice's centre), its top at game y 48, and at most 260 game pixels wide.
export function noticePlacement(canvas: BoxLike): {
  centreX: number;
  maxWidth: number;
  top: number;
} {
  return {
    centreX: canvas.left + canvas.width / 2,
    maxWidth: (canvas.width * NOTICE.maxWidth) / GAME.width,
    top: canvas.top + (canvas.height * NOTICE.top) / GAME.height,
  };
}

export interface UpdatePrompt {
  // Reload into the waiting version, if there is one.
  accept(): void;
  setOnHome(onHome: boolean): void;
  setWaiting(worker: ServiceWorkerLike): void;
}

// Shows the notice through show(visible) whenever showsUpdateNotice holds, and only on a change.
export function createUpdatePrompt(
  container: ContainerLike,
  reload: () => void,
  show: (visible: boolean) => void,
): UpdatePrompt {
  let state = NO_UPDATE;
  let shown = false;
  let waitingWorker: ServiceWorkerLike | undefined;
  const update = (change: Partial<UpdateNoticeState>) => {
    state = { ...state, ...change };
    const visible = showsUpdateNotice(state);
    if (visible !== shown) {
      shown = visible;
      show(visible);
    }
  };
  return {
    accept() {
      if (waitingWorker === undefined || state.reloading) {
        return;
      }
      update({ reloading: true });
      activateWaitingWorker(container, reload, waitingWorker);
    },
    setOnHome(onHome) {
      update({ onHome });
    },
    setWaiting(worker) {
      waitingWorker = worker;
      update({ waiting: true });
    },
  };
}
