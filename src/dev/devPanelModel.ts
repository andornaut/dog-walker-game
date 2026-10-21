// The dev panel's logic, free of the DOM: the cheats, the save edits and the session keys it
// shares with the game.
import type { DogId, GameData, GearId, WalkerId, ZoneId } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { firstZoneId, type RouteData } from "../rules/route";
import { addCents, type Cents, cents } from "../rules/units";
import {
  createDefaultSave,
  MAX_RUN_DOGS,
  type SaveDefaults,
  type SaveDocument,
} from "../save/schema";
import type { RunState } from "../state/runState";
import { stripDevParams } from "./devStart";
import { type RunSetup, runSetupLink } from "./runSetup";

// sessionStorage, "1" while the panel is open.
export const DEV_PANEL_OPEN_KEY = "dog-walker-game:dev-panel-open";
// sessionStorage: an input log, as encodeInputLog writes it, for the next run to play back.
// The run that reads it should remove it, so a reload plays normally.
export const DEV_REPLAY_KEY = "dog-walker-game:dev-replay";
// sessionStorage: the last finished run's input log, as encodeInputLog writes it. RunScene
// writes it at run end.
export const DEV_LAST_LOG_KEY = "dog-walker-game:dev-last-log";
// sessionStorage and the game registry: the cheats, as encodeCheats writes them. They last
// for the tab, so a walk the panel starts keeps them, and never reach the save.
export const DEV_CHEATS_KEY = "dog-walker-game:dev-cheats";
// sessionStorage: save edits, as encodeSaveEdits writes them, applied at the next boot before
// the game loads the save, so the page being left cannot write its save over them.
export const DEV_SAVE_EDITS_KEY = "dog-walker-game:dev-save-edits";

// Every cheat is off unless `on` is too.
export interface Cheats {
  readonly fastForward: boolean;
  readonly hitBoxes: boolean;
  readonly invincible: boolean;
  readonly on: boolean;
  readonly slowMotion: boolean;
}

type CheatToggle = Exclude<keyof Cheats, "on">;

export const CHEATS_OFF: Cheats = {
  fastForward: false,
  hitBoxes: false,
  invincible: false,
  on: false,
  slowMotion: false,
};

// The panel's toggles, in its order.
export const CHEAT_TOGGLES: readonly { readonly id: CheatToggle; readonly label: string }[] = [
  { id: "invincible", label: "Invincible owners" },
  { id: "hitBoxes", label: "Hit boxes" },
  { id: "slowMotion", label: "Slow motion" },
  { id: "fastForward", label: "Fast forward" },
];

// The walk's time scale under each speed cheat.
export const SLOW_MOTION_SCALE = 0.5;
const FAST_FORWARD_SCALE = 3;

// The speed cheats exclude each other: turning one on turns the other off.
const EXCLUDES: Readonly<Partial<Record<CheatToggle, CheatToggle>>> = {
  fastForward: "slowMotion",
  slowMotion: "fastForward",
};

export function cheatActive(cheats: Cheats, id: CheatToggle): boolean {
  return cheats.on && cheats[id];
}

// With cheats off, every toggle stays off.
export function setCheat(id: CheatToggle, on: boolean, cheats: Cheats): Cheats {
  if (!cheats.on) {
    return cheats;
  }
  const excluded = EXCLUDES[id];
  return { ...cheats, [id]: on, ...(on && excluded !== undefined ? { [excluded]: false } : {}) };
}

export function cheatsOn(cheats: Cheats): Cheats {
  return { ...cheats, on: true };
}

export function timeScaleOf(cheats: Cheats): number {
  if (cheatActive(cheats, "slowMotion")) {
    return SLOW_MOTION_SCALE;
  }
  return cheatActive(cheats, "fastForward") ? FAST_FORWARD_SCALE : 1;
}

function isCheats(value: unknown): value is Cheats {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fields = value as Record<string, unknown>;
  return (Object.keys(CHEATS_OFF) as (keyof Cheats)[]).every(
    (key) => typeof fields[key] === "boolean",
  );
}

// Anything but a whole Cheats is every cheat off.
export function cheatsFrom(value: unknown): Cheats {
  return isCheats(value) ? value : CHEATS_OFF;
}

export function encodeCheats(cheats: Cheats): string {
  return JSON.stringify(cheats);
}

export function decodeCheats(text: string | null): Cheats {
  if (text === null) {
    return CHEATS_OFF;
  }
  try {
    return cheatsFrom(JSON.parse(text));
  } catch {
    return CHEATS_OFF;
  }
}

// The run as the cheats leave it: invincible owners lose no hearts. A run with the cheat off
// is returned as it is.
export function withCheats(cheats: Cheats, run: RunState): RunState {
  const invincible = cheatActive(cheats, "invincible");
  return (run.invincible ?? false) === invincible ? run : { ...run, invincible };
}

export type SaveEdit =
  | { readonly amount: Cents; readonly kind: "addMoney" }
  | { readonly kind: "reset" }
  | { readonly kind: "unlockAll" };

// The cheats that change progress, in the panel's order.
export const SAVE_CHEATS: readonly { readonly edit: SaveEdit; readonly label: string }[] = [
  { edit: { amount: cents(10_000), kind: "addMoney" }, label: "+$100" },
  { edit: { amount: cents(100_000), kind: "addMoney" }, label: "+$1,000" },
  { edit: { kind: "unlockAll" }, label: "Unlock all" },
];

