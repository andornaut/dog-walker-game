import { assertNever } from "@andornaut/game-kit/assertNever";

import type {
  Achievement,
  AchievementCondition,
  AchievementId,
  DebuffId,
  EncounterId,
  GameData,
  MinorObstacleId,
  OptionPicks,
  TallyId,
  Threshold,
} from "../data/types";
import { minorObstacleNames } from "../runner/obstacleLooks";
import type { SaveDocument, SaveStats } from "../save/schema";
import { lifetimeEarnedNet, timesFired, walksFinished, walksPlayed } from "../save/stats";
import type { RunState } from "../state/runState";
import { type Cents, dollarsToCents } from "../units";
import { walkLength } from "./route";

export type AchievementData = Pick<
  GameData,
  "achievements" | "debuffs" | "dogs" | "encounters" | "shopGear" | "walkers" | "world"
>;

// The counters a run keeps for its achievements, copied out of the run state for the save.
// Zones before firstZone were skipped by a dev start: they are neither finished nor clean.
// startCents is the money the run began with, which a money goal leaves out. bumpsByKind,
// optionPicks and tallies are this run's share of the lifetime ones.
export interface RunCounters {
  bumpsByKind: Partial<Record<MinorObstacleId, number>>;
  bumpsByZone: number[];
  debuffsGot: Partial<Record<DebuffId, number>>;
  firstZone: number;
  optionPicks: OptionPicks;
  startCents: Cents;
  tallies: Partial<Record<TallyId, number>>;
}

// What the run conditions judge: the run's counters, what it banked (starting money
// included), how many dogs set out and got home unfired, how many walking owners ended it on
// their last heart, and how many zones it finished.
export interface RunFacts extends RunCounters {
  readonly dogsHome: number;
  readonly earnedCents: Cents;
  readonly lastHeartOwners: number;
  readonly packSize: number;
  readonly zonesFinished: number;
}

export function runCountersOf(
  run: Pick<
    RunState,
    | "bumpsByKind"
    | "bumpsByZone"
    | "debuffsGot"
    | "firstZone"
    | "optionPicks"
    | "startMoney"
    | "tallies"
  >,
): RunCounters {
  const { bumpsByKind, bumpsByZone, debuffsGot, firstZone, optionPicks, startMoney, tallies } = run;
  return {
    bumpsByKind: { ...bumpsByKind },
    bumpsByZone: [...bumpsByZone],
    debuffsGot: { ...debuffsGot },
    firstZone,
    optionPicks: { ...optionPicks },
    startCents: startMoney,
    tallies: { ...tallies },
  };
}

// How many walking owners are on their last heart.
export function lastHeartOwnersOf(run: Pick<RunState, "pack">): number {
  return run.pack.filter((slot) => slot.status === "walking" && slot.hearts === 1).length;
}

// A money goal counts what the walk banked net of its starting money.
function earnedNet(facts: RunFacts): number {
  return facts.earnedCents - facts.startCents;
}

// Whether achievement is a money goal, one walk's or every walk's, which is checked only when
// the walk is banked.
export function isMoneyGoal(achievement: Pick<Achievement, "conditions">): boolean {
  return achievement.conditions.some(
    (condition) => condition.kind === "earnings" || condition.kind === "lifetimeEarnings",
  );
}

// Whether a run walked every zone up to the ones it finished: a dev start did not skip any.
export function walkedFromTheStart(counters: Pick<RunCounters, "firstZone">): boolean {
  return counters.firstZone === 0;
}

// The zones a run finished that it walked, leaving out those a dev start skipped.
function zonesWalked(facts: RunFacts): number {
  return Math.max(0, facts.zonesFinished - facts.firstZone);
}

// A plain hit landed in the current zone; a dodge or a card obstacle does not count.
export function countBump(state: RunState): RunState {
  const bumpsByZone = [...state.bumpsByZone];
  while (bumpsByZone.length <= state.zoneIndex) {
    bumpsByZone.push(0);
  }
  bumpsByZone[state.zoneIndex] = (bumpsByZone[state.zoneIndex] ?? 0) + 1;
  return { ...state, bumpsByZone };
}

