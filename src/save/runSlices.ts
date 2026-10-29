import type { GameData } from "../data/types";
import { lastHeartOwnersOf, runCountersOf } from "../rules/achievements";
import { walkLength } from "../rules/route";
import { endReasonOf, walkEarnings } from "../rules/run";
import type { RunState } from "../state/runState";
import type { RunResult } from "./checkpoint";
import type { Checkpoint, DogRun } from "./schema";

type RunSliceData = Pick<GameData, "world">;

function zonesDone(data: RunSliceData, run: RunState): number {
  return run.phase.kind === "ended" && run.phase.reason === "finished"
    ? walkLength(data)
    : run.zoneIndex;
}

// Each dog, with the zone its owner fired you in, counting from 1.
function dogRuns(run: RunState): DogRun[] {
  return run.pack.map((slot) => ({
    firedInZone: slot.status === "fired" ? slot.zoneIndex + 1 : null,
    id: slot.dog,
  }));
}

// The run so far, for the save after a zone's pay is banked (finishZone has moved zoneIndex on
// to the next zone, whose fork is not yet taken) or as the tab hides mid-zone, which counts only
// the zones before it and banks as heading home.
export function checkpointOf(data: RunSliceData, run: RunState): Checkpoint {
  return {
    counters: runCountersOf(run),
    dogs: dogRuns(run),
    earnedCents: walkEarnings(endReasonOf(run), run).banked,
    route: [...run.route],
    zonesFinished: zonesDone(data, run),
  };
}

// A run that has ended, for finishRun. A run that has not ended counts as heading home.
export function runResultOf(data: RunSliceData, run: RunState): RunResult {
  const outcome = endReasonOf(run);
  const { banked, lost } = walkEarnings(outcome, run);
  return {
    counters: runCountersOf(run),
    dogs: dogRuns(run),
    earnedCents: banked,
    lastHeartOwners: lastHeartOwnersOf(run),
    lostCents: lost,
    outcome,
    route: [...run.route],
    walker: run.walker,
    zone: outcome === "finished" ? walkLength(data) : run.zoneIndex + 1,
  };
}
