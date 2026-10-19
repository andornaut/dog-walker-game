import type {
  AchievementCondition,
  AchievementId,
  CardOption,
  DebuffId,
  GameData,
  Threshold,
} from "../data/types";
import type { SaveDocument } from "../save/schema";
import type { RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { walkLength } from "./route";
import { type Cents, dollarsToCents } from "./units";

export type AchievementData = Pick<
  GameData,
  "achievements" | "debuffs" | "dogSlots" | "dogs" | "shopGear" | "world"
>;

// The counters a run keeps for its achievements, copied out of the run state for the save.
// Zones before firstZone were skipped by a dev start: they are neither finished nor clean.
export interface RunCounters {
  bumpsByZone: number[];
  debuffZones: Partial<Record<DebuffId, number>>;
  firstZone: number;
  squirrelChases: number;
}

// What the run conditions judge: the run's counters, what it banked, how many dogs set out
// and how many zones it finished.
export interface RunFacts extends RunCounters {
  readonly earnedCents: Cents;
  readonly packSize: number;
  readonly zonesFinished: number;
}

export function runCountersOf(
  run: Pick<RunState, "bumpsByZone" | "debuffZones" | "firstZone" | "squirrelChases">,
): RunCounters {
  const { bumpsByZone, debuffZones, firstZone, squirrelChases } = run;
  return {
    bumpsByZone: [...bumpsByZone],
    debuffZones: { ...debuffZones },
    firstZone,
    squirrelChases,
  };
}

// Whether a run walked every zone up to the ones it finished: a dev start did not skip any.
export function walkedFromTheStart(counters: Pick<RunCounters, "firstZone">): boolean {
  return counters.firstZone === 0;
}

// The zones a run finished that it walked, leaving out those a dev start skipped.
function zonesWalked(facts: RunFacts): number {
  return Math.max(0, facts.zonesFinished - facts.firstZone);
}

// The pack hit an obstacle, minor or not, in the current zone.
export function countBump(state: RunState): RunState {
  const bumpsByZone = [...state.bumpsByZone];
  while (bumpsByZone.length <= state.zoneIndex) {
    bumpsByZone.push(0);
  }
  bumpsByZone[state.zoneIndex] = (bumpsByZone[state.zoneIndex] ?? 0) + 1;
  return { ...state, bumpsByZone };
}

// At the end of a zone, before its effects expire: each debuff on counts the zone.
export function countDebuffZones(state: RunState): RunState {
  const debuffZones: Partial<Record<DebuffId, number>> = { ...state.debuffZones };
  for (const { debuff } of state.debuffs) {
    debuffZones[debuff] = (debuffZones[debuff] ?? 0) + 1;
  }
  return { ...state, debuffZones };
}

// A card option that lets the chasers chase counts one squirrel chase.
export function countChase(option: Pick<CardOption, "chase">, state: RunState): RunState {
  return option.chase === true ? { ...state, squirrelChases: state.squirrelChases + 1 } : state;
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
  switch (condition.kind) {
    case "cleanZones":
      return facts !== null && cleanZones(facts) >= needed(zones, condition.count);
    case "debuffZones":
      return facts !== null && (facts.debuffZones[condition.debuff] ?? 0) >= condition.count;
    case "dogSlotsOwned":
      return save !== null && save.owned.dogSlots >= needed(data.dogSlots.length, condition.count);
    case "dogsFinishedWith":
      return save !== null && save.stats.dogsFinishedWith.length >= needed(dogs, condition.count);
    case "dogsOwned":
      return save !== null && save.owned.dogs.length >= needed(dogs, condition.count);
    case "earnings":
      return facts !== null && facts.earnedCents >= dollarsToCents(condition.dollars);
    case "gearOwned":
      return (
        save !== null &&
        save.owned.gear.length >= needed(Object.keys(data.shopGear).length, condition.count)
      );
    case "packSize":
      return facts !== null && facts.packSize >= condition.count;
    case "squirrelsChased":
      return save !== null && save.stats.squirrelsChased >= condition.count;
    case "timesFired":
      return save !== null && save.stats.timesFired >= condition.count;
    case "walksWithoutFiring":
      return save !== null && save.stats.walksWithoutFiring >= condition.count;
    case "zonesFinished":
      return facts !== null && zonesWalked(facts) >= needed(zones, condition.count);
    default:
      return assertNever(condition);
  }
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

function thresholdText(threshold: Threshold, unit: string): string {
  return threshold === "all" ? `all ${unit}` : `${threshold} ${unit}`;
}

// A condition in plain words, for the data page.
export function achievementConditionText(
  data: Pick<GameData, "debuffs">,
  condition: AchievementCondition,
): string {
  switch (condition.kind) {
    case "cleanZones":
      return `${thresholdText(condition.count, "zones")} of a run finished without a bump`;
    case "debuffZones":
      return `${condition.count} zones of a run ended ${data.debuffs[condition.debuff].name}`;
    case "dogSlotsOwned":
      return `own ${thresholdText(condition.count, "dog slots")}`;
    case "dogsFinishedWith":
      return `${thresholdText(condition.count, "dogs")} each finished a walk without firing you`;
    case "dogsOwned":
      return `own ${thresholdText(condition.count, "dogs")}`;
    case "earnings":
      return `bank $${condition.dollars} in one run`;
    case "gearOwned":
      return `own ${thresholdText(condition.count, "gear items")}`;
    case "packSize":
      return `start a run with ${condition.count} dogs`;
    case "squirrelsChased":
      return `${condition.count} squirrel chases in total`;
    case "timesFired":
      return `fired ${condition.count} times in total`;
    case "walksWithoutFiring":
      return `${condition.count} finished walks with no firing`;
    case "zonesFinished":
      return `${thresholdText(condition.count, "zones")} of a run finished`;
    default:
      return assertNever(condition);
  }
}
