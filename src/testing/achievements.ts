import { ACHIEVEMENTS } from "../data/achievements";
import type {
  AchievementCondition,
  AchievementId,
  DogId,
  GearId,
  Threshold,
  WalkerId,
  ZoneId,
} from "../data/types";
import { assertNever } from "../lib/assertNever";
import type { AchievementData, RunFacts } from "../rules/achievements";
import { walkLength } from "../rules/route";
import { type Cents, cents, dollarsToCents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { packDogsOf } from "../state/pack";
import type { PackDogs } from "../state/runState";

// What an achievement's earnings condition asks one walk to earn, read from the data.
export function earningsGoal(id: AchievementId): Cents {
  const condition = ACHIEVEMENTS.find((achievement) => achievement.id === id)?.conditions.find(
    (each) => each.kind === "earnings",
  );
  if (condition?.kind !== "earnings") {
    throw new Error(`${id} has no earnings condition`);
  }
  return dollarsToCents(condition.dollars);
}

function needed(all: number, threshold: Threshold): number {
  return threshold === "all" ? all : threshold;
}

function conditionsOf(
  data: Pick<AchievementData, "achievements">,
  ids: readonly AchievementId[],
): AchievementCondition[] {
  return ids.flatMap((id) => {
    const achievement = data.achievements.find((each) => each.id === id);
    if (achievement === undefined) {
      throw new Error(`No achievement ${id}`);
    }
    return achievement.conditions;
  });
}

function dogIds(data: Pick<AchievementData, "dogs">): DogId[] {
  return Object.keys(data.dogs) as DogId[];
}

// The first size dogs in data order: a pack of that size.
export function packOf(data: Pick<AchievementData, "dogs">, size: number): PackDogs {
  const pack = packDogsOf(dogIds(data).slice(0, size));
  if (pack === undefined) {
    throw new Error(`No pack of ${size} dogs`);
  }
  return pack;
}

// facts raised to meet one condition, if it is judged on the run.
function raiseRun(zones: number, condition: AchievementCondition, facts: RunFacts): RunFacts {
  switch (condition.kind) {
    case "cleanZones":
    case "zonesFinished":
      return {
        ...facts,
        zonesFinished: Math.max(facts.zonesFinished, needed(zones, condition.count)),
      };
    case "debuffsGot":
      return {
        ...facts,
        debuffsGot: {
          ...facts.debuffsGot,
          [condition.debuff]: Math.max(facts.debuffsGot[condition.debuff] ?? 0, condition.count),
        },
      };
    case "earnings":
      return {
        ...facts,
        earnedCents: cents(Math.max(facts.earnedCents, dollarsToCents(condition.dollars))),
      };
    case "finishOnLastHeart":
      return {
        ...facts,
        lastHeartOwners: Math.max(facts.lastHeartOwners, 1),
        zonesFinished: zones,
      };
    case "fullPackBonus":
      return {
        ...facts,
        packSize: Math.max(facts.packSize, condition.packSize),
        zonesFinished: zones,
      };
    case "packSize":
      return { ...facts, packSize: Math.max(facts.packSize, condition.count) };
    case "dogSlotsOwned":
    case "dogsFinishedWith":
    case "dogsOwned":
    case "gearOwned":
    case "tally":
    case "timesFired":
    case "walkersUnlocked":
    case "walksWithoutFiring":
    case "zonesEverFinished":
      return facts;
    default:
      return assertNever(condition);
  }
}

// The least walk that meets every run condition of these achievements, read from their goals:
// a pack of the size asked for with every dog home, walked from the first zone with no bump and
// no starting cash, through the zones and with the debuffs, earnings and owners on their last
// heart each goal asks for.
export function runFactsFor(data: AchievementData, ids: readonly AchievementId[]): RunFacts {
  const zones = walkLength(data);
  const facts = conditionsOf(data, ids).reduce<RunFacts>(
    (raised, condition) => raiseRun(zones, condition, raised),
    {
      bumpsByZone: [],
      debuffsGot: {},
      dogsHome: 1,
      earnedCents: cents(0),
      firstZone: 0,
      lastHeartOwners: 0,
      packSize: 1,
      startCents: cents(0),
      tallies: {},
      zonesFinished: 0,
    },
  );
  return { ...facts, dogsHome: facts.packSize };
}

// have, or the first ids in data order when have holds fewer than threshold asks.
function enough<T>(all: readonly T[], threshold: Threshold, have: readonly T[]): T[] {
  const count = needed(all.length, threshold);
  return have.length >= count ? [...have] : all.slice(0, count);
}

// save raised to meet one condition, if it is judged on the save.
function raiseSave(
  data: AchievementData,
  condition: AchievementCondition,
  save: SaveDocument,
): SaveDocument {
  const { owned, stats } = save;
  switch (condition.kind) {
    case "dogSlotsOwned":
      return {
        ...save,
        owned: {
          ...owned,
          dogSlots: Math.max(owned.dogSlots, needed(data.dogSlots.length, condition.count)),
        },
      };
    case "dogsFinishedWith":
      return {
        ...save,
        stats: {
          ...stats,
          dogsFinishedWith: enough(dogIds(data), condition.count, stats.dogsFinishedWith),
        },
      };
    case "dogsOwned":
      return {
        ...save,
        owned: { ...owned, dogs: enough(dogIds(data), condition.count, owned.dogs) },
      };
    case "gearOwned":
      return {
        ...save,
        owned: {
          ...owned,
          gear: enough(Object.keys(data.shopGear) as GearId[], condition.count, owned.gear),
        },
      };
    case "tally":
      return {
        ...save,
        stats: {
          ...stats,
          tallies: {
            ...stats.tallies,
            [condition.tally]: Math.max(stats.tallies[condition.tally] ?? 0, condition.count),
          },
        },
      };
    case "timesFired":
      return {
        ...save,
        stats: { ...stats, timesFired: Math.max(stats.timesFired, condition.count) },
      };
    case "walkersUnlocked":
      return {
        ...save,
        owned: {
          ...owned,
          walkers: enough(Object.keys(data.walkers) as WalkerId[], condition.count, owned.walkers),
        },
      };
    case "walksWithoutFiring":
      return {
        ...save,
        stats: {
          ...stats,
          walksWithoutFiring: Math.max(stats.walksWithoutFiring, condition.count),
        },
      };
    case "zonesEverFinished":
      return {
        ...save,
        stats: {
          ...stats,
          zonesEverFinished: enough(
            data.world.zones.map(({ id }) => id as ZoneId),
            condition.count,
            stats.zonesEverFinished,
          ),
        },
      };
    case "cleanZones":
    case "debuffsGot":
    case "earnings":
    case "finishOnLastHeart":
    case "fullPackBonus":
    case "packSize":
    case "zonesFinished":
      return save;
    default:
      return assertNever(condition);
  }
}

// save raised to meet every profile condition of these achievements, read from their goals:
// the lifetime counts each asks for, and the first dogs, gear items, slots, walkers and finished
// zones in data order where it holds too few.
export function saveFor(
  data: AchievementData,
  ids: readonly AchievementId[],
  save: SaveDocument,
): SaveDocument {
  return conditionsOf(data, ids).reduce(
    (raised, condition) => raiseSave(data, condition, raised),
    save,
  );
}
