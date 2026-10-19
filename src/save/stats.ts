import type { DogId } from "../data/types";
import { type Cents, cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import type { SaveStats } from "./schema";

// What the logbook's Stats page shows, derived from the saved stats.
export interface StatsPage {
  bestRunCents: Cents;
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

// Every dog's walks added up: a run with 3 dogs walks 3.
export function dogsWalked(stats: Pick<SaveStats, "dogs">): number {
  return Object.values(stats.dogs).reduce((total, { walks }) => total + walks, 0);
}

export function statsPage(stats: SaveStats): StatsPage {
  const dogs = Object.entries(stats.dogs) as [DogId, NonNullable<SaveStats["dogs"][DogId]>][];
  let mostFiredBy: DogId | null = null;
  let mostFirings = 0;
  for (const [dog, { timesFired }] of dogs) {
    if (timesFired > mostFirings) {
      mostFiredBy = dog;
      mostFirings = timesFired;
    }
  }
  return {
    bestRunCents: stats.bestWalk?.earnedCents ?? cents(0),
    bestZoneFinished: stats.bestZoneFinished,
    dogsWalked: dogsWalked(stats),
    lifetimeCents: stats.lifetimeCents,
    mostFiredBy,
    runs: stats.runs,
    runsPlayed: walksPlayed(stats),
    timesFired: stats.timesFired,
  };
}
