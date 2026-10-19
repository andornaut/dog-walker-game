import * as v from "valibot";

import type { DogId, GameData, GearId, HintId, WalkerId } from "../data/types";
import { startingDogSlots } from "../rules/shop";
import { migrateSave, saveMigrations } from "./migrations";
import {
  createDefaultSave,
  type DogStats,
  MAX_RUN_DOGS,
  type Owned,
  SAVE_VERSION,
  type SaveDefaults,
  type SaveDocument,
  saveSchema,
  type StoredSave,
  type Walk,
} from "./schema";

// The content ids the game currently has.
export interface KnownIds {
  dogs: ReadonlySet<DogId>;
  gear: ReadonlySet<GearId>;
  hints: ReadonlySet<HintId>;
  walkers: ReadonlySet<WalkerId>;
}

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

export type SaveData = Pick<
  GameData,
  "defaultWalker" | "dogSlots" | "dogs" | "hints" | "shopGear" | "walkers"
>;

// A new player has the starting dog slots, owns the dogs marked "start" and walks with the
// default walker.
export function saveContextFrom(data: SaveData): SaveContext {
  const dogs = keysOf(data.dogs);
  const freeDogs = dogs.filter((id) => data.dogs[id].unlock === "start");
  if (freeDogs.length === 0) {
    throw new Error("The game data needs a starter dog");
  }
  return {
    defaults: { dogSlots: startingDogSlots(data), freeDogs, walker: data.defaultWalker },
    known: {
      dogs: new Set(dogs),
      gear: new Set(keysOf(data.shopGear)),
      hints: new Set(keysOf(data.hints)),
      walkers: new Set(keysOf(data.walkers)),
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

function keepKnownWalk<W extends { dogs: string[] }>(
  known: KnownIds,
  walk: W | null,
): (Omit<W, "dogs"> & Pick<Walk, "dogs">) | null {
  return walk === null ? null : { ...walk, dogs: keepKnown(known.dogs, walk.dogs) };
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

// Drops ids the game no longer has, and loadout picks the player does not own. The free dogs
// are always owned, and an unknown walker becomes the default. Dog slots are clamped to 1 to
// MAX_RUN_DOGS and volumes to 0 to 1. A
// loadout keeps at most one dog per slot, and may be empty.
export function dropUnknownIds(context: SaveContext, save: StoredSave): SaveDocument {
  const { defaults, known } = context;
  const owned: Owned = {
    dogSlots: clamp(1, MAX_RUN_DOGS, save.owned.dogSlots),
    dogs: keepKnown(known.dogs, [...defaults.freeDogs, ...save.owned.dogs]),
    gear: keepKnown(known.gear, save.owned.gear),
  };
  const { gear } = save.lastLoadout;
  const lastLoadout = {
    dogs: keepKnown(new Set(owned.dogs), save.lastLoadout.dogs).slice(0, owned.dogSlots),
    gear: gear !== null && isKnown(new Set(owned.gear), gear) ? gear : null,
  };
  const { checkpoint, settings, stats } = save;
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
    lastLoadout,
    owned,
    settings: {
      ...settings,
      musicVolume: clamp(0, 1, settings.musicVolume),
      sfxVolume: clamp(0, 1, settings.sfxVolume),
    },
    shownHints: keepKnown(known.hints, save.shownHints),
    stats: {
      ...stats,
      bestWalk: keepKnownWalk(known, stats.bestWalk),
      dogs: keepKnownEntries(known.dogs, (dogStats: DogStats) => dogStats, stats.dogs),
      lastWalk: keepKnownWalk(known, stats.lastWalk),
    },
    walker: isKnown(known.walkers, save.walker) ? save.walker : defaults.walker,
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
