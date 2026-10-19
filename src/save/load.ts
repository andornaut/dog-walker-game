import * as v from "valibot";

import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { migrateSave, saveMigrations } from "./migrations";
import {
  type AccessoryId,
  type Cosmetics,
  type CourseId,
  createDefaultSave,
  type DecorId,
  type DogStats,
  type HelpTopicId,
  type KitId,
  type LeashColorId,
  type Owned,
  SAVE_VERSION,
  type SaveDefaults,
  type SaveDocument,
  saveSchema,
  type StoredSave,
} from "./schema";

// The content ids the game currently has.
export interface KnownIds {
  accessories: ReadonlySet<AccessoryId>;
  courses: ReadonlySet<CourseId>;
  decor: ReadonlySet<DecorId>;
  dogs: ReadonlySet<DogId>;
  gear: ReadonlySet<GearId>;
  helpTopics: ReadonlySet<HelpTopicId>;
  leashColors: ReadonlySet<LeashColorId>;
  walkerKit: ReadonlySet<KitId>;
  walkers: ReadonlySet<WalkerId>;
}

// The known ids that src/data/ does not define yet.
export type KnownIdsOutsideData = Omit<KnownIds, "dogs" | "gear" | "walkers">;

export interface SaveContext {
  defaults: SaveDefaults;
  known: KnownIds;
}

// "new" when nothing was stored. "corrupt" carries the stored text so the caller can
// keep it as a backup; its save is a fresh default.
export type LoadResult =
  | { raw: string; reason: string; save: SaveDocument; status: "corrupt" }
  | { save: SaveDocument; status: "loaded" | "new" };

function keysOf<Id extends string>(record: Readonly<Record<Id, unknown>>): Id[] {
  return Object.keys(record) as Id[];
}

// A new player has the fewest dog slots, owns the dogs and walkers marked "start", uses
// the first starter walker, and walks the first starter dog with no gear.
export function saveContextFrom(
  data: Pick<GameData, "dogs" | "shopGear" | "tuning" | "walkers">,
  outsideData: KnownIdsOutsideData,
): SaveContext {
  const dogs = keysOf(data.dogs);
  const walkers = keysOf(data.walkers);
  const freeDogs = dogs.filter((id) => data.dogs[id].unlock === "start");
  const freeWalkers = walkers.filter((id) => data.walkers[id].unlock === "start");
  const [firstDog] = freeDogs;
  const [firstWalker] = freeWalkers;
  if (firstDog === undefined || firstWalker === undefined) {
    throw new Error("The game data needs a starter dog and a starter walker");
  }
  return {
    defaults: {
      dogSlots: data.tuning.counts.packSizeMin,
      freeDogs,
      freeWalkers,
      lastLoadout: { dogs: [firstDog], gear: null },
      walker: firstWalker,
    },
    known: {
      ...outsideData,
      dogs: new Set(dogs),
      gear: new Set(keysOf(data.shopGear)),
      walkers: new Set(walkers),
    },
  };
}

function isKnown<Id extends string>(known: ReadonlySet<Id>, id: string): id is Id {
  return (known as ReadonlySet<string>).has(id);
}

// Known ids only, each once, in their stored order.
function keepKnown<Id extends string>(known: ReadonlySet<Id>, ids: readonly string[]): Id[] {
  return [...new Set(ids)].filter((id) => isKnown(known, id));
}

// Entries whose key is known, with each value mapped; a value mapped to undefined is dropped.
function keepKnownEntries<Key extends string, Stored, Value>(
  known: ReadonlySet<Key>,
  toValue: (stored: Stored, key: Key) => Value | undefined,
  record: Readonly<Record<string, Stored>>,
): Partial<Record<Key, Value>> {
  const kept: Partial<Record<Key, Value>> = {};
  for (const [key, stored] of Object.entries(record)) {
    if (isKnown(known, key)) {
      const value = toValue(stored, key);
      if (value !== undefined) {
        kept[key] = value;
      }
    }
  }
  return kept;
}

