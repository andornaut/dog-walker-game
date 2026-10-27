// The dev panel's logic, free of the DOM: the cheats, the save edits and the session keys it
// shares with the game.
import type { DogId, GameData, GearId, WalkerId, ZoneId } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { firstZoneId, type RouteData } from "../rules/route";
import { addCents, type Cents, cents } from "../rules/units";
import { MAX_RUN_DOGS, type SaveDocument } from "../save/schema";
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

// The walk's movement speed under the speed cheat.
export type Speed = "fast" | "normal" | "slow";

// Each cheat applies on its own: a toggle when true, the speed when not normal.
export interface Cheats {
  readonly devStats: boolean;
  readonly hitBoxes: boolean;
  readonly invincible: boolean;
  readonly speed: Speed;
}

type CheatToggle = "devStats" | "hitBoxes" | "invincible";

export const CHEATS_OFF: Cheats = {
  devStats: false,
  hitBoxes: false,
  invincible: false,
  speed: "normal",
};

// The panel's toggles, in its order.
export const CHEAT_TOGGLES: readonly { readonly id: CheatToggle; readonly label: string }[] = [
  { id: "invincible", label: "Invincible owners" },
  { id: "devStats", label: "Show dev stats" },
  { id: "hitBoxes", label: "Show hit boxes" },
];

export const SPEED_LABEL = "Movement speed";

// The speed choices, in the panel's order, with the walk's time scale at each.
export const SPEEDS: readonly {
  readonly id: Speed;
  readonly label: string;
  readonly scale: number;
}[] = [
  { id: "slow", label: "Slow", scale: 0.5 },
  { id: "normal", label: "Normal", scale: 1 },
  { id: "fast", label: "Fast", scale: 3 },
];

export function setCheat(id: CheatToggle, on: boolean, cheats: Cheats): Cheats {
  return { ...cheats, [id]: on };
}

export function setSpeed(speed: Speed, cheats: Cheats): Cheats {
  return { ...cheats, speed };
}

// Whether any cheat applies: a toggle on, or a speed other than normal.
export function cheatsInUse(cheats: Cheats): boolean {
  return CHEAT_TOGGLES.some(({ id }) => cheats[id]) || cheats.speed !== CHEATS_OFF.speed;
}

export function timeScaleOf(cheats: Cheats): number {
  return SPEEDS.find(({ id }) => id === cheats.speed)?.scale ?? 1;
}

function isSpeed(value: unknown): value is Speed {
  return SPEEDS.some(({ id }) => id === value);
}

// A toggle is on only when stored as true, and a missing or unknown speed is normal, so
// anything but an object is every cheat off. Any other field is ignored.
export function cheatsFrom(value: unknown): Cheats {
  if (typeof value !== "object" || value === null) {
    return CHEATS_OFF;
  }
  const stored = value as Record<string, unknown>;
  const { speed } = stored;
  return CHEAT_TOGGLES.reduce(
    (cheats, { id }) => setCheat(id, stored[id] === true, cheats),
    setSpeed(isSpeed(speed) ? speed : CHEATS_OFF.speed, CHEATS_OFF),
  );
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

// The run as the cheats leave it: invincible owners lose no hearts. A run already set as the
// cheats say is returned as it is.
export function withCheats(cheats: Cheats, run: RunState): RunState {
  const { invincible } = cheats;
  return (run.invincible ?? false) === invincible ? run : { ...run, invincible };
}

export type SaveEdit =
  | { readonly amount: Cents; readonly kind: "addMoney" }
  | { readonly kind: "reset" }
  | { readonly kind: "unlockAll" };

// The cheats that change progress, in the panel's order.
export const SAVE_CHEATS: readonly { readonly edit: SaveEdit; readonly label: string }[] = [
  { edit: { amount: cents(50_000), kind: "addMoney" }, label: "+$500" },
  { edit: { amount: cents(250_000), kind: "addMoney" }, label: "+$2,500" },
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
      dogSlots: data.dogSlots.slice(0, MAX_RUN_DOGS).map((_, i) => i + 1),
      dogs: withAll(Object.keys(data.dogs) as DogId[], owned.dogs),
      gear: withAll(Object.keys(data.shopGear) as GearId[], owned.gear),
      walkers: withAll(Object.keys(data.walkers) as WalkerId[], owned.walkers),
    },
  };
}

// A reset is newPlayer's save.
export function applySaveEdit(
  data: Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "walkers">,
  newPlayer: () => SaveDocument,
  edit: SaveEdit,
  save: SaveDocument,
): SaveDocument {
  switch (edit.kind) {
    case "addMoney":
      return addMoney(edit.amount, save);
    case "reset":
      return newPlayer();
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

// Where Apply goes: the start screen, or a walk in a neighbourhood.
export const START_SCREEN = "startScreen";
export type StartTarget = typeof START_SCREEN | ZoneId;

interface StartChoice {
  readonly label: string;
  readonly start: StartTarget;
}

// The start screen, then every neighbourhood: the first, then the rest easiest first.
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
  | { readonly kind: "speed"; readonly speed: Speed }
  | { readonly kind: "start"; readonly start: StartTarget }
  | { readonly kind: "toggle"; readonly id: CheatToggle; readonly on: boolean };

// The sheet as it opens: the applied cheats, bound for the start screen.
export function openPanel(applied: Cheats): PanelState {
  return { applied, staged: applied, start: START_SCREEN };
}

// Cancel stages what is applied again.
export function stagePanel(action: PanelAction, state: PanelState): PanelState {
  switch (action.kind) {
    case "cancel":
      return openPanel(state.applied);
    case "speed":
      return { ...state, staged: setSpeed(action.speed, state.staged) };
    case "start":
      return { ...state, start: action.start };
    case "toggle":
      return { ...state, staged: setCheat(action.id, action.on, state.staged) };
    default:
      return assertNever(action);
  }
}

function sameCheats(a: Cheats, b: Cheats): boolean {
  return CHEAT_TOGGLES.every(({ id }) => a[id] === b[id]) && a.speed === b.speed;
}

// Whether Apply would change anything: the staged cheats differ from the applied ones, or a
// walk is chosen as the start. Apply and Cancel are enabled only then.
export function hasStagedChanges(state: PanelState): boolean {
  const { applied, staged, start } = state;
  return !sameCheats(applied, staged) || start !== START_SCREEN;
}

// What Apply does: the cheats the tab plays by from now, and the page to load, with `dev` on
// exactly when a cheat is in use or a walk is chosen. The start screen drops the URL's run
// overrides; a neighbourhood's walk gets seed. href is the current page.
export function applyPanel(
  data: RouteData,
  href: string,
  seed: number,
  state: PanelState,
): { readonly cheats: Cheats; readonly url: string } {
  const { staged, start } = state;
  const playUrl = new URL("/play/", href);
  if (start !== START_SCREEN) {
    return { cheats: staged, url: runSetupLink(playUrl.href, startAtSetup(data, seed, start)) };
  }
  const dev = cheatsInUse(staged);
  const search = new URL(stripDevParams(href, !dev)).searchParams;
  if (dev) {
    search.set("dev", "1");
  }
  playUrl.search = search.toString();
  return { cheats: staged, url: playUrl.toString() };
}

// A walk, in dev mode, that starts at zone: the first zone is walked first, any other second,
// after the first, as if picked at the first fork.
function startAtSetup(data: RouteData, seed: number, zone: ZoneId): RunSetup {
  const first = firstZoneId(data);
  return zone === first
    ? { dev: true, seed, speed: 1, zone: 1 }
    : { dev: true, route: [first, zone], seed, speed: 1, zone: 2 };
}