// A plain hit by an obstacle of kind that landed, forgiven or not, counted in the run until it
// is banked. A dodged hit never lands.
export function countLandedBump(kind: MinorObstacleId, state: RunState): RunState {
  return {
    ...state,
    bumpsByKind: { ...state.bumpsByKind, [kind]: (state.bumpsByKind[kind] ?? 0) + 1 },
  };
}

// One more toward a lifetime tally, counted in the run until it is banked.
export function countTally(tally: TallyId, state: RunState): RunState {
  return { ...state, tallies: { ...state.tallies, [tally]: (state.tallies[tally] ?? 0) + 1 } };
}

// How many times picks counts the option with id option on encounter's card.
export function picksOf(picks: OptionPicks, encounter: EncounterId, option: string): number {
  return picks[encounter]?.[option] ?? 0;
}

// One more pick of the option with id option on encounter's card, counted in the run until it
// is banked.
export function countOptionPick(encounter: EncounterId, option: string, state: RunState): RunState {
  const picks = state.optionPicks[encounter] ?? {};
  return {
    ...state,
    optionPicks: {
      ...state.optionPicks,
      [encounter]: { ...picks, [option]: picksOf(state.optionPicks, encounter, option) + 1 },
    },
  };
}

// Whether the walk was finished: every zone of it walked, none skipped by a dev start.
function finishedWalk(facts: RunFacts, zones: number): boolean {
  return walkedFromTheStart(facts) && facts.zonesFinished >= zones;
}

// The count a threshold asks for out of all.
export function needed(all: number, threshold: Threshold): number {
  return threshold === "all" ? all : threshold;
}

function cleanZones(facts: RunFacts): number {
  let clean = 0;
  for (let zone = facts.firstZone; zone < facts.zonesFinished; zone++) {
    if ((facts.bumpsByZone[zone] ?? 0) === 0) {
      clean += 1;
    }
  }
  return clean;
}

// The landed plain hits across walks by an obstacle of any of kinds.
function landedBumps(
  stats: Pick<SaveStats, "bumpsByKind">,
  kinds: readonly MinorObstacleId[],
): number {
  return kinds.reduce((total, kind) => total + (stats.bumpsByKind[kind] ?? 0), 0);
}

// The owners who have fired you at least once. Each dog has an owner of its own.
function firedByOwners(stats: Pick<SaveStats, "dogs">): number {
  return Object.values(stats.dogs).filter((dog) => dog.timesFired > 0).length;
}

// Run conditions need the run's facts, so they never hold for a purchase (facts null); profile
// conditions need the save, so they never hold without one (save null). A condition that counts
// across walks holds once its progress is complete (acrossWalksProgress).
export function conditionHolds(
  data: AchievementData,
  save: Pick<SaveDocument, "owned" | "stats"> | null,
  facts: RunFacts | null,
  condition: AchievementCondition,
): boolean {
  const progress = save === null ? null : acrossWalksProgress(data, save, condition);
  if (progress !== null) {
    return progress.have >= progress.need;
  }
  const zones = walkLength(data);
  const dogs = Object.keys(data.dogs).length;
  const walkers = Object.keys(data.walkers).length;
  switch (condition.kind) {
    // Counted across walks: here only without a save.
    case "bumps":
    case "dogsFinishedWith":
    case "firedByOwners":
    case "lifetimeEarnings":
    case "noFiringStreak":
    case "optionPicks":
    case "tally":
    case "timesFired":
    case "walkersFinishedWith":
    case "walksFinished":
    case "walksPlayed":
    case "zonesEverFinished":
      return false;
    case "cleanZones":
      return facts !== null && cleanZones(facts) >= needed(zones, condition.count);
    case "debuffsGot":
      return facts !== null && (facts.debuffsGot[condition.debuff] ?? 0) >= condition.count;
    case "dogsOwned":
      return save !== null && save.owned.dogs.length >= needed(dogs, condition.count);
    case "earnings":
      return facts !== null && earnedNet(facts) >= dollarsToCents(condition.dollars);
    case "finishOnLastHeart":
      return facts !== null && finishedWalk(facts, zones) && facts.lastHeartOwners > 0;
    case "fullPackBonus":
      return (
        facts !== null &&
        finishedWalk(facts, zones) &&
        facts.dogsHome === facts.packSize &&
        facts.packSize >= condition.packSize
      );
    case "gearOwned":
      return (
        save !== null &&
        save.owned.gear.length >= needed(Object.keys(data.shopGear).length, condition.count)
      );
    case "packSize":
      return facts !== null && facts.packSize >= condition.count;
    case "walkersUnlocked":
      return save !== null && save.owned.walkers.length >= needed(walkers, condition.count);
    case "zonesFinished":
      return facts !== null && zonesWalked(facts) >= needed(zones, condition.count);
    default:
      return assertNever(condition);
  }
}

