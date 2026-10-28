import type { Movement } from "../data/types";
import { read } from "../rules/units";
import { approachOutcomes } from "../runner/approach";
import {
  cuedStep,
  hasStopped,
  hopShapes,
  isSliding,
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
// contacts of neighbouring tilts overlap, so the tilts between them are covered too.
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
  return { cued: cuedStep(path, since), started: path.steps.filter((step) => step.at <= since) };
}

// What a mover shows since scroll after its cue appeared, or it spawned for a stepping mover: a
// dart its wait at its edge, its cue, then its crossing, its turn back or its stop; a rider its cue, then its ride; a
// stepper the steps it has started and the wander mark of the next. Two moments that show the
// same read the same.
export function moverShows(path: MoverPath, since: number): string {
  if (path.motion === "cross") {
    if (since < path.idle) {
      return "idle";
    }
    if (since < path.warning) {
      return "cue";
    }
    if (turnedBack(path, since)) {
      return "turned";
    }
    if (isSliding(path, since)) {
      return "sliding";
    }
    return hasStopped(path, since) ? "stopped" : "crossing";
  }
  if (path.motion === "ride") {
    if (since < path.warning) {
      return "cue";
    }
    const { merge } = path;
    return merge !== undefined && since >= merge.at - merge.cue ? "merge" : "riding";
  }
  const { cued, started } = stepsSeen(path, since);
  return `${started.length} ${cued === undefined ? "" : "cued"}`;
}

// The scroll a dart waiting at its edge is read as waiting for: longer than any road.
const WAITING = 1e6;

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
// - a dart or a dive, before it sets off, at its kind's speed and at tilts across its kind's range,
//   crossing once, and while it waits at its edge, as waiting there until it has left the road;
//   then at its own speed and tilt, crossing once until it turns back, stops or lands and slides,
//   then as it does.
// - a rider at its kind's speed until it enters, then at its own, in its lane until the cue of
//   its merge, if it has one, shows the way it will merge.
// - a stepper, stalker or shy hopper with the steps it has started; with its wander mark showing,
//   also the next step, at its start, as each shape it may take (nextShapes), its kind's length
//   long. An uncued step is unknown until it starts.
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
      const stopAfter = hasStopped(path, since) || isSliding(path, since) ? path.stopAfter : null;
      return turnAfter === path.turnAfter && stopAfter === path.stopAfter
        ? [path]
        : [{ ...path, stopAfter, turnAfter }];
    }
    const speed = movement?.kind === "dive" ? movement.speed : 1;
    const lanesPerPixel = (read(tuning, "counts", "dartLanesPerSecond") * speed) / road.speed;
    const tilts =
      movement?.kind === "dart" || movement?.kind === "dive"
        ? tiltsBetween(movement.tilt.min, movement.tilt.max)
        : [path.tilt];
    // Waiting at its edge, it is read as waiting there until it has left the road: it shows
    // nothing of when its cue will begin.
    if (since < path.idle) {
      const wait = since + WAITING;
      return [
        {
          ...path,
          enterTravel: path.enterTravel - path.warning + wait,
          idle: wait,
          lanesPerPixel,
          stopAfter: null,
          tilt: 0,
          turnAfter: null,
          warning: wait,
        },
      ];
    }
    return tilts.map((tilt) => ({
      ...path,
      lanesPerPixel,
      stopAfter: null,
      tilt,
      turnAfter: null,
    }));
  }
  if (path.motion === "ride") {
    const { merge, ...lane } = path;
    const seen = merge !== undefined && since < merge.at - merge.cue ? lane : path;
    return since >= path.warning || (movement?.kind !== "inLane" && movement?.kind !== "merge")
      ? [seen]
      : [{ ...seen, speedMultiplier: movement.factor }];
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
  const { length, shapes } = nextShapes(road, movement, started);
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

const SIDEWAYS: readonly StepShape[] = [
  { lanes: -1, travel: 0 },
  { lanes: 1, travel: 0 },
];

// The shapes a stepping mover's cued step may take, as a player who knows its kind reads it after
// the steps started, and the step's length at its kind's: a hopper's hops; a bounce's and a sway's
// way back from its last step sideways, or either way before one; a follower's either way; a
// stop-and-go's push, its travel in cells; and a stepper's steps.
function nextShapes(
  road: SightRoad,
  movement: Movement | null,
  started: readonly MoverStep[],
): { readonly length: number; readonly shapes: readonly StepShape[] } {
  const { tuning } = road.data;
  const seconds = (key: "moverHopSeconds" | "moverStepSeconds") =>
    read(tuning, "seconds", key) * road.speed;
  const last = started.filter((step) => step.lanes !== 0).at(-1)?.lanes;
  const back: readonly StepShape[] =
    last === undefined ? SIDEWAYS : [{ lanes: -Math.sign(last), travel: 0 }];
  switch (movement?.kind) {
    case "bounce":
      return { length: seconds("moverHopSeconds"), shapes: back };
    case "follow":
      return { length: seconds("moverStepSeconds"), shapes: SIDEWAYS };
    case "hop":
      return {
        length: seconds("moverHopSeconds"),
        shapes: hopShapes(movement.most, movement.sideways === true),
      };
    case "stopAndGo": {
      const length = movement.goSeconds * road.speed;
      return {
        length,
        shapes: [
          { lanes: 0, travel: ((movement.factor - 1) * length) / road.geometry.cell.length },
        ],
      };
    }
    case "sway":
      return { length: seconds("moverStepSeconds"), shapes: back };
    default:
      return { length: seconds("moverStepSeconds"), shapes: STEP_SHAPES };
  }
}
