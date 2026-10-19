import * as v from "valibot";

import type { DogId, GearId, HintId, WalkerId } from "../data/types";
import { cents as toCents } from "../rules/units";
import type { EndReason } from "../state/runState";

export const SAVE_VERSION = 1;

// The most dogs a run can take.
export const MAX_RUN_DOGS = 3;

const END_REASONS = ["finished", "noDogs", "wentHome"] as const satisfies readonly EndReason[];

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Stored as a plain integer, branded on load.
const cents = v.pipe(count, v.transform(toCents));
const zoneNumber = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
// Clamped to 1 to MAX_RUN_DOGS on load rather than rejected.
const dogSlots = v.pipe(v.number(), v.safeInteger());
// Clamped to 0 to 1 on load rather than rejected.
const volume = v.pipe(v.number(), v.finite());
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

// A run in progress, saved after each zone. zonesFinished is the zone that just ended.
export const checkpointSchema = v.object({
  dogs: v.pipe(v.array(dogRunSchema), v.maxLength(MAX_RUN_DOGS)),
  earnedCents: cents,
  zonesFinished: zoneNumber,
});

// Empty until a new player picks their first dog.
const loadoutSchema = v.object({
  dogs: v.pipe(ids, v.maxLength(MAX_RUN_DOGS)),
  gear: v.nullable(contentId),
});

// One walk for the logbook: what it banked, how many zones it finished, and its dogs. Keys
// stay in alphabetical order, as the stored JSON writes them.
const walkSchema = v.object({
  dogs: ids,
  earnedCents: cents,
  zonesFinished: count,
});
const lastWalkSchema = v.object({
  dogs: ids,
  earnedCents: cents,
  outcome: v.picklist(END_REASONS),
  zonesFinished: count,
});

const statsSchema = v.object({
  // The walk that banked the most; null until the first run ends.
  bestWalk: v.nullable(walkSchema),
  // The most zones one run finished. Heading home mid-zone does not count that zone.
  bestZoneFinished: count,
  dogs: v.record(contentId, dogStatsSchema),
  // The most recent walk; null until the first run ends.
  lastWalk: v.nullable(lastWalkSchema),
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
  // Whether the player has seen the help screen, so it opens by itself only once.
  helpSeen: v.boolean(),
  lastLoadout: loadoutSchema,
  owned: v.object({
    // How many dogs a run can take; the loadout never holds more.
    dogSlots,
    dogs: ids,
    gear: ids,
  }),
  settings: v.object({
    musicVolume: volume,
    reducedMotion: v.boolean(),
    sfxVolume: volume,
  }),
  // First-time hints already shown, each shown once.
  shownHints: ids,
  stats: statsSchema,
  version: v.literal(SAVE_VERSION),
  // The walker in use.
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

export interface Owned {
  dogSlots: number;
  dogs: DogId[];
  gear: GearId[];
}

export interface Walk extends Omit<v.InferOutput<typeof walkSchema>, "dogs"> {
  dogs: DogId[];
}

export interface LastWalk extends Walk {
  outcome: EndReason;
}

export interface SaveStats extends Omit<StoredStats, "bestWalk" | "dogs" | "lastWalk" | "runs"> {
  bestWalk: Walk | null;
  dogs: Partial<Record<DogId, DogStats>>;
  lastWalk: LastWalk | null;
  runs: Record<EndReason, number>;
}

export interface SaveDocument extends Omit<
  StoredSave,
  "checkpoint" | "lastLoadout" | "owned" | "shownHints" | "stats" | "walker"
> {
  checkpoint: Checkpoint | null;
  lastLoadout: Loadout;
  owned: Owned;
  shownHints: HintId[];
  stats: SaveStats;
  walker: WalkerId;
}

// What a new player starts with. The free dogs stay owned on every load, and walker replaces
// an unknown walker.
export interface SaveDefaults {
  dogSlots: number;
  freeDogs: readonly DogId[];
  walker: WalkerId;
}

export const DEFAULT_SETTINGS: SaveDocument["settings"] = {
  musicVolume: 0.6,
  reducedMotion: false,
  sfxVolume: 0.8,
};

// A new player has no loadout until they pick one of the free dogs.
export function createDefaultSave(defaults: SaveDefaults): SaveDocument {
  const zero = toCents(0);
  return {
    bankCents: zero,
    checkpoint: null,
    helpSeen: false,
    lastLoadout: { dogs: [], gear: null },
    owned: {
      dogSlots: defaults.dogSlots,
      dogs: [...defaults.freeDogs],
      gear: [],
    },
    settings: { ...DEFAULT_SETTINGS },
    shownHints: [],
    stats: {
      bestWalk: null,
      bestZoneFinished: 0,
      dogs: {},
      lastWalk: null,
      lifetimeCents: zero,
      runs: { finished: 0, noDogs: 0, wentHome: 0 },
      timesFired: 0,
    },
    version: SAVE_VERSION,
    walker: defaults.walker,
  };
}
