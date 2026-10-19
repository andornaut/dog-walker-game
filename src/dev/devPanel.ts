// The dev panel: plain HTML under the game canvas. A thin bar that opens a sheet with the run
// setup, the overlay toggle, the run link, replay and save tools. The game reaches it only
// through DevPanelHost, so this module needs no Phaser.
import "./devPanel.css";

import { gameData } from "../data";
import { cents } from "../rules/units";
import { loadSave, saveContextFrom } from "../save/load";
import type { SaveDocument } from "../save/schema";
import { browserStorage, SAVE_KEY, type SaveStore, saveStore } from "../save/storage";
import {
  addMoney,
  checkRunForm,
  describeLastLog,
  DEV_LAST_LOG_KEY,
  DEV_PANEL_OPEN_KEY,
  DEV_REPLAY_KEY,
  type DevRunForm,
  formFromSetup,
  planReplay,
  SAVED_LOADOUT,
  saveReadoutLines,
  unlockAll,
} from "./devPanelModel";
import { INPUT_LOG_VERSION } from "./inputLog";
import { pageRunSetup, runSetupLimitsFor } from "./pageRunSetup";
import { NO_GEAR, randomSeed, type RunSetup, runSetupLink } from "./runSetup";

export interface DevPanelHost {
  // The running scene's setup once it reports one, else the URL's.
  currentSetup(): RunSetup;
  overlayVisible(): boolean;
  setOverlayVisible(visible: boolean): void;
}

const BANK_TOP_UP = cents(100_000);
const STORAGE_UNAVAILABLE = "storage unavailable";

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

function textInput(value: string, inputMode: string, placeholder = ""): HTMLInputElement {
  return el("input", {
    autocomplete: "off",
    className: "dev-field",
    inputMode,
    placeholder,
    spellcheck: false,
    type: "text",
    value,
  });
}

function row(label: string, ...controls: Node[]): HTMLLabelElement {
  return el("label", { className: "dev-row" }, el("span", { textContent: label }), ...controls);
}

function section(title: string, ...children: Node[]): HTMLElement {
  return el("section", {}, el("h2", { textContent: title }), ...children);
}

function note(...children: (Node | string)[]): HTMLParagraphElement {
  return el("p", { className: "dev-note" }, ...children);
}

function code(text: string): HTMLElement {
  return el("code", { textContent: text });
}

function listInto(list: HTMLUListElement, items: readonly string[]): void {
  list.replaceChildren(...items.map((item) => el("li", { textContent: item })));
}

// undefined when sessionStorage is unavailable, null when the key is unset.
function sessionRead(key: string): string | null | undefined {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return undefined;
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

function playPageUrl(): string {
  return new URL("/play/", globalThis.location.href).href;
}

function runSection(): HTMLElement {
  const { setup, warnings: urlWarnings } = pageRunSetup();
  const limits = runSetupLimitsFor(gameData);
  const initial = formFromSetup(setup);

  const seed = textInput(initial.seed, "numeric");
  // In the order they were checked, which is the pack's slot order.
  let pack = [...initial.pack];
  const dogs = limits.dogIds.map((id) => {
    const box = el("input", { checked: pack.includes(id), type: "checkbox", value: id });
    return { box, label: el("label", { title: id }, box, gameData.dogs[id].name) };
  });
  const gear = el(
    "select",
    { className: "dev-field" },
    el("option", { textContent: "saved loadout", value: SAVED_LOADOUT }),
    el("option", { textContent: "none", value: NO_GEAR }),
    ...limits.gearIds.map((id) =>
      el("option", { textContent: gameData.shopGear[id].name, value: id }),
    ),
  );
  gear.value = initial.gear;
  const zone = el(
    "select",
    { className: "dev-field" },
    ...Array.from({ length: limits.zoneCount }, (_, index) =>
      el("option", { textContent: String(index + 1), value: String(index + 1) }),
    ),
  );
  zone.value = initial.zone;
  const money = textInput(initial.moneyDollars, "decimal", "gear's starting money");
  const speed = textInput(initial.speed, "decimal", "1");
  const dev = el("input", { checked: initial.dev, type: "checkbox" });
  const warnings = el("ul", { className: "dev-warnings" });
  const start = el("button", {
    className: "dev-button dev-primary",
    textContent: "Start run",
    type: "submit",
  });

  const read = (): DevRunForm => ({
    dev: dev.checked,
    gear: gear.value,
    moneyDollars: money.value,
    pack,
    seed: seed.value,
    speed: speed.value,
    zone: zone.value,
  });
  const update = () => {
    const checked = checkRunForm(limits, read());
    listInto(warnings, checked.warnings);
    start.disabled = checked.warnings.length > 0;
    dogs.forEach(({ box }) => {
      box.disabled = !box.checked && pack.length >= limits.maxPackSize;
    });
  };

  // A box's own listener runs before the form's, so update sees the new pack.
  dogs.forEach(({ box }) => {
    box.addEventListener("change", () => {
      pack = box.checked ? [...pack, box.value] : pack.filter((id) => id !== box.value);
    });
  });
  const form = el(
    "form",
    { noValidate: true },
    row(
      "seed",
      seed,
      button("random", () => {
        seed.value = String(randomSeed());
        update();
      }),
    ),
    el(
      "fieldset",
      { className: "dev-pack" },
      el("legend", { textContent: `pack (1 to ${limits.maxPackSize}; none: saved loadout)` }),
      ...dogs.map(({ label }) => label),
    ),
    row("gear", gear),
    row("zone", zone),
    row("money $", money),
    row("speed x", speed),
    el("label", { className: "dev-check" }, dev, "show overlay on start (dev=1)"),
    warnings,
    start,
  );
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const checked = checkRunForm(limits, read());
    if (checked.warnings.length === 0) {
      globalThis.location.assign(runSetupLink(playPageUrl(), checked.setup));
    }
  });
  update();

  const urlNotes: Node[] = [];
  if (urlWarnings.length > 0) {
    const list = el("ul", { className: "dev-warnings" });
    listInto(
      list,
      urlWarnings.map((warning) => `URL: ${warning}`),
    );
    urlNotes.push(list);
  }
  return section("Run setup", ...urlNotes, form);
}

