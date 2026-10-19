import type { DogId } from "../data/types";
import { addCents, type Cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import type { Checkpoint, DogStats, SaveDocument } from "./schema";

// A finished run in the checkpoint's shape. earnedCents is what the run banks, after
// clawbacks; zoneReached is the zone the run was in when it ended.
export interface RunResult extends Checkpoint {
  outcome: EndReason;
}

const zeroDogStats: DogStats = { timesFired: 0, walks: 0, zonesFinished: 0 };

function maxCents(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

// Banks the earnings, counts the outcome and updates every stat. Clears the checkpoint,
// since the run it belonged to is now banked.
function bankRun(run: RunResult, save: SaveDocument): SaveDocument {
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
  return {
    ...save,
    bankCents: addCents(save.bankCents, run.earnedCents),
    checkpoint: null,
    stats: {
      ...stats,
      bestRunCents: maxCents(stats.bestRunCents, run.earnedCents),
      bestZoneReached: Math.max(stats.bestZoneReached, run.zoneReached),
      dogs,
      lifetimeCents: addCents(stats.lifetimeCents, run.earnedCents),
      runs: { ...stats.runs, [run.outcome]: stats.runs[run.outcome] + 1 },
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
  return bankRun({ ...checkpoint, outcome: "wentHome" }, save);
}

export function recordRunEnd(save: SaveDocument, result: RunResult): SaveDocument {
  return bankRun(result, save);
}
