import * as v from "valibot";

import type {
  AchievementId,
  DogId,
  GearId,
  HintId,
  MinorObstacleId,
  OptionPicks,
  TallyId,
  WalkerId,
  ZoneId,
} from "../data/types";
import type { RunCounters } from "../rules/achievements";
import { type Cents, cents as toCents } from "../rules/units";
import type { EndReason } from "../state/runState";

export const SAVE_VERSION = 19;

// Every tally the save keeps; a stored key outside it is dropped on load. A record, so a new
// TallyId fails to compile until it is listed here.
const TALLIES: Readonly<Record<TallyId, true>> = {
  dodges: true,
  neighboursMet: true,
  squirrelPulls: true,
  tips: true,
  treats: true,
  walletsFound: true,
};
export const TALLY_IDS = Object.keys(TALLIES) as TallyId[];

// The most dogs a run can take.
export const MAX_RUN_DOGS = 3;

const END_REASONS = ["finished", "noDogs", "wentHome"] as const satisfies readonly EndReason[];

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Stored as a plain integer, branded on load.
const cents = v.pipe(count, v.transform(toCents));
const zoneNumber = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
// Slot numbers, counting from 1. A number the game data has no slot for is dropped on load.
const slotNumbers = v.array(v.pipe(v.number(), v.safeInteger()));
// Clamped to 0 to 1 on load rather than rejected.
const volume = v.pipe(v.number(), v.finite());
// Stored ids stay strings: a saved id may be one the game data no longer has.
const contentId = v.pipe(v.string(), v.minLength(1));
const ids = v.array(contentId);

