// The crash screen: plain HTML over the whole page, since the canvas may be what broke. It
// writes nothing to the save, whose in-memory state may be corrupt; the zone checkpoint is
// already saved, and the next launch banks it.
import "./crash.css";

import { BUILD_LABEL } from "@andornaut/game-kit/build/buildLabel";

import { MENU_TEXT } from "../data/menuText";
import {
  crashGate,
  type CrashReport,
  crashView,
  reportFromErrorEvent,
  reportFromRejection,
} from "./crashModel";

// Stops the game under the screen, once there is a game. Any error it throws is logged and
// ignored.
let stopGame = () => {};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  element.append(...children);
  return element;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const element = el("button", "crash-button", text);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

function detailsSection(text: string): HTMLDetailsElement {
  const pre = el("pre", "crash-stack", text);
  const status = el("p", "crash-status");
  status.setAttribute("role", "status");
  // Over http the clipboard API is missing, so the text is selected for a manual copy.
  const selectText = (note: string) => {
    getSelection()?.selectAllChildren(pre);
    status.textContent = note;
  };
  const copy = () => {
    const clipboard: Clipboard | undefined = globalThis.navigator.clipboard;
    if (clipboard === undefined) {
      selectText("No clipboard here: the text is selected.");
      return;
    }
    clipboard.writeText(text).then(
      () => {
        status.textContent = "Copied.";
      },
      () => selectText("Copy failed: the text is selected."),
    );
  };
  return el(
    "details",
    "crash-details",
    el("summary", "", "Error details"),
    pre,
    button("Copy", copy),
    status,
  );
}

function showCrashScreen(dev: boolean, report: CrashReport): void {
  const view = crashView(MENU_TEXT.crash, dev, report);
  const title = el("h1", "crash-title", view.title);
  title.id = "crash-title";
  const body = el("p", "crash-body", view.body);
  body.id = "crash-body";
  const reload = button(view.reload, () => location.reload());
  const panel = el("div", "crash-panel", title, body, reload);
  if (view.details !== undefined) {
    panel.append(detailsSection(`${BUILD_LABEL}\n${view.details}`));
  }
  const screen = el("div", "crash", panel);
  screen.setAttribute("role", "alertdialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", title.id);
  screen.setAttribute("aria-describedby", body.id);
  // Phaser listens for keys on window and may swallow Enter or Space.
  screen.addEventListener("keydown", (event) => event.stopPropagation());

  for (const child of document.body.children) {
    child.toggleAttribute("inert", true);
  }
  document.body.append(screen);
  reload.focus();
}

// Called once the game exists, so a crash stops it under the screen.
export function stopGameOnCrash(stop: () => void): void {
  stopGame = stop;
}

// Listens for uncaught errors and unhandled rejections; dev shows the message and stack with a
// Copy button. Phaser 4 does not catch errors in its game step: they reach window's error
// event and stop its requestAnimationFrame loop.
export function installCrashScreen(dev: boolean): void {
  const accept = crashGate();
  const crash = (report: CrashReport) => {
    if (!accept(report)) {
      return;
    }
    try {
      stopGame();
    } catch (error) {
      console.error("Crash screen: stopping the game failed", error);
    }
    showCrashScreen(dev, report);
  };
  window.addEventListener("error", (event) => crash(reportFromErrorEvent(event)));
  window.addEventListener("unhandledrejection", (event) =>
    crash(reportFromRejection(event.reason)),
  );
}
