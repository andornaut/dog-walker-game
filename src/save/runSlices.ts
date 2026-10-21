import type { GameData } from "../data/types";
import { runCountersOf } from "../rules/achievements";
import { walkLength } from "../rules/route";
import type { RunState } from "../state/runState";
import type { RunResult } from "./checkpoint";
import type { Checkpoint, DogRun } from "./schema";

type RunSliceData = Pick<GameData, "world">;

function zonesDone(data: RunSliceData, run: RunState): number {
  return run.phase.kind === "ended" && run.phase.reason === "finished"
    ? walkLength(data)
    : run.zoneIndex;
}

// A dog fired in a zone was paid for the zones before it; the others for every zone done.
function dogRuns(data: RunSliceData, run: RunState): DogRun[] {
  const done = zonesDone(data, run);
  return run.pack.map((slot) =>
    slot.status === "fired"
      ? { fired: true, id: slot.dog, zonesFinished: slot.zoneIndex }
      : { fired: false, id: slot.dog, zonesFinished: done },
  );
}

// The run so far, for the save after a zone's pay is banked (finishZone has moved zoneIndex on
// to the next zone, whose fork is not yet taken) or as the tab hides mid-zone, which counts only
// the zones before it.
export function checkpointOf(data: RunSliceData, run: RunState): Checkpoint {
  return {
    counters: runCountersOf(run),
    dogs: dogRuns(data, run),
    earnedCents: run.money,
    route: [...run.route],
    zonesFinished: zonesDone(data, run),
  };
}

// A run that has ended, for finishRun. A run that has not ended counts as heading home.
export function runResultOf(data: RunSliceData, run: RunState): RunResult {
  const outcome = run.phase.kind === "ended" ? run.phase.reason : "wentHome";
  return {
    counters: runCountersOf(run),
    dogs: dogRuns(data, run),
    earnedCents: run.money,
    outcome,
    route: [...run.route],
    zone: outcome === "finished" ? walkLength(data) : run.zoneIndex + 1,
  };
}
