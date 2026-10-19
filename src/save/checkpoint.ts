import type { DogId } from "../data/types";
import { addCents, type Cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import type { Checkpoint, DogRun, DogStats, LastWalk, SaveDocument, SaveStats } from "./schema";

// A finished run. earnedCents is what the run banks, after clawbacks. zone is the zone in
// progress when the run ended, counting from 1; between zones it is the next one. A
// finished run ends in its last zone.
export interface RunResult {
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

interface BankedRun {
  dogs: DogRun[];
  earnedCents: Cents;
  outcome: EndReason;
  zonesFinished: number;
}

// Banks the earnings, counts the outcome and updates every stat and the logbook. Clears the
// checkpoint, since the run it belonged to is now banked.
function bankRun(run: BankedRun, save: SaveDocument): SaveDocument {
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
  const firings = run.dogs.filter((dog) => dog.fired).length;
  const { earnedCents, outcome, zonesFinished } = run;
  const walkDogs = run.dogs.map(({ id }) => id);
  const lastWalk: LastWalk = { dogs: walkDogs, earnedCents, outcome, zonesFinished };
  return {
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
      lastWalk,
      lifetimeCents: addCents(stats.lifetimeCents, earnedCents),
      runs: { ...stats.runs, [outcome]: stats.runs[outcome] + 1 },
      timesFired: stats.timesFired + firings,
    },
  };
}

export function recordCheckpoint(save: SaveDocument, slice: Checkpoint): SaveDocument {
  return { ...save, checkpoint: slice };
}

// Banks an unfinished run as if the player had headed home after the checkpoint's zone.
export function bankCheckpoint(save: SaveDocument): SaveDocument {
  const { checkpoint } = save;
  if (checkpoint === null) {
    return save;
  }
  return bankRun(
    {
      dogs: checkpoint.dogs,
      earnedCents: checkpoint.earnedCents,
      outcome: "wentHome",
      zonesFinished: checkpoint.zonesFinished,
    },
    save,
  );
}

// Banks a run that ended.
export function recordRunEnd(save: SaveDocument, result: RunResult): SaveDocument {
  return bankRun(
    {
      dogs: result.dogs,
      earnedCents: result.earnedCents,
      outcome: result.outcome,
      zonesFinished: zonesFinishedBy(result),
    },
    save,
  );
}
