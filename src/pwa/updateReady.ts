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
  update(): Promise<unknown>;
  readonly waiting: ServiceWorkerLike | null;
}

export interface ContainerLike extends EventTarget {
  readonly controller: unknown;
}

// A newer version than the one controlling the page: none found, still being checked for or
// installing, or installed and waiting behind the running one.
export type NewerVersion = "none" | "pending" | "waiting";

export interface UpdateState {
  // A key, touch or click, or a walk, since the page loaded.
  interacted: boolean;
  newer: NewerVersion;
  // The home screen is in front, never mid-walk or in a menu over it.
  onHome: boolean;
  // navigator.onLine: false means there is no network to check for a newer version on.
  online: boolean;
  // The waiting version was told to take over, and the page reloads once it does.
  reloading: boolean;
  // The boot's wait for a newer version to be checked for and installed has run out.
  waitOver: boolean;
}

// wait: hold the boot, so a newer version can be checked for and installed first.
// run: run the version the page loaded, with no notice.
// switch: have the waiting version take over and reload into it.
// prompt: show the update notice, whose Reload switches.
export type UpdateAction = "prompt" | "run" | "switch" | "wait";

// Before the player has interacted, a waiting version takes over at once. On a fresh load the
// boot waits for the check and install, so that reload comes before the game draws. Once they
// have interacted the page never reloads on its own, and the notice shows on each arrival home.
// A switch that has not reloaded by the end of the boot wait lets the game boot.
export function updateAction({
  interacted,
  newer,
  onHome,
  online,
  reloading,
  waitOver,
}: UpdateState): UpdateAction {
  if (reloading) {
    return waitOver ? "run" : "wait";
  }
  if (newer === "waiting") {
    if (!interacted) {
      return "switch";
    }
    return onHome ? "prompt" : "run";
  }
  return newer === "pending" && online && !interacted && !waitOver ? "wait" : "run";
}

// The newer version a registration holds, and its worker once it waits. A first install has no
// controller to wait behind, so it never counts.
export function newerVersionOf(
  container: ContainerLike,
  registration: RegistrationLike,
): { newer: NewerVersion; worker?: ServiceWorkerLike } {
  if (container.controller === null) {
    return { newer: "none" };
  }
  if (registration.waiting !== null) {
    return { newer: "waiting", worker: registration.waiting };
  }
  return { newer: registration.installing === null ? "none" : "pending" };
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
const GAME = { height: 560, width: 360 } as const;
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

export interface UpdateFlow {
  // The notice's Reload: switch to the waiting version, if there is one.
  accept(): void;
  // Resolves once the game may boot. It never resolves for a page that reloads first.
  readonly bootable: Promise<void>;
  endBootWait(): void;
  noteInteraction(): void;
  // The registration failed, so there is no newer version to wait for.
  noRegistration(): void;
  setOnHome(onHome: boolean): void;
  // Follows the registration's newer versions, checking for one first unless offline.
  watch(registration: RegistrationLike): void;
}

// Acts on updateAction whenever its state changes: lets the game boot, switches to the waiting
// version, or shows the notice through show(visible), the last only on a change. The state
// starts with a newer version pending, so the boot waits for watch or noRegistration.
export function createUpdateFlow(
  container: ContainerLike,
  online: () => boolean,
  reload: () => void,
  show: (visible: boolean) => void,
): UpdateFlow {
  let state: UpdateState = {
    interacted: false,
    newer: "pending",
    onHome: false,
    online: online(),
    reloading: false,
    waitOver: false,
  };
  let shown = false;
  let waitingWorker: ServiceWorkerLike | undefined;
  let boot: () => void = () => undefined;
  const bootable = new Promise<void>((resolve) => {
    boot = resolve;
  });
  const switchVersion = (worker: ServiceWorkerLike) => {
    state = { ...state, reloading: true };
    activateWaitingWorker(container, reload, worker);
  };
  const update = (change: Partial<UpdateState>) => {
    state = { ...state, ...change };
    const action = updateAction(state);
    if (action === "switch" && waitingWorker !== undefined) {
      switchVersion(waitingWorker);
    } else if (action === "run" || action === "prompt") {
      boot();
    }
    const visible = updateAction(state) === "prompt";
    if (visible !== shown) {
      shown = visible;
      show(visible);
    }
  };
  return {
    accept() {
      if (waitingWorker !== undefined && !state.reloading) {
        switchVersion(waitingWorker);
        update({});
      }
    },
    bootable,
    endBootWait: () => update({ waitOver: true }),
    noRegistration: () => update({ newer: "none" }),
    noteInteraction() {
      if (!state.interacted) {
        update({ interacted: true });
      }
    },
    setOnHome: (onHome) => update({ onHome }),
    watch(registration) {
      const read = () => {
        const { newer, worker } = newerVersionOf(container, registration);
        waitingWorker = worker;
        update({ newer, online: online() });
      };
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", read);
        read();
      });
      // A version already waiting, a first install or no network: nothing to check first.
      const waiting = newerVersionOf(container, registration).newer === "waiting";
      if (waiting || container.controller === null || !online()) {
        read();
        return;
      }
      registration.update().then(read, read);
    },
  };
}
