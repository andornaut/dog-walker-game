// The home page's Install button beside Play, on the game's install flow (the kit's
// wireInstallButton). Its words are in pages/index.html.
import { wireInstallButton } from "@andornaut/game-kit/pwa/installButton";
import { watchInstall } from "@andornaut/game-kit/pwa/installFlow";

// Elements in pages/index.html. The steps dialog holds one section per browser, each marked
// data-browser with its MenuInstallBrowser and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

// Listens at once: beforeinstallprompt can fire before the page has drawn anything.
const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(flow, button, steps);
}
