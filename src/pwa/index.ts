// The game as an installed phone app: the service worker and its update plate, the screen wake
// lock, the back gesture, visibility and orientation events, the turn-upright notice, audio
// unlock, the install offer and persistent storage. setupPhoneApp runs once from main.ts; the
// scenes listen for PHONE_EVENTS on window and call the functions below.
import {
  backCloseWatcher,
  browserCloseWatcher,
  guardBackNavigation,
  isFirefoxAndroidApp,
} from "@andornaut/game-kit/pwa/backNavigation";
import {
  type InstallFlow,
  type InstallOutcome,
  watchInstall,
} from "@andornaut/game-kit/pwa/installFlow";
import type { InstallState, MenuInstallBrowser } from "@andornaut/game-kit/pwa/installState";
import { browserOfflinePage, startOfflinePlay } from "@andornaut/game-kit/pwa/offlinePlay";
import { serviceWorkerUrl } from "@andornaut/game-kit/pwa/serviceWorkerUrl";
import {
  requestPersistentStorage,
  type StoragePersistence,
} from "@andornaut/game-kit/pwa/storagePersistence";
import type { UpdateFlow } from "@andornaut/game-kit/pwa/updateReady";
import { watchVisibility } from "@andornaut/game-kit/pwa/visibility";
import { createScreenWakeLock, type ScreenWakeLock } from "@andornaut/game-kit/pwa/wakeLock";
import { localSaveStorage } from "@andornaut/game-kit/save/storage";

import { chooseSoundFormat, type SoundFormat } from "../audio/soundFormat";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";
import { createInstallNudge, type InstallNudge } from "./installNudge";
import { type OrientationRelay, relayOrientationEvents, type Viewport } from "./orientation";

export { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";
export { PHONE_EVENTS } from "./events";
export type { InstallOutcome } from "@andornaut/game-kit/pwa/installFlow";
export {
  type InstallState,
  type MenuInstallBrowser,
  offersInstall,
} from "@andornaut/game-kit/pwa/installState";
export type { StoragePersistence } from "@andornaut/game-kit/pwa/storagePersistence";

const SERVICE_WORKER_URL = "/sw.js";
// An element in pages/play/index.html.
const TURN_UPRIGHT_ID = "turn-upright";

// The sound format BootScene loads and the service worker precaches.
export function browserSoundFormat(): SoundFormat | undefined {
  const audio = document.createElement("audio");
  return chooseSoundFormat((mimeType) => audio.canPlayType(mimeType));
}

let installFlow: InstallFlow | undefined;
let installNudge: InstallNudge | undefined;
let orientation: OrientationRelay | undefined;
let persistence: Promise<StoragePersistence> = Promise.resolve("unsupported");
let screenWakeLock: ScreenWakeLock | undefined;
let updateFlow: UpdateFlow | undefined;
// Resolves once the game may show its first screen and write its save (UpdateFlow.bootable).
let ready: Promise<void> = Promise.resolve();
// Called on each change of whether the home screen is in front (OfflinePlay.setOnHome).
let homeHook: (onHome: boolean) => void = () => undefined;
// Whether the home screen shows the update plate.
let updateShown = false;

// How long a fresh load holds the home screen and the save for a newer version to be checked for
// and installed, so it reloads into that version before the home screen draws; the game loads
// meanwhile. A slower install switches once it lands, or, after the player has interacted, offers
// the update plate on the home screen.
const BOOT_WAIT_MS = 4000;
// The history state key of the entry that keeps back on the game (the kit's guardBackNavigation).
const BACK_GUARD_STATE_KEY = "dogWalkerBackGuard";

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads. The kit's offline play: a page a version controls registers now, so
// its update check runs while the game loads; a first visit registers once the home screen shows,
// so the precache does not compete with the game's own downloads. The page coming back into view
// on the home screen checks for a newer version (an installed app resumed without relaunching).
function registerServiceWorker(): void {
  const page = import.meta.env.PROD ? browserOfflinePage() : undefined;
  if (page === undefined) {
    return;
  }
  const play = startOfflinePlay(
    {
      bootWaitMs: BOOT_WAIT_MS,
      onUpdateShown: (shown) => {
        updateShown = shown;
        dispatchPhoneEvent(window, PHONE_EVENTS.updatePlate);
      },
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, browserSoundFormat()),
    },
    page,
  );
  updateFlow = play.flow;
  homeHook = play.setOnHome;
  ready = play.bootable;
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

// Sets up the service worker and the phone app's behaviour. The game is constructed at once and
// waits on launchReady only for its first screen and its save.
export function setupPhoneApp(): void {
  registerServiceWorker();
  installFlow = watchInstall(window);
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  persistence = requestPersistentStorage(
    installFlow.state() === "installed",
    "storage" in navigator ? navigator.storage : undefined,
  );
  installNudge = createInstallNudge(localSaveStorage());
  watchVisibility(
    (visible) =>
      dispatchPhoneEvent(window, visible ? PHONE_EVENTS.appVisible : PHONE_EVENTS.appHidden),
    window,
    document,
  );
  showTurnUprightNotice();
  orientation = relayOrientationEvents(readViewport, window);
  // Firefox for Android's installed app keeps its own back.
  // WORKAROUND: https://bugzilla.mozilla.org/show_bug.cgi?id=2079243 (see isFirefoxAndroidApp).
  if (!isFirefoxAndroidApp(navigator.userAgent, (query) => matchMedia(query).matches)) {
    // Each back the guard keeps opens the pause menu or Quit?, as the scenes decide.
    guardBackNavigation(
      {
        onBack: () => dispatchPhoneEvent(window, PHONE_EVENTS.backPressed),
        stateKey: BACK_GUARD_STATE_KEY,
      },
      window,
      window,
      backCloseWatcher(navigator.userAgent, browserCloseWatcher()),
      history,
    );
  }
  const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : undefined;
  screenWakeLock = createScreenWakeLock(wakeLock, document);
  // Held whenever the game is visible until the scenes take over with stopWakeLock and
  // startWakeLock (for example, letting the screen sleep on a menu).
  screenWakeLock.start();
}

// Resolves once the game may show its first screen and write its save: at once, or after a fresh
// load has checked for a newer version, for at most BOOT_WAIT_MS (it never resolves for a page
// that reloads into one first).
export function launchReady(): Promise<void> {
  return ready;
}

// Whether the home top bar shows Exit: everywhere but Firefox for Android's installed app,
// which ignores a script's close, so Exit could only go to the site's home page inside the app.
// WORKAROUND: https://bugzilla.mozilla.org/show_bug.cgi?id=2079243 (see isFirefoxAndroidApp).
export function exitShown(): boolean {
  return !isFirefoxAndroidApp(navigator.userAgent, (query) => matchMedia(query).matches);
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

// Whether the home screen is in front, the only place the update plate shows. A first visit
// registers the service worker on its first arrival home.
export function setOnHomeScreen(onHome: boolean): void {
  homeHook(onHome);
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
