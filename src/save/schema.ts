import * as v from "valibot";

import type { AchievementId, DogId, GearId, HintId, WalkerId, ZoneId } from "../data/types";
import type { RunCounters } from "../rules/achievements";
import { PRE_FORK_ROUTE } from "../rules/route";
import { cents as toCents } from "../rules/units";
import type { EndReason } from "../state/runState";

export const SAVE_VERSION = 3;

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

// A run's achievement counters (RunCounters). debuffsGot is keyed by debuff id; a checkpoint
// saved before it counted zones ended with a debuff instead, which is dropped.
const runCountersSchema = v.object({
  bumpsByZone: v.array(count),
  debuffsGot: v.optional(v.record(contentId, count), {}),
  // Checkpoints saved before it walked from the first zone.
  firstZone: v.optional(count, 0),
  squirrelChases: count,
  // Checkpoints saved before it count the starting money toward money goals.
  startCents: v.optional(cents, 0),
});

// The zones a run walked, in order, by id. A save from before forks walked the pre-fork route.
const routeSchema = v.optional(ids, () => [...PRE_FORK_ROUTE]);

// A run in progress, saved after each zone. zonesFinished is the zone that just ended.
// counters is null in a checkpoint saved before achievements: its run earns no run badges.
export const checkpointSchema = v.object({
  counters: v.optional(v.nullable(runCountersSchema), null),
  dogs: v.pipe(v.array(dogRunSchema), v.maxLength(MAX_RUN_DOGS)),
  earnedCents: cents,
  route: routeSchema,
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
  route: routeSchema,
  zonesFinished: count,
});

const statsSchema = v.object({
  // The walk that banked the most; null until the first run ends.
  bestWalk: v.nullable(walkSchema),
  // The most zones one run finished. Heading home mid-zone does not count that zone.
  bestZoneFinished: count,
  dogs: v.record(contentId, dogStatsSchema),
  // Every dog that finished a walk without its owner firing you, each once.
  dogsFinishedWith: v.optional(ids, []),
  // The most recent walk; null until the first run ends.
  lastWalk: v.nullable(lastWalkSchema),
  lifetimeCents: cents,
  // Keyed by EndReason. A run banked from a checkpoint counts as wentHome.
  runs: v.object({
    finished: count,
    noDogs: count,
    wentHome: count,
  }),
  // Squirrel chases let happen, over every run.
  squirrelsChased: v.optional(count, 0),
  timesFired: count,
  // Finished walks in which no owner fired you.
  walksWithoutFiring: v.optional(count, 0),
});

export const saveSchema = v.object({
  // Each earned achievement and when, in milliseconds since the Unix epoch.
  achievements: v.optional(v.record(contentId, count), {}),
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
    // The walkers unlocked, each once.
    walkers: ids,
  }),
  settings: v.object({
    musicVolume: volume,
    // Silences all sound without changing the volumes. Saves from before it load unmuted.
    muted: v.optional(v.boolean(), false),
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
  counters: RunCounters | null;
  dogs: DogRun[];
  route: ZoneId[];
}

export interface Loadout {
  dogs: DogId[];
  gear: GearId | null;
}

export interface Owned {
  dogSlots: number;
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
  "bestWalk" | "dogs" | "dogsFinishedWith" | "lastWalk" | "runs"
> {
  bestWalk: Walk | null;
  dogs: Partial<Record<DogId, DogStats>>;
  dogsFinishedWith: DogId[];
  lastWalk: LastWalk | null;
  runs: Record<EndReason, number>;
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
  dogSlots: number;
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

// A new player has no loadout until they pick one of the free dogs.
export function createDefaultSave(defaults: SaveDefaults): SaveDocument {
  const zero = toCents(0);
  return {
    achievements: {},
    bankCents: zero,
    checkpoint: null,
    helpSeen: false,
    lastLoadout: { dogs: [], gear: null },
    owned: {
      dogSlots: defaults.dogSlots,
      dogs: [...defaults.freeDogs],
      gear: [],
      walkers: [...defaults.freeWalkers],
    },
    settings: { ...DEFAULT_SETTINGS },
    shownHints: [],
    stats: {
      bestWalk: null,
      bestZoneFinished: 0,
      dogs: {},
      dogsFinishedWith: [],
      lastWalk: null,
      lifetimeCents: zero,
      runs: { finished: 0, noDogs: 0, wentHome: 0 },
      squirrelsChased: 0,
      timesFired: 0,
      walksWithoutFiring: 0,
    },
    version: SAVE_VERSION,
    walker: defaults.walker,
  };
}
