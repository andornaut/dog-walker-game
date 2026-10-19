import * as v from "valibot";

import type { DogId, GearId, WalkerId } from "../data/types";
import { cents as toCents } from "../rules/units";
import type { EndReason } from "../state/runState";

export const SAVE_VERSION = 1;

// The most dogs a run can take.
export const MAX_RUN_DOGS = 3;

// Content the game data does not define yet. The loader checks these against id sets the
// caller passes in, like the others.
export type AccessoryId = string;
export type CourseId = string;
export type DecorId = string;
export type HelpTopicId = string;
export type KitId = string;
export type LeashColorId = string;

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Stored as a plain integer, branded on load.
const cents = v.pipe(count, v.transform(toCents));
const zoneNumber = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
// Clamped to 1 to MAX_RUN_DOGS on load rather than rejected.
const dogSlots = v.pipe(v.number(), v.safeInteger());
// Stored ids stay strings: a saved id may be one the game data no longer has.
const contentId = v.pipe(v.string(), v.minLength(1));
const ids = v.array(contentId);

export const dogStatsSchema = v.object({
  timesFired: count,
  walks: count,
  zonesFinished: count,
});

// zonesFinished counts the zones the dog was paid for.
const dogRunSchema = v.object({
  fired: v.boolean(),
  id: contentId,
  zonesFinished: count,
});

// A run in progress, saved after each zone. zoneReached is the zone that just ended.
export const checkpointSchema = v.object({
  dogs: v.pipe(v.array(dogRunSchema), v.maxLength(MAX_RUN_DOGS)),
  earnedCents: cents,
  zoneReached: zoneNumber,
});

const loadoutSchema = v.object({
  dogs: v.pipe(ids, v.minLength(1), v.maxLength(MAX_RUN_DOGS)),
  gear: v.nullable(contentId),
});

// Each kind keeps what the player owns and what is in use, which is always owned.
const cosmeticsSchema = v.object({
  // Owned and equipped accessories, per dog id: at most one equipped per dog.
  accessories: v.object({
    equipped: v.record(contentId, contentId),
    owned: v.record(contentId, ids),
  }),
  decor: v.object({
    owned: ids,
    placed: ids,
  }),
  leashColors: v.object({
    equipped: v.nullable(contentId),
    owned: ids,
  }),
});

const statsSchema = v.object({
  bestRunCents: cents,
  // 0 until the first run ends.
  bestZoneReached: count,
  dogs: v.record(contentId, dogStatsSchema),
  lifetimeCents: cents,
  // Keyed by EndReason. A run banked from a checkpoint counts as wentHome.
  runs: v.object({
    finished: count,
    noDogs: count,
    wentHome: count,
  }),
  timesFired: count,
});

export const saveSchema = v.object({
  bankCents: cents,
  checkpoint: v.nullable(checkpointSchema),
  cosmetics: cosmeticsSchema,
  // Help topics already shown, so first-time help shows once.
  helpSeen: ids,
  lastLoadout: loadoutSchema,
  owned: v.object({
    // How many dogs a run can take; the loadout never holds more.
    dogSlots,
    dogs: ids,
    gear: ids,
    walkerKit: ids,
    walkers: ids,
  }),
  settings: v.object({}),
  stats: statsSchema,
  // Courses each dog has finished, per dog id.
  training: v.record(contentId, ids),
  version: v.literal(SAVE_VERSION),
  // The walker in use, always one the player owns.
  walker: contentId,
});

// The document as stored: ids are any non-empty string.
export type StoredSave = v.InferOutput<typeof saveSchema>;
type StoredStats = StoredSave["stats"];

export type DogStats = v.InferOutput<typeof dogStatsSchema>;

// The document the game uses: the stored shape with every id checked against the content.
export interface DogRun extends Omit<v.InferOutput<typeof dogRunSchema>, "id"> {
  id: DogId;
}

export interface Checkpoint extends Omit<v.InferOutput<typeof checkpointSchema>, "dogs"> {
  dogs: DogRun[];
}

export interface Loadout {
  dogs: DogId[];
  gear: GearId | null;
}

export interface Cosmetics {
  accessories: {
    equipped: Partial<Record<DogId, AccessoryId>>;
    owned: Partial<Record<DogId, AccessoryId[]>>;
  };
  decor: { owned: DecorId[]; placed: DecorId[] };
  leashColors: { equipped: LeashColorId | null; owned: LeashColorId[] };
}

export interface Owned {
  dogSlots: number;
  dogs: DogId[];
  gear: GearId[];
  walkerKit: KitId[];
  walkers: WalkerId[];
}

export interface SaveStats extends Omit<StoredStats, "dogs" | "runs"> {
  dogs: Partial<Record<DogId, DogStats>>;
  runs: Record<EndReason, number>;
}

export interface SaveDocument extends Omit<
  StoredSave,
  "checkpoint" | "cosmetics" | "lastLoadout" | "owned" | "stats" | "training" | "walker"
> {
  checkpoint: Checkpoint | null;
  cosmetics: Cosmetics;
  lastLoadout: Loadout;
  owned: Owned;
  stats: SaveStats;
  training: Partial<Record<DogId, CourseId[]>>;
  walker: WalkerId;
}

// What a new player starts with. The free dogs and walkers stay owned on every load.
export interface SaveDefaults {
  dogSlots: number;
  freeDogs: readonly DogId[];
  freeWalkers: readonly WalkerId[];
  lastLoadout: Readonly<Loadout>;
  // One of freeWalkers.
  walker: WalkerId;
}

export function createDefaultSave(defaults: SaveDefaults): SaveDocument {
  const zero = toCents(0);
  return {
    bankCents: zero,
    checkpoint: null,
    cosmetics: {
      accessories: { equipped: {}, owned: {} },
      decor: { owned: [], placed: [] },
      leashColors: { equipped: null, owned: [] },
    },
    helpSeen: [],
    lastLoadout: { dogs: [...defaults.lastLoadout.dogs], gear: defaults.lastLoadout.gear },
    owned: {
      dogSlots: defaults.dogSlots,
      dogs: [...defaults.freeDogs],
      gear: [],
      walkerKit: [],
      walkers: [...defaults.freeWalkers],
    },
    settings: {},
    stats: {
      bestRunCents: zero,
      bestZoneReached: 0,
      dogs: {},
      lifetimeCents: zero,
      runs: { finished: 0, noDogs: 0, wentHome: 0 },
      timesFired: 0,
    },
    training: {},
    version: SAVE_VERSION,
    walker: defaults.walker,
  };
}
