import type {
  Achievement,
  AchievementCondition,
  AchievementId,
  CardOption,
  DebuffId,
  GameData,
  MinorObstacleId,
  TallyId,
  Threshold,
} from "../data/types";
import { assertNever } from "../lib/assertNever";
import type { SaveDocument, SaveStats } from "../save/schema";
import { walksPlayed } from "../save/stats";
import type { RunState } from "../state/runState";
import { walkLength } from "./route";
import { type Cents, dollarsToCents } from "./units";

export type AchievementData = Pick<
  GameData,
  "achievements" | "debuffs" | "dogSlots" | "dogs" | "encounters" | "shopGear" | "walkers" | "world"
>;

// The counters a run keeps for its achievements, copied out of the run state for the save.
// Zones before firstZone were skipped by a dev start: they are neither finished nor clean.
// lastHeartOwners is how many walking owners are on their last heart. startCents is the money
// the run began with, which a money goal leaves out. bumpsByKind and tallies are this run's
// share of the lifetime ones.
export interface RunCounters {
  bumpsByKind: Partial<Record<MinorObstacleId, number>>;
  bumpsByZone: number[];
  debuffsGot: Partial<Record<DebuffId, number>>;
  firstZone: number;
  lastHeartOwners: number;
  startCents: Cents;
  tallies: Partial<Record<TallyId, number>>;
}

// What the run conditions judge: the run's counters, what it banked (starting money
// included), how many dogs set out and got home unfired, and how many zones it finished.
export interface RunFacts extends RunCounters {
  readonly dogsHome: number;
  readonly earnedCents: Cents;
  readonly packSize: number;
  readonly zonesFinished: number;
}

