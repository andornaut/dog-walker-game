// The home page's Install button beside Play, on the game's install flow: the browser's install
// prompt where it gives one, the steps for the browser's own menu where it installs only from
// there (iOS, Firefox for Android), and hidden once installed or where neither works. Its words
// are in pages/index.html.
import { watchInstall } from "@andornaut/game-kit/pwa/installFlow";
import { offersInstall } from "@andornaut/game-kit/pwa/installState";

// Elements in pages/index.html. The steps dialog holds one section per browser, each marked
// data-browser with its MenuInstallBrowser and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

// Shows only the browser's section of the steps and names the dialog by its title.
function showSteps(dialog: HTMLDialogElement, browser: string): void {
  dialog.querySelectorAll<HTMLElement>("[data-browser]").forEach((section) => {
    section.hidden = section.dataset.browser !== browser;
  });
  const title = dialog.querySelector(`[data-browser="${browser}"] h2`);
  if (title !== null) {
    dialog.setAttribute("aria-labelledby", title.id);
  }
  dialog.showModal();
}

if (button !== null && steps instanceof HTMLDialogElement) {
  const show = () => {
    button.hidden = !offersInstall(flow.state());
  };
  show();
  flow.onChange(show);
  button.addEventListener("click", () => {
    void flow.install().then((outcome) => {
      if (outcome === "menuSteps" && flow.menuBrowser !== undefined) {
        showSteps(steps, flow.menuBrowser);
      }
    });
  });
  // The steps close from their button, Escape, or a tap on the dimmed page around them.
  steps.querySelector("button")?.addEventListener("click", () => steps.close());
  steps.addEventListener("click", (event) => {
    if (event.target === steps) {
      steps.close();
    }
  });
}
