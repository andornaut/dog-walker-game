// The dev panel's logic, free of the DOM: its run form, its save edits and the session keys
// it shares with RunScene.
import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { addCents, type Cents } from "../rules/units";
import { MAX_RUN_DOGS, type SaveDocument } from "../save/schema";
import { decodeInputLog, encodeInputLog } from "./inputLog";
import {
  NO_GEAR,
  parseRunSetup,
  type RunSetup,
  type RunSetupLimits,
  runSetupLink,
} from "./runSetup";

// sessionStorage, "1" while the panel is open.
export const DEV_PANEL_OPEN_KEY = "dog-walker-game:dev-panel-open";
// sessionStorage: an input log, as encodeInputLog writes it, for the next run to play back.
// The run that reads it should remove it, so a reload plays normally.
export const DEV_REPLAY_KEY = "dog-walker-game:dev-replay";
// sessionStorage: the last finished run's input log, as encodeInputLog writes it. RunScene
// writes it at run end.
export const DEV_LAST_LOG_KEY = "dog-walker-game:dev-last-log";

// The form's gear value for "use the saved loadout's gear", which leaves gear out of the URL.
export const SAVED_LOADOUT = "";

// The run form's raw field values. An empty pack and an empty money or speed leave that
// parameter out of the URL, so the run uses its normal value.
export interface DevRunForm {
  readonly dev: boolean;
  // SAVED_LOADOUT, NO_GEAR or a gear id.
  readonly gear: string;
  readonly moneyDollars: string;
  readonly pack: readonly string[];
  readonly seed: string;
  readonly speed: string;
  readonly zone: string;
}

export interface CheckedRunForm<DogId extends string, GearId extends string> {
  readonly setup: RunSetup<DogId, GearId>;
  // Empty when the setup is exactly what the form says.
  readonly warnings: readonly string[];
}

const DOLLARS = /^(\d+)(?:\.(\d{1,2}))?$/;

// Whole dollars and up to two decimals, without a float multiply: "0.29" is 29 cents.
export function dollarsTextToCents(text: string): number | undefined {
  const match = DOLLARS.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  const [, whole = "", fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centsToDollarsText(amount: number): string {
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

export function formFromSetup(setup: RunSetup): DevRunForm {
  return {
    dev: setup.dev,
    gear: setup.gear === undefined ? SAVED_LOADOUT : (setup.gear ?? NO_GEAR),
    moneyDollars: setup.money === undefined ? "" : centsToDollarsText(setup.money),
    pack: setup.pack ?? [],
    seed: String(setup.seed),
    speed: String(setup.speed),
    zone: String(setup.zone),
  };
}

// The form as a URL query, read back with parseRunSetup so the panel warns about exactly what
// the game would ignore.
export function checkRunForm<DogId extends string, GearId extends string>(
  limits: RunSetupLimits<DogId, GearId>,
  form: DevRunForm,
): CheckedRunForm<DogId, GearId> {
  const params = new URLSearchParams();
  const warnings: string[] = [];
  const seed = form.seed.trim();
  if (seed === "") {
    warnings.push("Enter a seed or press random");
  } else {
    params.set("seed", seed);
  }
  if (form.pack.length > 0) {
    params.set("pack", form.pack.join(","));
  }
  if (form.gear !== SAVED_LOADOUT) {
    params.set("gear", form.gear);
  }
  params.set("zone", form.zone.trim());
  const money = form.moneyDollars.trim();
  if (money !== "") {
    const amount = dollarsTextToCents(money);
    if (amount === undefined) {
      warnings.push(`Invalid money "${money}": expected dollars with at most 2 decimals`);
    } else {
      params.set("money", String(amount));
    }
  }
  const speed = form.speed.trim();
  if (speed !== "") {
    params.set("speed", speed);
  }
  if (form.dev) {
    params.set("dev", "1");
  }
  const parsed = parseRunSetup(limits, () => 0, params.toString());
  return { setup: parsed.setup, warnings: [...warnings, ...parsed.warnings] };
}

export function addMoney(amount: Cents, save: SaveDocument): SaveDocument {
  return { ...save, bankCents: addCents(save.bankCents, amount) };
}

// What is already owned, in its order, then the rest of ids.
function withAll<Id extends string>(all: readonly Id[], owned: readonly Id[]): Id[] {
  return [...owned, ...all.filter((id) => !owned.includes(id))];
}

// Every dog, gear item, dog slot and walker a run can use.
export function unlockAll(
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

function bankText(amount: number): string {
  const dollars = (amount / 100).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `$${dollars}`;
}

function ownedText(all: number, owned: readonly string[]): string {
  return `${owned.length} of ${all}${owned.length === 0 ? "" : `: ${owned.join(", ")}`}`;
}

export function saveReadoutLines(
  data: Pick<GameData, "dogSlots" | "dogs" | "shopGear">,
  save: SaveDocument,
): string[] {
  const slotCount = Math.min(MAX_RUN_DOGS, data.dogSlots.length);
  return [
    `bank ${bankText(save.bankCents)}`,
    `slots ${save.owned.dogSlots} of ${slotCount}`,
    `dogs ${ownedText(Object.keys(data.dogs).length, save.owned.dogs)}`,
    `gear ${ownedText(Object.keys(data.shopGear).length, save.owned.gear)}`,
  ];
}

export type ReplayPlan =
  | { readonly errors: readonly string[]; readonly ok: false }
  | {
      readonly eventCount: number;
      readonly ok: true;
      readonly seed: number;
      // The log to store under DEV_REPLAY_KEY, re-encoded so the stored form is canonical.
      readonly stored: string;
      // The game page with the log's setup.
      readonly url: string;
    };

export function planReplay<DogId extends string, GearId extends string>(
  limits: RunSetupLimits<DogId, GearId>,
  playUrl: string,
  text: string,
): ReplayPlan {
  if (text.trim() === "") {
    return { errors: ["Paste an encoded input log"], ok: false };
  }
  const decoded = decodeInputLog(limits, text);
  if (!decoded.ok) {
    return decoded;
  }
  const { log } = decoded;
  return {
    eventCount: log.events.length,
    ok: true,
    seed: log.setup.seed,
    stored: encodeInputLog(log),
    url: runSetupLink(playUrl, log.setup),
  };
}

export type LastLog =
  | { readonly status: "none" }
  | {
      readonly fileName: string;
      readonly status: "recorded";
      // Describes the log, or why it does not decode; it downloads as stored either way.
      readonly summary: string;
    };

export function describeLastLog<DogId extends string, GearId extends string>(
  limits: RunSetupLimits<DogId, GearId>,
  stored: string | null,
): LastLog {
  if (stored === null || stored === "") {
    return { status: "none" };
  }
  const decoded = decodeInputLog(limits, stored);
  if (!decoded.ok) {
    return {
      fileName: "dog-walker-run.json",
      status: "recorded",
      summary: `does not decode: ${decoded.errors.join("; ")}`,
    };
  }
  const { events, setup } = decoded.log;
  return {
    fileName: `dog-walker-run-seed-${setup.seed}.json`,
    status: "recorded",
    summary: `seed ${setup.seed}, ${events.length} inputs`,
  };
}
