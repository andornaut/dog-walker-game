// The home page's Install button beside Play, on the game's install flow: the browser's install
// prompt where it gives one, the Share, then Add to Home Screen steps on iOS, and hidden once
// installed or where neither works. Its words are in pages/index.html.
import { watchInstall } from "../pwa/installFlow";
import { offersInstall } from "../pwa/installState";

// Elements in pages/index.html.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  const show = () => {
    button.hidden = !offersInstall(flow.state());
  };
  show();
  flow.onChange(show);
  button.addEventListener("click", () => {
    void flow.install().then((outcome) => {
      if (outcome === "iosSteps") {
        steps.showModal();
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
