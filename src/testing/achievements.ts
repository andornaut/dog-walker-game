import { assertNever } from "@andornaut/game-kit/assertNever";
import { keysOf } from "@andornaut/game-kit/records";

import { ACHIEVEMENTS } from "../data/achievements";
import type { AchievementCondition, AchievementId, DogId, Threshold, ZoneId } from "../data/types";
import { type AchievementData, needed, picksOf, type RunFacts } from "../rules/achievements";
import { walkLength } from "../rules/route";
import type { SaveDocument } from "../save/schema";
import { timesFired, walksFinished, walksPlayed, ZERO_DOG_STATS } from "../save/stats";
import { packDogsOf } from "../state/pack";
import type { PackDogs } from "../state/runState";
import { type Cents, cents, dollarsToCents } from "../units";

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
  return keysOf(data.dogs);
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
function raiseRun(
  data: AchievementData,
  condition: AchievementCondition,
  facts: RunFacts,
): RunFacts {
  const zones = walkLength(data);
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
    case "bumps":
    case "dogsFinishedWith":
    case "dogsOwned":
    case "firedByOwners":
    case "gearOwned":
    case "lifetimeEarnings":
    case "noFiringStreak":
    case "optionPicks":
    case "tally":
    case "timesFired":
    case "walkersFinishedWith":
    case "walkersUnlocked":
    case "walksFinished":
    case "walksPlayed":
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
  const facts = conditionsOf(data, ids).reduce<RunFacts>(
    (raised, condition) => raiseRun(data, condition, raised),
    {
      bumpsByKind: {},
      bumpsByZone: [],
      debuffsGot: {},
      dogsHome: 1,
      earnedCents: cents(0),
      firstZone: 0,
      lastHeartOwners: 0,
      optionPicks: {},
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
    case "bumps": {
      const [first] = condition.kinds;
      const have = condition.kinds.reduce((sum, kind) => sum + (stats.bumpsByKind[kind] ?? 0), 0);
      const short = Math.max(0, condition.count - have);
      return {
        ...save,
        stats: {
          ...stats,
          bumpsByKind: { ...stats.bumpsByKind, [first]: (stats.bumpsByKind[first] ?? 0) + short },
        },
      };
    }
    case "firedByOwners": {
      const dogs = { ...stats.dogs };
      for (const id of dogIds(data).slice(0, needed(dogIds(data).length, condition.count))) {
        const current = dogs[id] ?? ZERO_DOG_STATS;
        dogs[id] = { ...current, timesFired: Math.max(current.timesFired, 1) };
      }
      return { ...save, stats: { ...stats, dogs } };
    }
    case "lifetimeEarnings":
      return {
        ...save,
        stats: {
          ...stats,
          lifetimeCents: cents(
            Math.max(
              stats.lifetimeCents,
              stats.lifetimeStartCents + dollarsToCents(condition.dollars),
            ),
          ),
        },
      };
    case "walkersFinishedWith":
      return {
        ...save,
        stats: {
          ...stats,
          walkersFinishedWith: enough(
            keysOf(data.walkers),
            condition.count,
            stats.walkersFinishedWith,
          ),
        },
      };
    case "walksFinished": {
      const short = Math.max(0, condition.count - walksFinished(stats));
      return {
        ...save,
        stats: { ...stats, runs: { ...stats.runs, finished: stats.runs.finished + short } },
      };
    }
    case "walksPlayed": {
      const short = Math.max(0, condition.count - walksPlayed(stats));
      return {
        ...save,
        stats: { ...stats, runs: { ...stats.runs, wentHome: stats.runs.wentHome + short } },
      };
    }
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
          gear: enough(keysOf(data.shopGear), condition.count, owned.gear),
        },
      };
    case "noFiringStreak":
      return {
        ...save,
        stats: { ...stats, noFiringStreak: Math.max(stats.noFiringStreak, condition.count) },
      };
    case "optionPicks": {
      const { encounter, option } = condition;
      const picks = Math.max(picksOf(stats.optionPicks, encounter, option), condition.count);
      return {
        ...save,
        stats: {
          ...stats,
          optionPicks: {
            ...stats.optionPicks,
            [encounter]: { ...stats.optionPicks[encounter], [option]: picks },
          },
        },
      };
    }
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
    case "timesFired": {
      const [first] = packOf(data, 1);
      const current = stats.dogs[first] ?? ZERO_DOG_STATS;
      const short = Math.max(0, condition.count - timesFired(stats));
      return {
        ...save,
        stats: {
          ...stats,
          dogs: { ...stats.dogs, [first]: { ...current, timesFired: current.timesFired + short } },
        },
      };
    }
    case "walkersUnlocked":
      return {
        ...save,
        owned: {
          ...owned,
          walkers: enough(keysOf(data.walkers), condition.count, owned.walkers),
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
// the lifetime counts, option picks, streak, dollars and walks played or finished each asks
// for (bumps all by the first kind it names, firings all by the first dog's owner), and the
// first dogs, gear items, walkers, owners who fired you and finished zones in data order where
// it holds too few.
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