const dogStatsSchema = v.object({
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

// Card option picks, keyed by encounter id, then by option id.
const optionPicksSchema = v.record(contentId, v.record(contentId, count));

// A run's achievement counters (RunCounters). bumpsByKind is keyed by minor obstacle id and
// debuffsGot by debuff id.
const runCountersSchema = v.object({
  bumpsByKind: v.record(contentId, count),
  bumpsByZone: v.array(count),
  debuffsGot: v.record(contentId, count),
  firstZone: count,
  lastHeartOwners: count,
  optionPicks: optionPicksSchema,
  startCents: cents,
  // Keyed by TallyId.
  tallies: v.record(contentId, count),
});

// A run in progress, saved after each zone or as the tab hides. zonesFinished counts the zones
// finished, 0 in the first.
const checkpointSchema = v.object({
  counters: runCountersSchema,
  dogs: v.pipe(v.array(dogRunSchema), v.maxLength(MAX_RUN_DOGS)),
  earnedCents: cents,
  // The zones walked, in order, by id.
  route: ids,
  zonesFinished: count,
});

// A new player's holds the starter dogs, as many as their slots walk.
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
// An owner who fired you, and the zone they did it in, counting from 1.
const firingSchema = v.object({
  dog: contentId,
  zone: zoneNumber,
});
const lastWalkSchema = v.object({
  dogs: ids,
  earnedCents: cents,
  firings: v.array(firingSchema),
  outcome: v.picklist(END_REASONS),
  // The zones walked, in order, by id.
  route: ids,
  zonesFinished: count,
});

const statsSchema = v.object({
  // The most one walk banked for each pack size, keyed by its number of dogs; a size not yet
  // walked has none. Pack sizes outside 1 to MAX_RUN_DOGS are dropped on load.
  bestCentsByPackSize: v.record(v.string(), cents),
  // The walk that banked the most; null until the first run ends.
  bestWalk: v.nullable(walkSchema),
  // The most zones one run finished. Heading home mid-zone does not count that zone.
  bestZoneFinished: count,
  // Plain hits that cost their owner a heart over every run, keyed by minor obstacle id.
  bumpsByKind: v.record(contentId, count),
  dogs: v.record(contentId, dogStatsSchema),
  // Every dog that finished a walk from the first zone without its owner firing you, each once.
  dogsFinishedWith: ids,
  // The most recent walk; null until the first run ends.
  lastWalk: v.nullable(lastWalkSchema),
  // What every walk banked, starting cash included.
  lifetimeCents: cents,
  // Every walk's starting cash: lifetimeCents less this is what the walks earned.
  lifetimeStartCents: cents,
  // Finished walks from the first zone in which no owner fired you, since the last walk with a
  // firing. A walk headed home early with no firing leaves it as it is.
  noFiringStreak: count,
  // Each card option's picks over every run.
  optionPicks: optionPicksSchema,
  // Keyed by EndReason. A run banked from a checkpoint counts as wentHome.
  runs: v.object({
    finished: count,
    noDogs: count,
    wentHome: count,
  }),
  // Each tally over every run, keyed by TallyId.
  tallies: v.record(contentId, count),
  timesFired: count,
  // Every walker who finished a walk from the first zone, each once.
  walkersFinishedWith: ids,
  // Every zone a walk from the first zone finished, each once.
  zonesEverFinished: ids,
});

export const saveSchema = v.object({
  // Each earned achievement and when, in milliseconds since the Unix epoch.
  achievements: v.record(contentId, count),
  bankCents: cents,
  checkpoint: v.nullable(checkpointSchema),
  // Whether the player has seen the help screen, so it opens by itself only once.
  helpSeen: v.boolean(),
  lastLoadout: loadoutSchema,
  owned: v.object({
    // The dog slots owned by number, each once, bought in any order. A run takes one dog per
    // slot owned; the loadout never holds more.
    dogSlots: slotNumbers,
    dogs: ids,
    gear: ids,
    // The walkers unlocked, each once.
    walkers: ids,
  }),
  settings: v.object({
    musicVolume: volume,
    // Silences all sound without changing the volumes.
    muted: v.boolean(),
    reducedMotion: v.boolean(),
    sfxVolume: volume,
  }),
  // First-time hints already shown, each shown once.
  shownHints: ids,
  stats: statsSchema,
  version: v.literal(SAVE_VERSION),
  // The walker in use, one of owned.walkers; null once the player drops it on the home screen.
  walker: v.nullable(contentId),
});

// The document as stored: ids are any non-empty string.
export type StoredSave = v.InferOutput<typeof saveSchema>;
type StoredStats = StoredSave["stats"];

export type DogStats = v.InferOutput<typeof dogStatsSchema>;

// The document the game uses: the stored shape with every id checked against the content.
export interface DogRun extends Omit<v.InferOutput<typeof dogRunSchema>, "id"> {
  id: DogId;
}

export interface Checkpoint extends Omit<
  v.InferOutput<typeof checkpointSchema>,
  "counters" | "dogs" | "route"
> {
  counters: RunCounters;
  dogs: DogRun[];
  route: ZoneId[];
}

export interface Loadout {
  dogs: DogId[];
  gear: GearId | null;
}

export interface Owned {
  dogSlots: number[];
  dogs: DogId[];
  gear: GearId[];
  walkers: WalkerId[];
}

export interface Walk extends Omit<v.InferOutput<typeof walkSchema>, "dogs"> {
  dogs: DogId[];
}

export interface Firing extends Omit<v.InferOutput<typeof firingSchema>, "dog"> {
  dog: DogId;
}

export interface LastWalk extends Walk {
  firings: Firing[];
  outcome: EndReason;
  route: ZoneId[];
}

export interface SaveStats extends Omit<
  StoredStats,
  | "bestCentsByPackSize"
  | "bestWalk"
  | "bumpsByKind"
  | "dogs"
  | "dogsFinishedWith"
  | "lastWalk"
  | "optionPicks"
  | "runs"
  | "tallies"
  | "walkersFinishedWith"
  | "zonesEverFinished"
> {
  bestCentsByPackSize: Record<number, Cents>;
  bestWalk: Walk | null;
  bumpsByKind: Partial<Record<MinorObstacleId, number>>;
  dogs: Partial<Record<DogId, DogStats>>;
  dogsFinishedWith: DogId[];
  lastWalk: LastWalk | null;
  optionPicks: OptionPicks;
  runs: Record<EndReason, number>;
  tallies: Partial<Record<TallyId, number>>;
  walkersFinishedWith: WalkerId[];
  zonesEverFinished: ZoneId[];
}

export interface SaveDocument extends Omit<
  StoredSave,
  "achievements" | "checkpoint" | "lastLoadout" | "owned" | "shownHints" | "stats" | "walker"
> {
  achievements: Partial<Record<AchievementId, number>>;
  checkpoint: Checkpoint | null;
  lastLoadout: Loadout;
  owned: Owned;
  shownHints: HintId[];
  stats: SaveStats;
  walker: WalkerId | null;
}

// What a new player starts with. The free dogs and walkers stay owned on every load, and
// walker replaces a walker not owned.
export interface SaveDefaults {
  dogSlots: readonly number[];
  freeDogs: readonly DogId[];
  freeWalkers: readonly WalkerId[];
  walker: WalkerId;
}

export type Settings = SaveDocument["settings"];

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  muted: false,
  reducedMotion: false,
  sfxVolume: 0.8,
};

// A new player starts with the free dogs picked, as many as their slots walk, so the first
// walk is one tap on Start walk.
export function createDefaultSave(defaults: SaveDefaults): SaveDocument {
  const zero = toCents(0);
  return {
    achievements: {},
    bankCents: zero,
    checkpoint: null,
    helpSeen: false,
    lastLoadout: { dogs: defaults.freeDogs.slice(0, defaults.dogSlots.length), gear: null },
    owned: {
      dogSlots: [...defaults.dogSlots],
      dogs: [...defaults.freeDogs],
      gear: [],
      walkers: [...defaults.freeWalkers],
    },
    settings: { ...DEFAULT_SETTINGS },
    shownHints: [],
    stats: {
      bestCentsByPackSize: {},
      bestWalk: null,
      bestZoneFinished: 0,
      bumpsByKind: {},
      dogs: {},
      dogsFinishedWith: [],
      lastWalk: null,
      lifetimeCents: zero,
      lifetimeStartCents: zero,
      noFiringStreak: 0,
      optionPicks: {},
      runs: { finished: 0, noDogs: 0, wentHome: 0 },
      tallies: {},
      timesFired: 0,
      walkersFinishedWith: [],
      zonesEverFinished: [],
    },
    version: SAVE_VERSION,
    walker: defaults.walker,
  };
}
