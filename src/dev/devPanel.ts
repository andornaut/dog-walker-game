// The dev panel: plain HTML under the game canvas. A thin bar that opens a sheet of cheats for
// a person testing the game: the switch, start and toggles are staged until Apply, and the save
// cheats act at once. The game reaches it only through DevPanelHost, so this module needs no
// Phaser.
import "./devPanel.css";

import { gameData } from "../data";
import { saveContextFrom } from "../save/load";
import { browserStorage, saveStore } from "../save/storage";
import {
  applyPanel,
  applySaveEdit,
  CHEAT_TOGGLES,
  type Cheats,
  decodeCheats,
  decodeSaveEdits,
  DEV_CHEATS_KEY,
  DEV_PANEL_OPEN_KEY,
  DEV_SAVE_EDITS_KEY,
  encodeCheats,
  encodeSaveEdits,
  openPanel,
  type PanelAction,
  type PanelState,
  RESET_SAVE,
  SAVE_CHEATS,
  type SaveEdit,
  stagePanel,
  startChoices,
  type StartTarget,
} from "./devPanelModel";
import { stripDevParams } from "./devStart";
import { randomSeed } from "./runSetup";

export interface DevPanelHost {
  // Hands the game the cheats it plays by.
  setCheats(cheats: Cheats): void;
}

type Props<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], "style">
>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props<K> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function button(text: string, onClick: () => void, className = "dev-button"): HTMLButtonElement {
  const element = el("button", { className, textContent: text, type: "button" });
  element.addEventListener("click", onClick);
  return element;
}

// null when sessionStorage is unavailable or the key is unset.
function sessionRead(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionWrite(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing stored is the same as nothing to remove.
  }
}

// Called before the game boots: the save edits the panel queued are written to the save
// before the game loads it. They are removed first, so an edit that fails is not retried.
export async function applyPendingSaveEdits(): Promise<void> {
  const edits = decodeSaveEdits(sessionRead(DEV_SAVE_EDITS_KEY));
  sessionRemove(DEV_SAVE_EDITS_KEY);
  if (edits.length === 0) {
    return;
  }
  try {
    const context = saveContextFrom(gameData);
    const store = saveStore(browserStorage(globalThis.localStorage));
    const loaded = await store.load(context);
    if (loaded.status === "unavailable") {
      console.warn(`Dev panel: save edits not applied: ${loaded.reason}`);
      return;
    }
    const edited = edits.reduce(
      (save, edit) => applySaveEdit(gameData, context.defaults, edit, save),
      loaded.save,
    );
    const saved = await store.save(edited);
    if (saved.status !== "saved") {
      console.warn(`Dev panel: save edits not applied: ${saved.reason}`);
    }
  } catch (error) {
    console.warn("Dev panel: save edits not applied", error);
  }
}

// Queues the edit for the next boot and loads the start screen, without the URL's run
// overrides so no walk starts.
function editSave(edit: SaveEdit): void {
  const queued = decodeSaveEdits(sessionRead(DEV_SAVE_EDITS_KEY));
  if (!sessionWrite(DEV_SAVE_EDITS_KEY, encodeSaveEdits([...queued, edit]))) {
    console.warn("Dev panel: sessionStorage unavailable; the save is unchanged");
    return;
  }
  const href = globalThis.location.href;
  const home = stripDevParams(href, false);
  if (home === href) {
    globalThis.location.reload();
  } else {
    globalThis.location.replace(home);
  }
}

function startSelect(): HTMLSelectElement {
  return el(
    "select",
    { className: "dev-field" },
    ...startChoices(gameData).map(({ label, start }) =>
      el("option", { textContent: label, value: start }),
    ),
  );
}

