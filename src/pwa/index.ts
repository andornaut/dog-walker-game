// The game as an installed phone app: the service worker, the screen wake lock, the back
// gesture, visibility events and audio unlock. setupPhoneApp runs once from main.ts; the scenes
// listen for PHONE_EVENTS on window and call the functions below.
import { guardBackNavigation } from "./backNavigation";
import { relayVisibilityEvents } from "./visibility";
import { createScreenWakeLock, type ScreenWakeLock } from "./wakeLock";

export { unlockAudioOnFirstGesture } from "./audioUnlock";
export { PHONE_EVENTS, type PhoneEventName } from "./events";

const SERVICE_WORKER_URL = "/sw.js";

let screenWakeLock: ScreenWakeLock | undefined;

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads.
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" }).catch((error: unknown) => {
      console.warn("Service worker registration failed; the game will not work offline.", error);
    });
  });
}

export function setupPhoneApp(): void {
  registerServiceWorker();
  relayVisibilityEvents(window, document);
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
