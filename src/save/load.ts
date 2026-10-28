import * as v from "valibot";

import type {
  AchievementId,
  DebuffId,
  DogId,
  EncounterId,
  GameData,
  GearId,
  HintId,
  MinorObstacleId,
  OptionPicks,
  TallyId,
  WalkerId,
  ZoneId,
} from "../data/types";
import { clamp01 } from "../lib/numbers";
import { startingDogSlots } from "../rules/shop";
import {
  createDefaultSave,
  MAX_RUN_DOGS,
  type Owned,
  SAVE_VERSION,
  type SaveDefaults,
  type SaveDocument,
  saveSchema,
  type StoredSave,
  TALLY_IDS,
  type Walk,
} from "./schema";

// The content ids the game currently has.
interface KnownIds {
  achievements: ReadonlySet<AchievementId>;
  debuffs: ReadonlySet<DebuffId>;
  // The dog slots by number, counting from 1.
  dogSlots: ReadonlySet<number>;
  dogs: ReadonlySet<DogId>;
  gear: ReadonlySet<GearId>;
  hints: ReadonlySet<HintId>;
  minorObstacles: ReadonlySet<MinorObstacleId>;
  // Each encounter that opens a card, with its option ids.
  options: ReadonlyMap<EncounterId, ReadonlySet<string>>;
  walkers: ReadonlySet<WalkerId>;
  zones: ReadonlySet<ZoneId>;
}

export interface SaveContext {
  defaults: SaveDefaults;
  known: KnownIds;
}

// "new" when nothing was stored. "corrupt" carries the stored text so the caller can
// keep it as a backup; its save is a fresh default. "newer" is a save from a later version
// than this game: its save is a fresh default, and the stored save must be left as it is.
type LoadResult =
  | { raw: string; reason: string; save: SaveDocument; status: "corrupt" }
  | { reason: string; save: SaveDocument; status: "newer" }
  | { save: SaveDocument; status: "loaded" | "new" };

function keysOf<Id extends string>(record: Readonly<Record<Id, unknown>>): Id[] {
  return Object.keys(record) as Id[];
}

type SaveData = Pick<
  GameData,
  | "achievements"
  | "debuffs"
  | "defaultWalker"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "hints"
  | "minorObstacles"
  | "shopGear"
  | "walkers"
  | "world"
>;

// A new player has the starting dog slots, owns the dogs and walkers marked "start" and walks
// with the default walker.
export function saveContextFrom(data: SaveData): SaveContext {
  const dogs = keysOf(data.dogs);
  const freeDogs = dogs.filter((id) => data.dogs[id].unlock === "start");
  if (freeDogs.length === 0) {
    throw new Error("The game data needs a starter dog");
  }
  const freeWalkers = keysOf(data.walkers).filter((id) => data.walkers[id].unlock === "start");
  if (!freeWalkers.includes(data.defaultWalker)) {
    throw new Error("The default walker needs to walk from the start");
  }
  return {
    defaults: {
      dogSlots: startingDogSlots(data),
      freeDogs,
      freeWalkers,
      walker: data.defaultWalker,
    },
    known: {
      achievements: new Set(data.achievements.map(({ id }) => id)),
      debuffs: new Set(keysOf(data.debuffs)),
      dogSlots: new Set(data.dogSlots.map((_, i) => i + 1)),
      dogs: new Set(dogs),
      gear: new Set(keysOf(data.shopGear)),
      hints: new Set(keysOf(data.hints)),
      minorObstacles: new Set(keysOf(data.minorObstacles)),
      options: new Map(
        keysOf(data.encounters).flatMap((id) => {
          const { resolution } = data.encounters[id];
          return resolution.kind === "card"
            ? [[id, new Set(resolution.options.map((option) => option.id))] as const]
            : [];
        }),
      ),
      walkers: new Set(keysOf(data.walkers)),
      zones: new Set(data.world.zones.map(({ id }) => id as ZoneId)),
    },
  };
}

const KNOWN_TALLIES: ReadonlySet<TallyId> = new Set(TALLY_IDS);
// The pack sizes a run can take, as the stored keys of the bests by pack size.
const PACK_SIZES: ReadonlySet<string> = new Set(
  Array.from({ length: MAX_RUN_DOGS }, (_, index) => String(index + 1)),
);

function isKnown<Id extends string>(known: ReadonlySet<Id>, id: string): id is Id {
  return (known as ReadonlySet<string>).has(id);
}

// Known ids only, each once, in their stored order.
function keepKnown<Id extends string>(known: ReadonlySet<Id>, ids: readonly string[]): Id[] {
  return [...new Set(ids)].filter((id) => isKnown(known, id));
}

// The entries whose key is known.
function keepKnownEntries<Key extends string, Value>(
  known: ReadonlySet<Key>,
  record: Readonly<Record<string, Value>>,
): Partial<Record<Key, Value>> {
  const kept: Partial<Record<Key, Value>> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isKnown(known, key)) {
      kept[key] = value;
    }
  }
  return kept;
}

// The picks of options the game still has, on cards it still has.
function keepKnownPicks(
  known: KnownIds,
  picks: Readonly<Record<string, Readonly<Record<string, number>>>>,
): OptionPicks {
  const kept: OptionPicks = {};
  for (const [encounter, byOption] of Object.entries(picks)) {
    const options = known.options.get(encounter as EncounterId);
    if (options !== undefined) {
      kept[encounter as EncounterId] = Object.fromEntries(
        Object.entries(byOption).filter(([option]) => options.has(option)),
      );
    }
  }
  return kept;
}

