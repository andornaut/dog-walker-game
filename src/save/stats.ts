import type { DogId } from "../data/types";
import { type Cents, cents } from "../lib/units";
import type { EndReason } from "../state/runState";
import type { DogStats, SaveStats } from "./schema";

// A dog's stats before its first walk.
export const ZERO_DOG_STATS: DogStats = { timesFired: 0, walks: 0, zonesFinished: 0 };

// What the Logbook shows, derived from the saved stats.
interface StatsPage {
  bestRunCents: Cents;
  // The best walk's dogs and neighbourhoods finished; none before any walk.
  bestRunDogs: readonly DogId[];
  bestRunZones: number;
  bestZoneFinished: number;
  // Every dog's walks added up: a run with 3 dogs walks 3.
  dogsWalked: number;
  lifetimeCents: Cents;
  // The dog whose owner fired you most, the first walked on a tie; null before any firing.
  mostFiredBy: DogId | null;
  runs: Readonly<Record<EndReason, number>>;
  runsPlayed: number;
  timesFired: number;
}

// Every walk played, however it ended.
export function walksPlayed(stats: Pick<SaveStats, "runs">): number {
  return stats.runs.finished + stats.runs.noDogs + stats.runs.wentHome;
}

// Every walk that finished its last zone, walked from the first: a dev start's counts as headed
// home.
export function walksFinished(stats: Pick<SaveStats, "runs">): number {
  return stats.runs.finished;
}

// What every walk earned, net of its starting cash; below 0 when card costs spent more.
export function lifetimeEarnedNet(
  stats: Pick<SaveStats, "lifetimeCents" | "lifetimeStartCents">,
): number {
  return stats.lifetimeCents - stats.lifetimeStartCents;
}

// Every firing over every walk: each dog's added up.
export function timesFired(stats: Pick<SaveStats, "dogs">): number {
  return Object.values(stats.dogs).reduce((total, dog) => total + dog.timesFired, 0);
}

// What the best walk banked: the most of any pack size, or 0 before the first walk.
export function bestWalkCents(stats: Pick<SaveStats, "bestCentsByPackSize">): Cents {
  return cents(Math.max(0, ...Object.values(stats.bestCentsByPackSize)));
}

// Every dog's walks added up: a run with 3 dogs walks 3.
function dogsWalked(stats: Pick<SaveStats, "dogs">): number {
  return Object.values(stats.dogs).reduce((total, { walks }) => total + walks, 0);
}

export function statsPage(stats: SaveStats): StatsPage {
  const dogs = Object.entries(stats.dogs) as [DogId, NonNullable<SaveStats["dogs"][DogId]>][];
  let mostFiredBy: DogId | null = null;
  let mostFirings = 0;
  for (const [dog, { timesFired: firings }] of dogs) {
    if (firings > mostFirings) {
      mostFiredBy = dog;
      mostFirings = firings;
    }
  }
  return {
    bestRunCents: bestWalkCents(stats),
    bestRunDogs: stats.bestWalk?.dogs ?? [],
    bestRunZones: stats.bestWalk?.zonesFinished ?? 0,
    bestZoneFinished: stats.bestZoneFinished,
    dogsWalked: dogsWalked(stats),
    lifetimeCents: cents(lifetimeEarnedNet(stats)),
    mostFiredBy,
    runs: stats.runs,
    runsPlayed: walksPlayed(stats),
    timesFired: timesFired(stats),
  };
}
