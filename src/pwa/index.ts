// The game as an installed phone app: the service worker and its update notice, the screen wake
// lock, the back gesture, visibility and orientation events, the turn-upright notice and audio
// unlock. setupPhoneApp runs once from main.ts; the scenes listen for PHONE_EVENTS on window and
// call the functions below.
import { guardBackNavigation } from "./backNavigation";
import { PHONE_EVENTS } from "./events";
import { relayOrientationEvents, type Viewport } from "./orientation";
import {
  createUpdatePrompt,
  noticePlacement,
  type UpdatePrompt,
  watchForWaitingWorker,
} from "./updateReady";
import { relayVisibilityEvents } from "./visibility";
import { createScreenWakeLock, type ScreenWakeLock } from "./wakeLock";

export { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";
export { PHONE_EVENTS, type PhoneEventName } from "./events";

const SERVICE_WORKER_URL = "/sw.js";
// Elements in play/index.html.
const TURN_UPRIGHT_ID = "turn-upright";
const UPDATE_READY_ID = "update-ready";
const GAME_ID = "game";

// Keeps the notice over the game's top, wherever the canvas is scaled and letterboxed to.
// Returns a function that places it now, for when it is shown.
function placeNoticeOverGame(notice: HTMLElement): () => void {
  const game = document.getElementById(GAME_ID);
  if (game === null) {
    return () => undefined;
  }
  const place = () => {
    const canvas = game.querySelector("canvas") ?? game;
    const { centreX, maxWidth, top } = noticePlacement(canvas.getBoundingClientRect());
    notice.style.left = `${centreX}px`;
    notice.style.top = `${top}px`;
    notice.style.maxWidth = `${maxWidth}px`;
  };
  place();
  new ResizeObserver(place).observe(game);
  window.addEventListener("resize", place);
  return place;
}

let screenWakeLock: ScreenWakeLock | undefined;
let updatePrompt: UpdatePrompt | undefined;

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads.
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }
  const container = navigator.serviceWorker;
  const notice = document.getElementById(UPDATE_READY_ID);
  const placeNotice = notice === null ? () => undefined : placeNoticeOverGame(notice);
  const prompt = createUpdatePrompt(
    container,
    () => location.reload(),
    (visible) => {
      if (notice !== null) {
        placeNotice();
        notice.hidden = !visible;
      }
    },
  );
  updatePrompt = prompt;
  notice?.querySelector("button")?.addEventListener("click", () => prompt.accept());
  window.addEventListener("load", () => {
    container
      .register(SERVICE_WORKER_URL, { scope: "/" })
      .then((registration) => {
        watchForWaitingWorker(container, (worker) => prompt.setWaiting(worker), registration);
      })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed; the game will not work offline.", error);
      });
  });
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

export function setupPhoneApp(): void {
  registerServiceWorker();
  relayVisibilityEvents(window, document);
  showTurnUprightNotice();
  relayOrientationEvents(readViewport, window);
  guardBackNavigation(window, history);
  const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : undefined;
  screenWakeLock = createScreenWakeLock(wakeLock, document);
  // Held whenever the game is visible until the scenes take over with stopWakeLock and
  // startWakeLock (for example, letting the screen sleep on a menu).
  screenWakeLock.start();
}

// Keep the screen on while the game is visible.
export function startWakeLock(): void {
  screenWakeLock?.start();
}

// Let the screen sleep.
export function stopWakeLock(): void {
  screenWakeLock?.stop();
}

// Whether the home screen is in front, the only place the update notice shows.
export function setOnHomeScreen(onHome: boolean): void {
  updatePrompt?.setOnHome(onHome);
}
