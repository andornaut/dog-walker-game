import { read } from "../rules/units";
import { approachOutcomes } from "../runner/approach";
import {
  hasStopped,
  hopShapes,
  type MoverPath,
  type MoverStep,
  type StepShape,
  turnedBack,
} from "../runner/movers";
import { shyOutcomes } from "../runner/shy";
import {
  movementOf,
  type RoadGeometry,
  STEP_SHAPES,
  type WalkData,
  type WalkItem,
} from "../runner/walk";

// How a bot reads a mover: by sight, only what a player sees of it, or by foresight, its whole
// planned path, every way it may yet choose its moves included.
export type BotSight = "foresight" | "sight";

export const BOT_SIGHTS: readonly BotSight[] = ["foresight", "sight"];

// The widest gap between the tilts a dart is read at before it sets off: close enough that the
// contacts of neighboring tilts overlap, so the tilts between them are covered too.
const TILT_STEP = 0.25;

// The road as a sight reading needs it: speed is the scroll speed in pixels per second.
export interface SightRoad {
  readonly data: WalkData;
  readonly geometry: Pick<RoadGeometry, "cell" | "laneCount">;
  readonly speed: number;
}

type SteppingPath = Extract<MoverPath, { motion: "approach" | "shy" | "steps" }>;

// A stepping mover's steps as seen since scroll after it spawned: those started, and the one
// whose wander mark shows, if any. An uncued step shows nothing until it starts.
function stepsSeen(
  path: SteppingPath,
  since: number,
): { readonly cued: MoverStep | undefined; readonly started: readonly MoverStep[] } {
  return {
    cued: path.steps.find(
      (step) => step.uncued !== true && since >= step.at - path.warning && since < step.at,
    ),
    started: path.steps.filter((step) => step.at <= since),
  };
}

// What a mover shows since scroll after its cue appeared, or it spawned for a stepping mover: a
// dart its cue, then its crossing, its turn back or its stop; a rider its cue, then its ride; a
// stepper the steps it has started and the wander mark of the next. Two moments that show the
// same read the same.
export function moverShows(path: MoverPath, since: number): string {
  if (path.motion === "cross") {
    if (since < path.warning) {
      return "cue";
    }
    if (turnedBack(path, since)) {
      return "turned";
    }
    return hasStopped(path, since) ? "stopped" : "crossing";
  }
  if (path.motion === "ride") {
    return since < path.warning ? "cue" : "riding";
  }
  const { cued, started } = stepsSeen(path, since);
  return `${started.length} ${cued === undefined ? "" : "cued"}`;
}

// Tilts from min to max, both ends included, at most TILT_STEP apart.
function tiltsBetween(min: number, max: number): number[] {
  const gaps = Math.ceil((max - min) / TILT_STEP - 1e-9);
  return gaps <= 0
    ? [min]
    : Array.from({ length: gaps + 1 }, (_, i) => min + ((max - min) * i) / gaps);
}

// A stepping mover's move lengths: its own for the moves started, and nominal for the rest,
// whose length shows only once they start.
function lengthsSeen(lengths: readonly number[], started: number, nominal: number): number[] {
  return lengths.map((length, i) => (i < started ? length : nominal));
}

// The paths a mover may take as a player reads it from what it shows since scroll after its cue
// appeared, or it spawned for a stepping mover (moverShows):
// - a dart, before it sets off, at its kind's speed and at tilts across its kind's range, crossing
//   once; then at its own speed and tilt, crossing once until it turns back or stops, then as it
//   does.
// - a rider at its kind's speed until it enters, then at its own.
// - a stepper, stalker or shy hopper with the steps it has started; with its wander mark showing,
//   also the next step, at its start, as each shape it may take, its kind's length long. An uncued
//   step is unknown until it starts.
// Each moment's real path is one of them until the mover shows something new.
export function sightPaths(road: SightRoad, since: number, item: WalkItem): readonly MoverPath[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  const { path } = mover;
  const { tuning } = road.data;
  const movement = movementOf(road.data, item.kind);
  if (path.motion === "cross") {
    if (since >= path.warning) {
      const turnAfter = turnedBack(path, since) ? path.turnAfter : null;
      const stopAfter = hasStopped(path, since) ? path.stopAfter : null;
      return turnAfter === path.turnAfter && stopAfter === path.stopAfter
        ? [path]
        : [{ ...path, stopAfter, turnAfter }];
    }
    const lanesPerPixel = read(tuning, "counts", "dartLanesPerSecond") / road.speed;
    const tilts =
      movement?.kind === "dart" ? tiltsBetween(movement.tilt.min, movement.tilt.max) : [path.tilt];
    return tilts.map((tilt) => ({
      ...path,
      lanesPerPixel,
      stopAfter: null,
      tilt,
      turnAfter: null,
    }));
  }
  if (path.motion === "ride") {
    return since >= path.warning || movement?.kind !== "inLane"
      ? [path]
      : [{ ...path, speedMultiplier: movement.factor }];
  }
  const { cued, started } = stepsSeen(path, since);
  const { cell, laneCount } = road.geometry;
  if (path.motion === "approach") {
    const nominal = read(tuning, "seconds", "moverStepSeconds") * road.speed;
    return approachOutcomes({
      ...path,
      lengths: lengthsSeen(path.lengths, started.length, nominal),
      pending: cued === undefined ? [] : [{ at: cued.at, kind: "after" }],
      steps: started,
    });
  }
  if (path.motion === "shy") {
    const nominal = read(tuning, "seconds", "moverHopSeconds") * road.speed;
    return shyOutcomes({
      ...path,
      lengths: lengthsSeen(path.lengths, started.length, nominal),
      pending: cued === undefined ? [] : [cued.at],
      steps: started,
    });
  }
  if (cued === undefined) {
    return started.length === path.steps.length ? [path] : [{ ...path, steps: started }];
  }
  const hop = movement?.kind === "hop";
  const shapes: readonly StepShape[] = hop
    ? hopShapes(movement.most, movement.sideways === true)
    : STEP_SHAPES;
  const length = read(tuning, "seconds", hop ? "moverHopSeconds" : "moverStepSeconds") * road.speed;
  const lane = path.lane + started.reduce((sum, step) => sum + step.lanes, 0);
  return shapes
    .filter((shape) => lane + shape.lanes >= 0 && lane + shape.lanes + item.laneSpan <= laneCount)
    .map((shape) => ({
      ...path,
      steps: [
        ...started,
        { at: cued.at, lanes: shape.lanes, length, travel: shape.travel * cell.length },
      ],
    }));
}
