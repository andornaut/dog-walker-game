import type { DogId } from "../data/types";
import { type RunCounters, type RunFacts, walkedFromTheStart } from "../rules/achievements";
import { addCents, type Cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import { awardAchievements, type AwardContext } from "./achievements";
import type { Checkpoint, DogRun, DogStats, LastWalk, SaveDocument, SaveStats } from "./schema";

// A finished run. earnedCents is what the run banks, after clawbacks. zone is the zone in
// progress when the run ended, counting from 1; between zones it is the next one. A
// finished run ends in its last zone.
export interface RunResult {
  counters: RunCounters;
  dogs: DogRun[];
  earnedCents: Cents;
  outcome: EndReason;
  zone: number;
}

// Only finished zones count: heading home or running out of dogs in zone 3 finishes 2.
export function zonesFinishedBy(result: Pick<RunResult, "outcome" | "zone">): number {
  return result.outcome === "finished" ? result.zone : result.zone - 1;
}

const zeroDogStats: DogStats = { timesFired: 0, walks: 0, zonesFinished: 0 };

// Whether a run banking earnedCents would be the best walk yet; the end screen flags it.
export function isNewBestWalk(stats: Pick<SaveStats, "bestWalk">, earnedCents: Cents): boolean {
  return stats.bestWalk === null || earnedCents > stats.bestWalk.earnedCents;
}

// counters is null for a checkpoint saved before achievements.
interface BankedRun {
  counters: RunCounters | null;
  dogs: DogRun[];
  earnedCents: Cents;
  outcome: EndReason;
  zonesFinished: number;
}

// Banks the earnings, counts the outcome and updates every stat and the logbook. Clears the
// checkpoint, since the run it belonged to is now banked. Then awards what the run earned.
function bankRun(context: AwardContext, run: BankedRun, save: SaveDocument): SaveDocument {
  const { stats } = save;
  const dogs: Partial<Record<DogId, DogStats>> = { ...stats.dogs };
  for (const { fired, id, zonesFinished } of run.dogs) {
    const current = dogs[id] ?? zeroDogStats;
    dogs[id] = {
      timesFired: current.timesFired + (fired ? 1 : 0),
      walks: current.walks + 1,
      zonesFinished: current.zonesFinished + zonesFinished,
    };
  }

  const { earnedCents, outcome, zonesFinished } = run;
  const walkDogs = run.dogs.map(({ id }) => id);
  // A dog fired in a zone was paid for the zones before it.
  const firedBy = run.dogs.flatMap(({ fired, id, zonesFinished: paid }) =>
    fired ? [{ dog: id, zone: paid + 1 }] : [],
  );
  const lastWalk: LastWalk = {
    dogs: walkDogs,
    earnedCents,
    firings: firedBy,
    outcome,
    zonesFinished,
  };
  // A walk counts as finished for the totals only when a dev start skipped no zone.
  const finished =
    outcome === "finished" && (run.counters === null || walkedFromTheStart(run.counters));
  const stayed = run.dogs.flatMap(({ fired, id }) => (fired ? [] : [id]));
  const banked: SaveDocument = {
    ...save,
    bankCents: addCents(save.bankCents, earnedCents),
    checkpoint: null,
    stats: {
      ...stats,
      bestWalk: isNewBestWalk(stats, earnedCents)
        ? { dogs: walkDogs, earnedCents, zonesFinished }
        : stats.bestWalk,
      bestZoneFinished: Math.max(stats.bestZoneFinished, zonesFinished),
      dogs,
      dogsFinishedWith: finished
        ? [...new Set([...stats.dogsFinishedWith, ...stayed])]
        : stats.dogsFinishedWith,
      lastWalk,
      lifetimeCents: addCents(stats.lifetimeCents, earnedCents),
      runs: { ...stats.runs, [outcome]: stats.runs[outcome] + 1 },
      squirrelsChased: stats.squirrelsChased + (run.counters?.squirrelChases ?? 0),
      timesFired: stats.timesFired + firedBy.length,
      walksWithoutFiring: stats.walksWithoutFiring + (finished && firedBy.length === 0 ? 1 : 0),
    },
  };
  const facts: RunFacts | null =
    run.counters === null
      ? null
      : { ...run.counters, earnedCents, packSize: run.dogs.length, zonesFinished };
  return awardAchievements(context, facts, save, banked);
}

export function recordCheckpoint(save: SaveDocument, slice: Checkpoint): SaveDocument {
  return { ...save, checkpoint: slice };
}

// Banks an unfinished run as if the player had headed home after the checkpoint's zone.
export function bankCheckpoint(context: AwardContext, save: SaveDocument): SaveDocument {
  const { checkpoint } = save;
  if (checkpoint === null) {
    return save;
  }
  return bankRun(
    context,
    {
      counters: checkpoint.counters,
      dogs: checkpoint.dogs,
      earnedCents: checkpoint.earnedCents,
      outcome: "wentHome",
      zonesFinished: checkpoint.zonesFinished,
    },
    save,
  );
}

// Banks a run that ended.
export function recordRunEnd(
  context: AwardContext,
  save: SaveDocument,
  result: RunResult,
): SaveDocument {
  return bankRun(
    context,
    {
      counters: result.counters,
      dogs: result.dogs,
      earnedCents: result.earnedCents,
      outcome: result.outcome,
      zonesFinished: zonesFinishedBy(result),
    },
    save,
  );
}