function keepKnownCosmetics(known: KnownIds, cosmetics: StoredSave["cosmetics"]): Cosmetics {
  const { accessories, decor, leashColors } = cosmetics;
  const ownedAccessories = keepKnownEntries(
    known.dogs,
    (stored: string[]) => keepKnown(known.accessories, stored),
    accessories.owned,
  );
  const ownedDecor = keepKnown(known.decor, decor.owned);
  const ownedLeashColors = keepKnown(known.leashColors, leashColors.owned);
  const { equipped: leash } = leashColors;
  return {
    accessories: {
      equipped: keepKnownEntries(
        known.dogs,
        (accessory: string, dog) => ownedAccessories[dog]?.find((id) => id === accessory),
        accessories.equipped,
      ),
      owned: ownedAccessories,
    },
    decor: { owned: ownedDecor, placed: keepKnown(new Set(ownedDecor), decor.placed) },
    leashColors: {
      equipped: leash !== null && isKnown(new Set(ownedLeashColors), leash) ? leash : null,
      owned: ownedLeashColors,
    },
  };
}

// Drops ids the game no longer has, and equipped items the player does not own. The free
// dogs and walkers are always owned. A loadout keeps at most one dog per slot, and one left
// without dogs falls back to the default.
export function dropUnknownIds(context: SaveContext, save: StoredSave): SaveDocument {
  const { defaults, known } = context;
  const owned: Owned = {
    dogSlots: save.owned.dogSlots,
    dogs: keepKnown(known.dogs, [...defaults.freeDogs, ...save.owned.dogs]),
    gear: keepKnown(known.gear, save.owned.gear),
    walkerKit: keepKnown(known.walkerKit, save.owned.walkerKit),
    walkers: keepKnown(known.walkers, [...defaults.freeWalkers, ...save.owned.walkers]),
  };
  const loadoutDogs = keepKnown(new Set(owned.dogs), save.lastLoadout.dogs).slice(
    0,
    owned.dogSlots,
  );
  const { gear } = save.lastLoadout;
  const lastLoadout =
    loadoutDogs.length > 0
      ? {
          dogs: loadoutDogs,
          gear: gear !== null && isKnown(new Set(owned.gear), gear) ? gear : null,
        }
      : { dogs: [...defaults.lastLoadout.dogs], gear: defaults.lastLoadout.gear };
  const { checkpoint, stats } = save;
  return {
    ...save,
    checkpoint:
      checkpoint === null
        ? null
        : {
            ...checkpoint,
            dogs: checkpoint.dogs.flatMap(({ id, ...dog }) =>
              isKnown(known.dogs, id) ? [{ ...dog, id }] : [],
            ),
          },
    cosmetics: keepKnownCosmetics(known, save.cosmetics),
    helpSeen: keepKnown(known.helpTopics, save.helpSeen),
    lastLoadout,
    owned,
    stats: {
      ...stats,
      dogs: keepKnownEntries(known.dogs, (dogStats: DogStats) => dogStats, stats.dogs),
    },
    training: keepKnownEntries(
      known.dogs,
      (courses: string[]) => keepKnown(known.courses, courses),
      save.training,
    ),
    walker: isKnown(new Set(owned.walkers), save.walker) ? save.walker : defaults.walker,
  };
}

function corrupt(context: SaveContext, raw: string, reason: string): LoadResult {
  return { raw, reason, save: createDefaultSave(context.defaults), status: "corrupt" };
}

// Parses, migrates and validates the stored text. Never throws: anything unreadable
// yields a fresh default save with status "corrupt".
export function loadSave(context: SaveContext, raw: string | null): LoadResult {
  if (raw === null) {
    return { save: createDefaultSave(context.defaults), status: "new" };
  }
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return corrupt(context, raw, "the save is not valid JSON");
    }
    const migrated = migrateSave(saveMigrations, SAVE_VERSION, parsed);
    if (!migrated.ok) {
      return corrupt(context, raw, migrated.reason);
    }
    const validated = v.safeParse(saveSchema, migrated.document);
    if (!validated.success) {
      return corrupt(context, raw, v.summarize(validated.issues));
    }
    return { save: dropUnknownIds(context, validated.output), status: "loaded" };
  } catch (error) {
    return corrupt(context, raw, String(error));
  }
}