// Writes the cheats for the tab and loads the chosen start. Cheats off leaves nothing in
// sessionStorage, as a new tab starts.
function applyAndGo(state: PanelState): void {
  const href = globalThis.location.href;
  const { cheats, url } = applyPanel(gameData, href, randomSeed(), state);
  if (cheats.on) {
    sessionWrite(DEV_CHEATS_KEY, encodeCheats(cheats));
  } else {
    sessionRemove(DEV_CHEATS_KEY);
  }
  if (url === href) {
    globalThis.location.reload();
  } else {
    globalThis.location.assign(url);
  }
}

export function mountDevPanel(host: DevPanelHost, container: HTMLElement | null): void {
  if (container === null) {
    console.warn("Dev panel: the page has no #dev-panel element");
    return;
  }
  let state = openPanel(decodeCheats(sessionRead(DEV_CHEATS_KEY)));
  host.setCheats(state.applied);

  const sheet = el("div", { className: "dev-sheet", hidden: true, id: "dev-sheet" });
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Cheats");
  const bar = el("button", { className: "dev-bar", type: "button" });
  bar.setAttribute("aria-controls", sheet.id);

  const render = () => {
    const { applied, staged, start } = state;
    on.setAttribute("aria-pressed", String(staged.on));
    off.setAttribute("aria-pressed", String(!staged.on));
    controls.disabled = !staged.on;
    select.value = start;
    toggles.forEach(({ box, id }) => {
      box.checked = staged[id];
    });
    const arrow = sheet.hidden === false ? "▾" : "▸";
    bar.textContent = applied.on ? `Dev ${arrow} cheats on` : `Dev ${arrow}`;
  };
  const stage = (action: PanelAction) => {
    state = stagePanel(action, state);
    render();
  };
  // Closing discards what is staged, as Cancel does.
  const setOpen = (open: boolean) => {
    sheet.hidden = !open;
    bar.setAttribute("aria-expanded", String(open));
    sessionWrite(DEV_PANEL_OPEN_KEY, open ? "1" : "0");
    stage({ kind: "cancel" });
  };

  const on = button("Cheats on", () => stage({ kind: "switch", on: true }));
  const off = button("Cheats off", () => stage({ kind: "switch", on: false }));
  const select = startSelect();
  select.addEventListener("change", () =>
    stage({ kind: "start", start: select.value as StartTarget }),
  );
  const toggles = CHEAT_TOGGLES.map(({ id, label }) => {
    const box = el("input", { type: "checkbox" });
    box.addEventListener("change", () => stage({ id, kind: "toggle", on: box.checked }));
    return { box, id, label: el("label", { className: "dev-check" }, box, label) };
  });
  const controls = el(
    "fieldset",
    { className: "dev-cheats" },
    el("label", { className: "dev-row" }, el("span", { textContent: "Start at" }), select),
    ...toggles.map(({ label }) => label),
    el("h2", { textContent: "Saved to progress" }),
    el(
      "div",
      { className: "dev-buttons" },
      ...SAVE_CHEATS.map(({ edit, label }) => button(label, () => editSave(edit))),
    ),
  );
  const reset = button(
    "Reset save",
    () => {
      if (globalThis.confirm("Reset save to a new player?")) {
        editSave(RESET_SAVE);
      }
    },
    "dev-button dev-danger",
  );

  bar.addEventListener("click", () => {
    setOpen(sheet.hidden !== false);
    if (sheet.hidden === false) {
      sheet.scrollIntoView({ block: "nearest" });
    }
  });
  // Phaser listens for keys on window, so keys typed here would move lanes or toggle the
  // overlay without this.
  sheet.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      setOpen(false);
    }
  });

  sheet.append(
    el("header", { className: "dev-header" }, el("div", { className: "dev-switch" }, on, off)),
    controls,
    el("div", { className: "dev-footer" }, reset),
    el(
      "div",
      { className: "dev-actions" },
      button("Apply", () => applyAndGo(state), "dev-button dev-primary"),
      button("Cancel", () => setOpen(false)),
    ),
  );
  container.append(bar, sheet);
  setOpen(sessionRead(DEV_PANEL_OPEN_KEY) === "1");
}