function overlaySection(host: DevPanelHost): { element: HTMLElement; refresh: () => void } {
  const box = el("input", { type: "checkbox" });
  box.addEventListener("change", () => host.setOverlayVisible(box.checked));
  const refresh = () => {
    box.checked = host.overlayVisible();
  };
  // The backquote key toggles the overlay too; Phaser has handled it by keyup.
  globalThis.addEventListener("keyup", (event) => {
    if (event.code === "Backquote") {
      refresh();
    }
  });
  const element = section(
    "Overlay",
    el("label", { className: "dev-check" }, box, "show the dev overlay"),
    note("The backquote key also toggles it, and C copies the run link while it shows."),
  );
  return { element, refresh };
}

function linkSection(host: DevPanelHost): HTMLElement {
  const field = el("input", { className: "dev-field", hidden: true, readOnly: true, type: "text" });
  const status = note();
  const fallback = (message: string) => {
    status.textContent = message;
    field.focus();
    field.select();
  };
  const copy = () => {
    const link = runSetupLink(globalThis.location.href, host.currentSetup());
    field.value = link;
    field.hidden = false;
    // Undefined outside a secure context, such as the game served over plain http.
    const clipboard: Clipboard | undefined = globalThis.navigator.clipboard;
    if (clipboard === undefined) {
      fallback("No clipboard over http: copy the link from the field.");
      return;
    }
    clipboard.writeText(link).then(
      () => {
        status.textContent = "Copied.";
      },
      () => fallback("Copy failed: copy the link from the field."),
    );
  };
  return section(
    "Run link",
    button("Copy link", copy),
    field,
    status,
    note("The current run's setup with its seed, so the link reproduces it."),
  );
}

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = el("a", { download: fileName, href: url });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function replaySection(): { element: HTMLElement; refresh: () => void } {
  const limits = runSetupLimitsFor(gameData);
  const input = el("textarea", {
    className: "dev-field dev-log",
    placeholder: "Paste an encoded input log",
    rows: 4,
    spellcheck: false,
  });
  const errors = el("ul", { className: "dev-warnings" });
  const status = note();
  const replay = button("Replay", () => {
    const plan = planReplay(limits, playPageUrl(), input.value);
    if (!plan.ok) {
      return;
    }
    if (sessionWrite(DEV_REPLAY_KEY, plan.stored)) {
      globalThis.location.assign(plan.url);
    } else {
      status.textContent = STORAGE_UNAVAILABLE;
    }
  });
  const check = () => {
    const plan = planReplay(limits, playPageUrl(), input.value);
    replay.disabled = !plan.ok;
    listInto(errors, plan.ok || input.value.trim() === "" ? [] : plan.errors);
    status.textContent = plan.ok ? `Valid: seed ${plan.seed}, ${plan.eventCount} inputs.` : "";
  };
  input.addEventListener("input", check);
  check();

  const lastStatus = note();
  const download = button("Download last run log", () => {
    const stored = sessionRead(DEV_LAST_LOG_KEY);
    if (stored === undefined) {
      lastStatus.textContent = STORAGE_UNAVAILABLE;
      return;
    }
    const last = describeLastLog(limits, stored);
    if (last.status === "none" || stored === null) {
      lastStatus.textContent = "No run recorded yet.";
      return;
    }
    downloadText(last.fileName, stored);
    lastStatus.textContent = `Downloaded ${last.fileName}: ${last.summary}.`;
  });
  const refresh = () => {
    const stored = sessionRead(DEV_LAST_LOG_KEY);
    if (stored === undefined) {
      lastStatus.textContent = STORAGE_UNAVAILABLE;
      return;
    }
    const last = describeLastLog(limits, stored);
    lastStatus.textContent =
      last.status === "none" ? "No run recorded yet." : `Last run: ${last.summary}.`;
  };

  const element = section(
    "Replay",
    note(
      el("strong", { textContent: "Playback is not wired yet. " }),
      "Replay stores the log and loads the game with its setup, but RunScene does not read it " +
        "yet, so the run plays normally.",
    ),
    input,
    errors,
    status,
    replay,
    note(
      "Replay writes sessionStorage ",
      code(DEV_REPLAY_KEY),
      ": the log as encodeInputLog writes it, ",
      code(
        `{"version":${INPUT_LOG_VERSION},"setup":"seed=…","events":[[timeMs,"l",-1|1] | ` +
          `[timeMs,"c",index|"skip"]]}`,
      ),
      ". The run that plays it removes the key.",
    ),
    download,
    lastStatus,
    note(
      "RunScene writes the finished run's log, in the same format, to sessionStorage ",
      code(DEV_LAST_LOG_KEY),
      " at run end.",
    ),
  );
  return { element, refresh };
}

