// The game as an installed phone app: the service worker and its update plate, the screen wake
// lock, the back gesture, visibility and orientation events, the turn-upright notice, audio
// unlock, the install offer and persistent storage. setupPhoneApp runs once from main.ts; the
// scenes listen for PHONE_EVENTS on window and call the functions below.
import { chooseSoundFormat, type SoundFormat } from "../audio/soundFormat";
import { browserStorage, lazyStorage } from "../save/storage";
import {
  type BackGuard,
  type CloseWatcherFactory,
  type CloseWatcherLike,
  guardBackNavigation,
} from "./backNavigation";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";
import { type InstallFlow, type InstallOutcome, watchInstall } from "./installFlow";
import { createInstallNudge, type InstallNudge } from "./installNudge";
import type { InstallState, MenuInstallBrowser } from "./installState";
import { type OrientationRelay, relayOrientationEvents, type Viewport } from "./orientation";
import { serviceWorkerUrl } from "./serviceWorkerUrl";
import { requestPersistentStorage, type StoragePersistence } from "./storagePersistence";
import { createUpdateFlow, type UpdateFlow } from "./updateReady";
import { relayVisibilityEvents } from "./visibility";
import { createScreenWakeLock, type ScreenWakeLock } from "./wakeLock";

export { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";
export { PHONE_EVENTS } from "./events";
export type { InstallOutcome } from "./installFlow";
export { type InstallState, type MenuInstallBrowser, offersInstall } from "./installState";
export type { StoragePersistence } from "./storagePersistence";

const SERVICE_WORKER_URL = "/sw.js";
// An element in pages/play/index.html.
const TURN_UPRIGHT_ID = "turn-upright";

// The sound format BootScene loads and the service worker precaches.
export function browserSoundFormat(): SoundFormat | undefined {
  const audio = document.createElement("audio");
  return chooseSoundFormat((mimeType) => audio.canPlayType(mimeType));
}

let backGuard: BackGuard | undefined;
let installFlow: InstallFlow | undefined;
let installNudge: InstallNudge | undefined;
let orientation: OrientationRelay | undefined;
let persistence: Promise<StoragePersistence> = Promise.resolve("unsupported");
let screenWakeLock: ScreenWakeLock | undefined;
let updateFlow: UpdateFlow | undefined;
// Whether the home screen shows the update plate.
let updateShown = false;

// How long a fresh load holds the boot for a newer version to be checked for and installed, so
// it reloads into that version before the game draws. A slower install switches once it lands,
// or, after the player has interacted, offers the update plate on the home screen.
const BOOT_WAIT_MS = 4000;
// Input that counts as the player interacting, after which the page never reloads on its own.
const INTERACTION_EVENTS = ["keydown", "pointerdown"] as const;

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads. Resolves once the game may boot.
function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return Promise.resolve();
  }
  const container = navigator.serviceWorker;
  const flow = createUpdateFlow(
    container,
    () => Date.now(),
    () => navigator.onLine,
    () => location.reload(),
    (visible) => {
      updateShown = visible;
      dispatchPhoneEvent(window, PHONE_EVENTS.updatePlate);
    },
  );
  updateFlow = flow;
  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, () => flow.noteInteraction(), { capture: true, passive: true });
  }
  // An installed app resumed from the background without relaunching checks here, on the home
  // screen. relayVisibilityEvents sends these, a return from the back-forward cache included.
  window.addEventListener(PHONE_EVENTS.appHidden, () => flow.setVisible(false));
  window.addEventListener(PHONE_EVENTS.appVisible, () => flow.setVisible(true));
  setTimeout(() => flow.endBootWait(), BOOT_WAIT_MS);
  container
    .register(serviceWorkerUrl(SERVICE_WORKER_URL, browserSoundFormat()), { scope: "/" })
    .then((registration) => flow.watch(registration))
    .catch((error: unknown) => {
      console.warn("Service worker registration failed; the game will not work offline.", error);
      flow.noRegistration();
    });
  return flow.bootable;
}

function readViewport(): Viewport {
  return {
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    height: window.innerHeight,
    width: window.innerWidth,
  };
}