export const RESET_SAVE: SaveEdit = { kind: "reset" };

function addMoney(amount: Cents, save: SaveDocument): SaveDocument {
  return { ...save, bankCents: addCents(save.bankCents, amount) };
}

// What is already owned, in its order, then the rest of ids.
function withAll<Id extends string>(all: readonly Id[], owned: readonly Id[]): Id[] {
  return [...owned, ...all.filter((id) => !owned.includes(id))];
}

// Every dog, gear item, dog slot and walker a run can use.
function unlockAll(
  data: Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "walkers">,
  save: SaveDocument,
): SaveDocument {
  const { owned } = save;
  return {
    ...save,
    owned: {
      dogSlots: Math.min(MAX_RUN_DOGS, data.dogSlots.length),
      dogs: withAll(Object.keys(data.dogs) as DogId[], owned.dogs),
      gear: withAll(Object.keys(data.shopGear) as GearId[], owned.gear),
      walkers: withAll(Object.keys(data.walkers) as WalkerId[], owned.walkers),
    },
  };
}

// A reset is a new player's save.
export function applySaveEdit(
  data: Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "walkers">,
  defaults: SaveDefaults,
  edit: SaveEdit,
  save: SaveDocument,
): SaveDocument {
  switch (edit.kind) {
    case "addMoney":
      return addMoney(edit.amount, save);
    case "reset":
      return createDefaultSave(defaults);
    case "unlockAll":
      return unlockAll(data, save);
    default:
      return assertNever(edit);
  }
}

export function encodeSaveEdits(edits: readonly SaveEdit[]): string {
  return JSON.stringify(edits);
}

function isSaveEdit(value: unknown): value is SaveEdit {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { amount, kind } = value as Record<string, unknown>;
  if (kind === "addMoney") {
    return typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0;
  }
  return kind === "reset" || kind === "unlockAll";
}

// Unreadable text is no edits; an unreadable entry is dropped.
export function decodeSaveEdits(text: string | null): SaveEdit[] {
  if (text === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(isSaveEdit) : [];
  } catch {
    return [];
  }
}

// Where Apply goes: the start screen, or a walk in a neighborhood.
export const START_SCREEN = "startScreen";
export type StartTarget = typeof START_SCREEN | ZoneId;

interface StartChoice {
  readonly label: string;
  readonly start: StartTarget;
}

// The start screen, then every neighborhood: the first, then the rest easiest first.
export function startChoices(data: RouteData): StartChoice[] {
  const first = firstZoneId(data);
  const zoneById = new Map(data.world.zones.map((zone) => [zone.id as ZoneId, zone]));
  const ids = [first, ...[...zoneById.keys()].filter((id) => id !== first)];
  return [
    { label: "Start screen", start: START_SCREEN },
    ...ids.map((zone) => ({ label: zoneById.get(zone)?.name ?? zone, start: zone })),
  ];
}

// The panel's settings: the cheats the game plays by, and those staged in the sheet with the
// start Apply goes to. Nothing staged changes the game until Apply.
export interface PanelState {
  readonly applied: Cheats;
  readonly staged: Cheats;
  readonly start: StartTarget;
}

export type PanelAction =
  | { readonly kind: "cancel" }
  | { readonly kind: "start"; readonly start: StartTarget }
  | { readonly kind: "switch"; readonly on: boolean }
  | { readonly kind: "toggle"; readonly id: CheatToggle; readonly on: boolean };

// The sheet as it opens: the applied cheats, bound for the start screen.
export function openPanel(applied: Cheats): PanelState {
  return { applied, staged: applied, start: START_SCREEN };
}

// Staging Cheats off turns every staged cheat off. Cancel stages what is applied again.
export function stagePanel(action: PanelAction, state: PanelState): PanelState {
  switch (action.kind) {
    case "cancel":
      return openPanel(state.applied);
    case "start":
      return { ...state, start: action.start };
    case "switch":
      return { ...state, staged: action.on ? cheatsOn(state.staged) : CHEATS_OFF };
    case "toggle":
      return { ...state, staged: setCheat(action.id, action.on, state.staged) };
    default:
      return assertNever(action);
  }
}

// What Apply does: the cheats the tab plays by from now, and the page to load. With cheats
// off, that is the start screen without `dev`; otherwise the chosen start, keeping `dev`. A
// neighborhood's walk gets seed. href is the current page.
export function applyPanel(
  data: RouteData,
  href: string,
  seed: number,
  state: PanelState,
): { readonly cheats: Cheats; readonly url: string } {
  const { staged, start } = state;
  if (!staged.on || start === START_SCREEN) {
    const url = new URL("/play/", href);
    url.search = new URL(stripDevParams(href, !staged.on)).search;
    return { cheats: staged.on ? staged : CHEATS_OFF, url: url.toString() };
  }
  const dev = new URL(href).searchParams.get("dev") === "1";
  const playUrl = new URL("/play/", href).href;
  return { cheats: staged, url: runSetupLink(playUrl, startAtSetup(data, dev, seed, start)) };
}

// A walk that starts at zone: the first zone is walked first, any other second, after the
// first, as if picked at the first fork.
function startAtSetup(data: RouteData, dev: boolean, seed: number, zone: ZoneId): RunSetup {
  const first = firstZoneId(data);
  return zone === first
    ? { dev, seed, speed: 1, zone: 1 }
    : { dev, route: [first, zone], seed, speed: 1, zone: 2 };
}
