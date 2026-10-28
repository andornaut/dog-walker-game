import type { RoadPoint } from "./collision";
import {
  type MoverPath,
  SIDESTEPS,
  staysInReach,
  type StepShape,
  stepsTaken,
  takeMove,
} from "./movers";

// A stalker steps toward the pack while it is still ahead of it. Its first step is chosen as its
// cue begins; a later step has no cue of its own and is chosen as it starts. Each is chosen from
// where the pack is then: of the spots a step away, a lane to either side, a row down or diagonally
// down, the one nearest the pack, within the lanes and rows the planner left it; the first of them
// in APPROACH_STEPS on a tie. Never a row up. A step that would start once the stalker has reached
// the pack's rows, and every step after it, is dropped instead.

export type ApproachPath = Extract<MoverPath, { motion: "approach" }>;

// The steps a stalker may take, in the order a tie goes.
const APPROACH_STEPS: readonly StepShape[] = [
  { lanes: 0, travel: 1 },
  { lanes: -1, travel: 1 },
  { lanes: 1, travel: 1 },
  ...SIDESTEPS,
];

// The scroll since it spawned at which its next pending step starts, or null with none.
export function nextStepAt(path: ApproachPath): number | null {
  const [next] = path.pending;
  if (next === undefined) {
    return null;
  }
  if (next.kind === "after") {
    return next.at;
  }
  const last = path.steps.at(-1);
  const soonest = last === undefined ? 0 : last.at + last.length;
  return Math.max(next.travel - stepsTaken(path).rows * path.burst, soonest);
}

// The scroll since it spawned at which its next pending step is chosen: as the step's cue
// begins, or, for a step with no cue, as it starts. null with none.
export function nextChoiceAt(path: ApproachPath): number | null {
  const at = nextStepAt(path);
  return at === null || path.pending[0]?.kind === "near" ? at : at - path.warning;
}

// The steps it may take next: those that keep it within its lanes and rows. None once its next
// step would start at or past its stop travel, or with no step pending.
export function approachChoices(path: ApproachPath): StepShape[] {
  const at = nextStepAt(path);
  const { lanes, rows } = stepsTaken(path);
  if (at === null || at + rows * path.burst >= path.stopTravel) {
    return [];
  }
  const lane = path.lane + lanes;
  return APPROACH_STEPS.filter(
    (shape) => staysInReach(path.reach, lane, shape) && rows + shape.travel <= path.rows,
  );
}

// The path with its next pending step taken as shape, or, with no shape, with every pending step
// dropped: one it cannot take leaves it nowhere to step later either.
export function takeStep(path: ApproachPath, shape: StepShape | null): ApproachPath {
  const at = nextStepAt(path);
  if (at === null) {
    return path;
  }
  if (shape === null) {
    return { ...path, pending: [] };
  }
  return takeMove(at, path.pending[0]?.kind === "near", shape, path);
}

// The step that brings it nearest the pack: centre is the stalker's centre now, and the step
// moves it a cell per lane across and burst per row down.
export function nearestStep(
  cellLength: number,
  burst: number,
  centre: RoadPoint,
  pack: RoadPoint,
  choices: readonly StepShape[],
): StepShape | null {
  let best: { readonly distance: number; readonly shape: StepShape } | null = null;
  for (const shape of choices) {
    const dx = centre.x + shape.lanes * cellLength - pack.x;
    const dy = centre.y + shape.travel * burst - pack.y;
    const distance = dx * dx + dy * dy;
    if (best === null || distance < best.distance) {
      best = { distance, shape };
    }
  }
  return best?.shape ?? null;
}

// Every path the stalker may yet take, whatever the pack does: each choice of each pending step.
export function approachOutcomes(path: ApproachPath): ApproachPath[] {
  if (path.pending.length === 0) {
    return [path];
  }
  const choices = approachChoices(path);
  return choices.length === 0
    ? approachOutcomes(takeStep(path, null))
    : choices.flatMap((shape) => approachOutcomes(takeStep(path, shape)));
}