// How far a save has come toward a condition that counts across walks (a lifetime tally,
// option picks, landed bumps, whole dollars earned net of starting cash, walks played or
// finished, times fired, the current streak of finished walks with no firing, distinct owners
// who fired you, distinct dogs and walkers that finished a walk, distinct zones finished): have
// is capped at need. null for a condition judged on one walk or on what the save owns.
function acrossWalksProgress(
  data: Pick<GameData, "dogs" | "walkers" | "world">,
  save: Pick<SaveDocument, "stats">,
  condition: AchievementCondition,
): { readonly have: number; readonly need: number } | null {
  const progress = (have: number, need: number) => ({ have: Math.min(have, need), need });
  const dogs = Object.keys(data.dogs).length;
  const { stats } = save;
  switch (condition.kind) {
    case "bumps":
      return progress(landedBumps(stats, condition.kinds), condition.count);
    case "dogsFinishedWith":
      return progress(stats.dogsFinishedWith.length, needed(dogs, condition.count));
    case "firedByOwners":
      return progress(firedByOwners(stats), needed(dogs, condition.count));
    case "lifetimeEarnings":
      return progress(
        Math.max(0, Math.floor(lifetimeEarnedNet(stats) / dollarsToCents(1))),
        condition.dollars,
      );
    case "noFiringStreak":
      return progress(stats.noFiringStreak, condition.count);
    case "optionPicks":
      return progress(
        picksOf(stats.optionPicks, condition.encounter, condition.option),
        condition.count,
      );
    case "tally":
      return progress(stats.tallies[condition.tally] ?? 0, condition.count);
    case "timesFired":
      return progress(timesFired(stats), condition.count);
    case "walkersFinishedWith":
      return progress(
        stats.walkersFinishedWith.length,
        needed(Object.keys(data.walkers).length, condition.count),
      );
    case "walksFinished":
      return progress(walksFinished(stats), condition.count);
    case "walksPlayed":
      return progress(walksPlayed(stats), condition.count);
    case "zonesEverFinished":
      return progress(
        stats.zonesEverFinished.length,
        needed(data.world.zones.length, condition.count),
      );
    case "cleanZones":
    case "debuffsGot":
    case "dogsOwned":
    case "earnings":
    case "finishOnLastHeart":
    case "fullPackBonus":
    case "gearOwned":
    case "packSize":
    case "walkersUnlocked":
    case "zonesFinished":
      return null;
    default:
      return assertNever(condition);
  }
}

// A badge's progress toward its one condition when that condition counts across walks; null
// for a badge with any other condition, or with more than one.
export function achievementProgress(
  data: Pick<GameData, "dogs" | "walkers" | "world">,
  save: Pick<SaveDocument, "stats">,
  achievement: Pick<Achievement, "conditions">,
): { readonly have: number; readonly need: number } | null {
  const [condition, ...rest] = achievement.conditions;
  return rest.length === 0 ? acrossWalksProgress(data, save, condition) : null;
}

// The achievements a run end or a purchase earned, in wall order: those not yet earned in
// before whose every condition holds for after, with runFacts for a run (null otherwise).
export function newlyEarned(
  data: AchievementData,
  before: Pick<SaveDocument, "achievements">,
  after: Pick<SaveDocument, "owned" | "stats">,
  runFacts: RunFacts | null,
): AchievementId[] {
  return data.achievements
    .filter(
      ({ conditions, id }) =>
        !before.achievements.includes(id) &&
        conditions.every((condition) => conditionHolds(data, after, runFacts, condition)),
    )
    .map(({ id }) => id);
}