function keepKnownWalk<W extends { dogs: string[] }>(
  known: KnownIds,
  walk: W,
): Omit<W, "dogs"> & Pick<Walk, "dogs"> {
  return { ...walk, dogs: keepKnown(known.dogs, walk.dogs) };
}

// Drops ids the game no longer has, and loadout picks the player does not own. The free dogs
// and walkers are always owned, and a walker not owned becomes the default. The starting dog
// slots are always owned, and a slot number the game has no slot for is dropped. Volumes are
// clamped to 0 to 1, and a best for a pack size outside 1 to MAX_RUN_DOGS is dropped. A
// loadout keeps at most one dog per slot owned, and may be empty.
function dropUnknownIds(context: SaveContext, save: StoredSave): SaveDocument {
  const { defaults, known } = context;
  const owned: Owned = {
    dogSlots: [...new Set([...defaults.dogSlots, ...save.owned.dogSlots])]
      .filter((slot) => known.dogSlots.has(slot))
      .sort((a, b) => a - b),
    dogs: keepKnown(known.dogs, [...defaults.freeDogs, ...save.owned.dogs]),
    gear: keepKnown(known.gear, save.owned.gear),
    walkers: keepKnown(known.walkers, [...defaults.freeWalkers, ...save.owned.walkers]),
  };
  const { gear } = save.lastLoadout;
  const lastLoadout = {
    dogs: keepKnown(new Set(owned.dogs), save.lastLoadout.dogs).slice(0, owned.dogSlots.length),
    gear: gear !== null && isKnown(new Set(owned.gear), gear) ? gear : null,
  };
  const { checkpoint, settings, stats } = save;
  return {
    ...save,
    achievements: keepKnownEntries(known.achievements, save.achievements),
    checkpoint:
      checkpoint === null
        ? null
        : {
            ...checkpoint,
            counters: {
              ...checkpoint.counters,
              bumpsByKind: keepKnownEntries(known.minorObstacles, checkpoint.counters.bumpsByKind),
              debuffsGot: keepKnownEntries(known.debuffs, checkpoint.counters.debuffsGot),
              optionPicks: keepKnownPicks(known, checkpoint.counters.optionPicks),
              tallies: keepKnownEntries(KNOWN_TALLIES, checkpoint.counters.tallies),
            },
            dogs: checkpoint.dogs.flatMap(({ id, ...dog }) =>
              isKnown(known.dogs, id) ? [{ ...dog, id }] : [],
            ),
            route: keepKnown(known.zones, checkpoint.route),
          },
    lastLoadout,
    owned,
    settings: {
      ...settings,
      musicVolume: clamp01(settings.musicVolume),
      sfxVolume: clamp01(settings.sfxVolume),
    },
    shownHints: keepKnown(known.hints, save.shownHints),
    stats: {
      ...stats,
      bestCentsByPackSize: Object.fromEntries(
        Object.entries(stats.bestCentsByPackSize).filter(([size]) => PACK_SIZES.has(size)),
      ),
      bestWalk: stats.bestWalk === null ? null : keepKnownWalk(known, stats.bestWalk),
      bumpsByKind: keepKnownEntries(known.minorObstacles, stats.bumpsByKind),
      dogs: keepKnownEntries(known.dogs, stats.dogs),
      dogsFinishedWith: keepKnown(known.dogs, stats.dogsFinishedWith),
      lastWalk:
        stats.lastWalk === null
          ? null
          : {
              ...keepKnownWalk(known, stats.lastWalk),
              firings: stats.lastWalk.firings.flatMap(({ dog, zone }) =>
                isKnown(known.dogs, dog) ? [{ dog, zone }] : [],
              ),
              route: keepKnown(known.zones, stats.lastWalk.route),
            },
      optionPicks: keepKnownPicks(known, stats.optionPicks),
      tallies: keepKnownEntries(KNOWN_TALLIES, stats.tallies),
      walkersFinishedWith: keepKnown(known.walkers, stats.walkersFinishedWith),
      zonesEverFinished: keepKnown(known.zones, stats.zonesEverFinished),
    },
    walker:
      save.walker === null
        ? null
        : isKnown(new Set(owned.walkers), save.walker)
          ? save.walker
          : defaults.walker,
  };
}

function corrupt(context: SaveContext, raw: string, reason: string): LoadResult {
  return { raw, reason, save: createDefaultSave(context.defaults), status: "corrupt" };
}

// The stored version, if the document is an object with an integer one.
function storedVersion(document: unknown): number | undefined {
  if (typeof document !== "object" || document === null || !("version" in document)) {
    return undefined;
  }
  const { version } = document;
  return typeof version === "number" && Number.isSafeInteger(version) ? version : undefined;
}

// Parses and validates the stored text. Never throws: a save from a later version yields a
// fresh default save with status "newer", and anything else unreadable, a save from an earlier
// version included, one with status "corrupt".
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
    const version = storedVersion(parsed);
    if (version !== undefined && version > SAVE_VERSION) {
      return {
        reason: `the save is from version ${version}, newer than this game`,
        save: createDefaultSave(context.defaults),
        status: "newer",
      };
    }
    if (version !== undefined && version < SAVE_VERSION) {
      return corrupt(context, raw, `the save is from version ${version}, older than this game`);
    }
    const validated = v.safeParse(saveSchema, parsed);
    if (!validated.success) {
      return corrupt(context, raw, v.summarize(validated.issues));
    }
    return { save: dropUnknownIds(context, validated.output), status: "loaded" };
  } catch (error) {
    return corrupt(context, raw, String(error));
  }
}