// The notice covers the game while the phone is on its side; RunScene pauses the walk.
function showTurnUprightNotice(): void {
  const notice = document.getElementById(TURN_UPRIGHT_ID);
  if (notice === null) {
    return;
  }
  window.addEventListener(PHONE_EVENTS.turnedSideways, () => {
    notice.hidden = false;
  });
  window.addEventListener(PHONE_EVENTS.turnedUpright, () => {
    notice.hidden = true;
  });
}

// Resolves once the game may boot: at once, or after a fresh load has checked for a newer
// version (it never resolves for a page that reloads into one first).
export function setupPhoneApp(): Promise<void> {
  const bootable = registerServiceWorker();
  installFlow = watchInstall(window);
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  persistence = requestPersistentStorage(
    installFlow.state() === "installed",
    "storage" in navigator ? navigator.storage : undefined,
  );
  installNudge = createInstallNudge(browserStorage(lazyStorage(() => globalThis.localStorage)));
  relayVisibilityEvents(window, document);
  showTurnUprightNotice();
  orientation = relayOrientationEvents(readViewport, window);
  backGuard = guardBackNavigation(window, window, closeWatcherFactory(), history);
  const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : undefined;
  screenWakeLock = createScreenWakeLock(wakeLock, document);
  // Held whenever the game is visible until the scenes take over with stopWakeLock and
  // startWakeLock (for example, letting the screen sleep on a menu).
  screenWakeLock.start();
  return bootable;
}

// The browser's CloseWatcher, where it has one (Chrome 120 and later, Firefox 149 and later).
function closeWatcherFactory(): CloseWatcherFactory | undefined {
  const CloseWatcher = (globalThis as { CloseWatcher?: new () => CloseWatcherLike }).CloseWatcher;
  return CloseWatcher === undefined ? undefined : () => new CloseWatcher();
}

// Closes the game's window, or leaves the game for the previous page (BackGuard.leave).
export function leaveGame(): void {
  backGuard?.leave();
}

// Whether the phone is on its side now, with the turn-upright notice over the game.
export function isPhoneSideways(): boolean {
  return orientation?.sideways() ?? false;
}

// Keep the screen on while the game is visible.
export function startWakeLock(): void {
  screenWakeLock?.start();
}

// Let the screen sleep.
export function stopWakeLock(): void {
  screenWakeLock?.stop();
}

// Whether the home screen is in front, the only place the update plate shows.
export function setOnHomeScreen(onHome: boolean): void {
  updateFlow?.setOnHome(onHome);
}

// Whether the home screen shows the update plate: a newer version waits, after the player has
// interacted, with the home screen in front. PHONE_EVENTS.updatePlate fires on each change.
export function updatePlateShown(): boolean {
  return updateShown;
}

// The plate's Update now button: switch to the waiting version and reload into it, or with none
// waiting (or no service worker) reload, so the browser fetches the newer version.
export function acceptUpdate(): void {
  if (updateFlow === undefined) {
    location.reload();
    return;
  }
  updateFlow.accept();
}

// A walk started, which counts as the player interacting even with no input (a dev walk URL).
export function noteWalkStarted(): void {
  updateFlow?.noteInteraction();
}

// What the browser answered when asked to keep the game's storage, for the dev panel.
export function storagePersistence(): Promise<StoragePersistence> {
  return persistence;
}

export function installState(): InstallState {
  return installFlow?.state() ?? "unsupported";
}

// Calls listener on each change of the install state until the returned function is called.
export function onInstallStateChange(listener: (state: InstallState) => void): () => void {
  return installFlow?.onChange(listener) ?? (() => undefined);
}

// Shows the browser's install prompt, or tells the caller to show menuBrowser's steps. Call it
// from the player's tap: the browser shows its prompt only during a gesture.
export function installApp(): Promise<InstallOutcome> {
  return installFlow?.install() ?? Promise.resolve("unavailable");
}

// The browser that installs only from its own menu, whose steps installApp's menuSteps calls for.
export function menuBrowser(): MenuInstallBrowser | undefined {
  return installFlow?.menuBrowser;
}

// Whether the start screen should suggest installing now: once per device, while the state
// offers a way to install.
export function installNudgeDue(): boolean {
  return installNudge?.due(installState()) ?? false;
}

export function noteInstallNudged(): void {
  installNudge?.markShown();
}