// The achievements one run earns on its own facts: those whose every condition is a run
// condition that holds. The simulator counts them.
export function earnedByRun(data: AchievementData, facts: RunFacts): AchievementId[] {
  return data.achievements
    .filter(({ conditions }) =>
      conditions.every((condition) => conditionHolds(data, null, facts, condition)),
    )
    .map(({ id }) => id);
}

// Each tally in plain words, for the data page.
const TALLY_NAMES: Readonly<Record<TallyId, string>> = {
  dodges: "dodges by any dog",
  neighboursMet: "friendly neighbours met",
  squirrelPulls: "squirrel pulls landed",
  tips: "tips grabbed",
  treats: "treats grabbed",
  walletsFound: "lost wallets found",
};

function thresholdText(threshold: Threshold, unit: string): string {
  return threshold === "all" ? `all ${unit}` : `${threshold} ${unit}`;
}

// The name of the option with id option on encounter's card. Throws for an option the card
// does not have.
function optionName(
  data: Pick<GameData, "encounters">,
  encounter: EncounterId,
  option: string,
): string {
  const { name, resolution } = data.encounters[encounter];
  const found =
    resolution.kind === "card" ? resolution.options.find(({ id }) => id === option) : undefined;
  if (found === undefined) {
    throw new Error(`${name} has no card option ${option}`);
  }
  return found.name;
}

// A condition in plain words, for the data page.
export function achievementConditionText(
  data: Pick<GameData, "debuffs" | "encounters" | "minorObstacles">,
  condition: AchievementCondition,
): string {
  switch (condition.kind) {
    case "bumps": {
      const names = condition.kinds
        .flatMap((kind) => minorObstacleNames(data, kind))
        .map((name) => name.toLowerCase());
      return `${condition.count} landed bumps in total, by any of: ${names.join(", ")}`;
    }
    case "cleanZones":
      return `${thresholdText(condition.count, "neighbourhoods")} of a walk finished without a bump`;
    case "debuffsGot":
      return `${data.debuffs[condition.debuff].name} ${condition.count} times in one walk`;
    case "dogsFinishedWith":
      return `${thresholdText(condition.count, "dogs")} each finished a walk without firing you`;
    case "dogsOwned":
      return `own ${thresholdText(condition.count, "dogs")}`;
    case "earnings":
      return `bank $${condition.dollars} in one walk, net of starting cash`;
    case "finishOnLastHeart":
      return "finish a walk with a walking owner on their last heart";
    case "firedByOwners":
      return `fired by ${thresholdText(condition.count, "owners")}, each at least once`;
    case "fullPackBonus":
      return `finish a walk with every dog of a pack of ${condition.packSize} or more home`;
    case "gearOwned":
      return `own ${thresholdText(condition.count, "gear items")}`;
    case "lifetimeEarnings":
      return `bank $${condition.dollars} in total, net of starting cash`;
    case "noFiringStreak":
      return (
        `${condition.count} finished walks in a row with no firing; ` +
        "heading home early neither counts nor breaks the streak"
      );
    case "optionPicks": {
      const { name } = data.encounters[condition.encounter];
      const option = optionName(data, condition.encounter, condition.option);
      return `${option} picked ${condition.count} times in total, on the ${name.toLowerCase()} card`;
    }
    case "packSize":
      return `start a walk with ${condition.count} dogs`;
    case "tally":
      return `${condition.count} ${TALLY_NAMES[condition.tally]} in total`;
    case "timesFired":
      return `fired ${condition.count} times in total`;
    case "walkersFinishedWith":
      return `${thresholdText(condition.count, "walkers")} each finished a walk`;
    case "walkersUnlocked":
      return `unlock ${thresholdText(condition.count, "walkers")}`;
    case "walksFinished":
      return `${condition.count} walks finished, every neighbourhood of each walked`;
    case "walksPlayed":
      return `${condition.count} walks played`;
    case "zonesEverFinished":
      return `${thresholdText(condition.count, "neighbourhoods")} each finished, across walks`;
    case "zonesFinished":
      return `${thresholdText(condition.count, "neighbourhoods")} of a walk finished`;
    default:
      return assertNever(condition);
  }
}