export function runCountersOf(
  run: Pick<
    RunState,
    "bumpsByKind" | "bumpsByZone" | "debuffsGot" | "firstZone" | "pack" | "startMoney" | "tallies"
  >,
): RunCounters {
  const { bumpsByKind, bumpsByZone, debuffsGot, firstZone, pack, startMoney, tallies } = run;
  return {
    bumpsByKind: { ...bumpsByKind },
    bumpsByZone: [...bumpsByZone],
    debuffsGot: { ...debuffsGot },
    firstZone,
    lastHeartOwners: pack.filter((slot) => slot.status === "walking" && slot.hearts === 1).length,
    startCents: startMoney,
    tallies: { ...tallies },
  };
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

// A plain hit by an obstacle of kind that cost its owner a heart, so neither dodged nor
// forgiven, counted in the run until it is banked.
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

// A card option that names a tally counts one toward it.
export function countOptionTally(option: Pick<CardOption, "tally">, state: RunState): RunState {
  return option.tally === undefined ? state : countTally(option.tally, state);
}

// Whether the walk was finished: every zone of it walked, none skipped by a dev start.
function finishedWalk(facts: RunFacts, zones: number): boolean {
  return walkedFromTheStart(facts) && facts.zonesFinished >= zones;
}

function needed(all: number, threshold: Threshold): number {
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

// Each lucky find in the data, by the tally finding it counts toward.
export function luckyFindTallies(data: Pick<GameData, "encounters">): TallyId[] {
  return Object.values(data.encounters).flatMap((encounter) =>
    encounter.kind === "lucky" ? [encounter.resolution.tally] : [],
  );
}

// The distinct lucky finds a run found.
function luckyFinds(data: Pick<GameData, "encounters">, facts: RunFacts): number {
  return luckyFindTallies(data).filter((tally) => (facts.tallies[tally] ?? 0) > 0).length;
}

// Run conditions need the run's facts, so they never hold for a purchase (facts null); profile
// conditions need the save, so they never hold without one (save null).
export function conditionHolds(
  data: AchievementData,
  save: Pick<SaveDocument, "owned" | "stats"> | null,
  facts: RunFacts | null,
  condition: AchievementCondition,
): boolean {
  const zones = walkLength(data);
  const dogs = Object.keys(data.dogs).length;
  const walkers = Object.keys(data.walkers).length;
  switch (condition.kind) {
    case "bumps":
      return save !== null && landedBumps(save.stats, condition.kinds) >= condition.count;
    case "cleanZones":
      return facts !== null && cleanZones(facts) >= needed(zones, condition.count);
    case "debuffsGot":
      return facts !== null && (facts.debuffsGot[condition.debuff] ?? 0) >= condition.count;
    case "dogSlotsOwned":
      return save !== null && save.owned.dogSlots >= needed(data.dogSlots.length, condition.count);
    case "dogsFinishedWith":
      return save !== null && save.stats.dogsFinishedWith.length >= needed(dogs, condition.count);
    case "dogsOwned":
      return save !== null && save.owned.dogs.length >= needed(dogs, condition.count);
    case "earnings":
      return facts !== null && earnedNet(facts) >= dollarsToCents(condition.dollars);
    case "finishOnLastHeart":
      return facts !== null && finishedWalk(facts, zones) && facts.lastHeartOwners > 0;
    case "firedByOwners":
      return save !== null && firedByOwners(save.stats) >= needed(dogs, condition.count);
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
    case "lifetimeEarnings":
      return save !== null && save.stats.lifetimeCents >= dollarsToCents(condition.dollars);
    case "luckyFinds":
      return (
        facts !== null &&
        luckyFinds(data, facts) >= needed(luckyFindTallies(data).length, condition.count)
      );
    case "packSize":
      return facts !== null && facts.packSize >= condition.count;
    case "tally":
      return save !== null && (save.stats.tallies[condition.tally] ?? 0) >= condition.count;
    case "timesFired":
      return save !== null && save.stats.timesFired >= condition.count;
    case "walkersFinishedWith":
      return (
        save !== null && save.stats.walkersFinishedWith.length >= needed(walkers, condition.count)
      );
    case "walkersUnlocked":
      return save !== null && save.owned.walkers.length >= needed(walkers, condition.count);
    case "walksPlayed":
      return save !== null && walksPlayed(save.stats) >= condition.count;
    case "walksWithoutFiring":
      return save !== null && save.stats.walksWithoutFiring >= condition.count;
    case "zonesEverFinished":
      return (
        save !== null &&
        save.stats.zonesEverFinished.length >= needed(data.world.zones.length, condition.count)
      );
    case "zonesFinished":
      return facts !== null && zonesWalked(facts) >= needed(zones, condition.count);
    default:
      return assertNever(condition);
  }
}

// How far a save has come toward a condition that counts across walks (a lifetime tally,
// landed bumps, whole dollars banked, walks played, times fired, finished walks with no firing,
// distinct owners who fired you, distinct dogs and walkers that finished a walk, distinct zones
// finished): have is capped at need. null for a condition judged on one walk or on what the save
// owns.
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
      return progress(Math.floor(stats.lifetimeCents / dollarsToCents(1)), condition.dollars);
    case "tally":
      return progress(stats.tallies[condition.tally] ?? 0, condition.count);
    case "timesFired":
      return progress(stats.timesFired, condition.count);
    case "walkersFinishedWith":
      return progress(
        stats.walkersFinishedWith.length,
        needed(Object.keys(data.walkers).length, condition.count),
      );
    case "walksPlayed":
      return progress(walksPlayed(stats), condition.count);
    case "walksWithoutFiring":
      return progress(stats.walksWithoutFiring, condition.count);
    case "zonesEverFinished":
      return progress(
        stats.zonesEverFinished.length,
        needed(data.world.zones.length, condition.count),
      );
    case "cleanZones":
    case "debuffsGot":
    case "dogSlotsOwned":
    case "dogsOwned":
    case "earnings":
    case "finishOnLastHeart":
    case "fullPackBonus":
    case "gearOwned":
    case "luckyFinds":
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
        before.achievements[id] === undefined &&
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
  dodges: "small dog dodges",
  neighborsMet: "friendly neighbors met",
  sniffs: "other dogs let sniff",
  squirrelPulls: "squirrel pulls landed",
  thievesLetGo: "thieves let go",
  tips: "tips grabbed",
  treats: "treats grabbed",
  walletsFound: "lost wallets found",
};

function thresholdText(threshold: Threshold, unit: string): string {
  return threshold === "all" ? `all ${unit}` : `${threshold} ${unit}`;
}

// A condition in plain words, for the data page.
export function achievementConditionText(
  data: Pick<GameData, "debuffs" | "minorObstacles">,
  condition: AchievementCondition,
): string {
  switch (condition.kind) {
    case "bumps": {
      const names = condition.kinds.map((kind) => data.minorObstacles[kind].name.toLowerCase());
      return `${condition.count} landed bumps in total, by any of: ${names.join(", ")}`;
    }
    case "cleanZones":
      return `${thresholdText(condition.count, "neighborhoods")} of a walk finished without a bump`;
    case "debuffsGot":
      return `${data.debuffs[condition.debuff].name} ${condition.count} times in one walk`;
    case "dogSlotsOwned":
      return `own ${thresholdText(condition.count, "dog slots")}`;
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
      return `bank $${condition.dollars} in total`;
    case "luckyFinds":
      return `${thresholdText(condition.count, "lucky finds")} each found in one walk`;
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
    case "walksPlayed":
      return `${condition.count} walks played`;
    case "walksWithoutFiring":
      return `${condition.count} finished walks with no firing`;
    case "zonesEverFinished":
      return `${thresholdText(condition.count, "neighborhoods")} each finished, across walks`;
    case "zonesFinished":
      return `${thresholdText(condition.count, "neighborhoods")} of a walk finished`;
    default:
      return assertNever(condition);
  }
}