async function editSave(edit: (save: SaveDocument) => SaveDocument): Promise<string> {
  try {
    const store: SaveStore = saveStore(browserStorage(globalThis.localStorage));
    const loaded = await store.load(saveContextFrom(gameData));
    if (loaded.status === "unavailable") {
      return STORAGE_UNAVAILABLE;
    }
    const saved = await store.save(edit(loaded.save));
    if (saved.status === "unavailable") {
      return STORAGE_UNAVAILABLE;
    }
    if (saved.status === "invalid") {
      return `save rejected: ${saved.reason}`;
    }
  } catch {
    return STORAGE_UNAVAILABLE;
  }
  globalThis.location.reload();
  return "saved: reloading";
}

function saveSection(): { element: HTMLElement; refresh: () => void } {
  const readout = el("pre", { className: "dev-readout" });
  const status = note();
  const refresh = () => {
    try {
      const result = loadSave(saveContextFrom(gameData), globalThis.localStorage.getItem(SAVE_KEY));
      const heading =
        result.status === "corrupt"
          ? `the save does not load (${result.reason}); the game starts fresh`
          : result.status === "new"
            ? "no save yet: a new player's"
            : "the stored save";
      readout.textContent = [heading, ...saveReadoutLines(gameData, result.save)].join("\n");
    } catch {
      readout.textContent = STORAGE_UNAVAILABLE;
    }
  };
  const run = (edit: (save: SaveDocument) => SaveDocument) => () => {
    status.textContent = "saving";
    void editSave(edit).then((message) => {
      status.textContent = message;
    });
  };
  const reset = () => {
    if (!globalThis.confirm("Reset the save? The bank, unlocks and stats are lost.")) {
      return;
    }
    try {
      globalThis.localStorage.removeItem(SAVE_KEY);
    } catch {
      status.textContent = STORAGE_UNAVAILABLE;
      return;
    }
    globalThis.location.reload();
  };
  const element = section(
    "Save",
    readout,
    el(
      "div",
      { className: "dev-buttons" },
      button(
        "+$1,000",
        run((save) => addMoney(BANK_TOP_UP, save)),
      ),
      button(
        "Unlock all",
        run((save) => unlockAll(gameData, save)),
      ),
      button("Reset save", reset, "dev-button dev-danger"),
    ),
    status,
    note("Each edit writes the save and reloads the page."),
  );
  return { element, refresh };
}

export function mountDevPanel(host: DevPanelHost, container: HTMLElement | null): void {
  if (container === null) {
    console.warn("Dev panel: the page has no #dev-panel element");
    return;
  }
  const sheet = el("div", {
    className: "dev-sheet",
    hidden: true,
    id: "dev-sheet",
  });
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Dev panel");
  const bar = el("button", { className: "dev-bar", type: "button" });
  bar.setAttribute("aria-controls", sheet.id);
  const overlay = overlaySection(host);
  const replay = replaySection();
  const save = saveSection();

  const setOpen = (open: boolean) => {
    sheet.hidden = !open;
    bar.textContent = open ? "Dev ▾" : "Dev ▸";
    bar.setAttribute("aria-expanded", String(open));
    sessionWrite(DEV_PANEL_OPEN_KEY, open ? "1" : "0");
    if (open) {
      overlay.refresh();
      replay.refresh();
      save.refresh();
    }
  };
  bar.addEventListener("click", () => {
    setOpen(sheet.hidden !== false);
    if (!sheet.hidden) {
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
    el(
      "header",
      { className: "dev-header" },
      el("strong", { textContent: "Dev" }),
      button("Close", () => setOpen(false)),
    ),
    runSection(),
    overlay.element,
    linkSection(host),
    replay.element,
    save.element,
  );
  container.append(bar, sheet);
  setOpen(sessionRead(DEV_PANEL_OPEN_KEY) === "1");
}
