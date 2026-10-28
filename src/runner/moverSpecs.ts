import type { GameData, MoveCount, Movement } from "../data/types";
import { itemAt } from "../lib/arrays";
import { assertNever } from "../lib/assertNever";
import { chance, type Random, randomPick } from "../lib/random";
import { read } from "../rules/units";
import {
  hopSequences,
  hopShapes,
  type MoverFootprint,
  type MoverMotion,
  type MoverSpec,
  type PlannerStreams,
  SIDESTEPS,
} from "./moverPlanning";
import { type StepShape } from "./movers";
import { movementOf, type WalkItemKind } from "./walkItems";

// The movement a drawn spawn moves with: an obstacle, minor or not, or a lucky encounter with a
// movement comes as a mover at a chance of share. Other spawns never move and draw nothing, as
// does any spawn at a share of 0.
export function moverMovement(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  random: Random,
  share: number,
  kind: WalkItemKind,
): Movement | null {
  const movement = movementOf(data, kind);
  if (movement === null || share <= 0) {
    return null;
  }
  return chance(random, share) ? movement : null;
}

// A step: a lane to either side, or a row toward the pack or away.
export const STEP_SHAPES: readonly StepShape[] = [
  ...SIDESTEPS,
  { lanes: 0, travel: 1 },
  { lanes: 0, travel: -1 },
];

// Every count in a range, fewest first.
function countsOf(range: MoveCount): number[] {
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
}

// Steps steps a lane to one side and back in turn, starting toward direction.
function swayed(direction: -1 | 1, steps: number): StepShape[] {
  return Array.from({ length: steps }, (_, i) => ({
    lanes: i % 2 === 0 ? direction : -direction,
    travel: 0,
  }));
}

// Every sequence of steps sideways steps, a lane to either side each: 2 to the power of steps.
function sidestepSequences(steps: number): StepShape[][] {
  return Array.from({ length: 2 ** steps }, (_, index) =>
    Array.from({ length: steps }, (__, i) => itemAt(SIDESTEPS, (index >> (steps - 1 - i)) & 1)),
  );
}

// The sequences of a pattern mover, which draws nothing: a bounce's and a sway's back and forth,
// either way first, a follower's every way to step sideways, and a stop-and-go's pushes in its
// lane. Each sequence's length is its count of steps.
function patternMotion(
  data: Pick<GameData, "tuning">,
  movement: Extract<Movement, { kind: "bounce" | "follow" | "stopAndGo" | "sway" }>,
): MoverMotion {
  const { tuning } = data;
  const stepSeconds = read(tuning, "seconds", "moverStepSeconds");
  switch (movement.kind) {
    case "bounce":
      return {
        count: movement.hops,
        cueEach: true,
        kind: "steps",
        pauseSeconds: movement.pauseSeconds,
        sequences: countsOf(movement.hops).flatMap((hops) => [swayed(-1, hops), swayed(1, hops)]),
        stepSeconds: read(tuning, "seconds", "moverHopSeconds"),
      };
    case "follow":
      return {
        count: movement.steps,
        cueEach: true,
        kind: "steps",
        pauseSeconds: movement.pauseSeconds,
        sequences: countsOf(movement.steps).flatMap(sidestepSequences),
        stepSeconds,
      };
    case "stopAndGo": {
      const pushes = { max: movement.stops.max + 1, min: movement.stops.min + 1 };
      return {
        count: pushes,
        cueEach: true,
        drift: movement.factor - 1,
        kind: "steps",
        pauseSeconds: movement.stopSeconds,
        sequences: countsOf(pushes).map((count) =>
          Array.from({ length: count }, () => ({ lanes: 0, travel: 0 })),
        ),
        stepSeconds: movement.goSeconds,
      };
    }
    default:
      return {
        count: { max: 2 * movement.times.max, min: 2 * movement.times.min },
        kind: "steps",
        pauseSeconds: movement.pauseSeconds,
        sequences: countsOf(movement.times).flatMap((times) => [
          swayed(-1, 2 * times),
          swayed(1, 2 * times),
        ]),
        stepSeconds,
      };
  }
}

// Where every crosser may set off: the reaction margin the pack keeps, and the share of the road
// ahead of the pack it starts from.
function crossStart(
  tuning: GameData["tuning"],
): Pick<Extract<MoverMotion, { kind: "cross" }>, "reactionSeconds" | "startRoadShare"> {
  return {
    reactionSeconds: read(tuning, "seconds", "pathReactionMargin"),
    startRoadShare: [
      read(tuning, "multipliers", "dartStartRoadShareMin"),
      read(tuning, "multipliers", "dartStartRoadShareMax"),
    ],
  };
}

// How a mover of movement moves (moverSpec). A stepper's and a hopper's draws are made here.
function moverMotion(
  data: Pick<GameData, "tuning">,
  streams: PlannerStreams,
  movement: Movement,
): MoverMotion {
  const { tuning } = data;
  switch (movement.kind) {
    case "stopAndGoAcross":
      return {
        ...(movement.herringShare === undefined
          ? {}
          : {
              herring: {
                endRoadShare: read(tuning, "multipliers", "distractionEndRoadShare"),
                share: read(tuning, "probability", movement.herringShare),
              },
            }),
        kind: "cross",
        lanesPerSecond: read(tuning, "counts", "dartLanesPerSecond") * movement.speed,
        pause: { seconds: movement.stopSeconds, stops: movement.stops },
        ...crossStart(tuning),
        stopLanes: { max: 1, min: 1 },
        stopShare: 0,
        tilt: [0, 0],
        turnAtShare: [0, 0],
        turnBackShare: 0,
        vergeShare: 0,
      };
    case "dart":
    case "dive": {
      const dive = movement.kind === "dive";
      return {
        kind: "cross",
        lanesPerSecond: read(tuning, "counts", "dartLanesPerSecond") * (dive ? movement.speed : 1),
        ...crossStart(tuning),
        stopLanes: {
          max: read(tuning, "counts", "dartStopLanesMax"),
          min: read(tuning, "counts", "dartStopLanesMin"),
        },
        ...(dive ? { slide: movement.slide } : {}),
        stopShare: dive ? 1 : movement.stopShare,
        tilt: [movement.tilt.min, movement.tilt.max],
        turnAtShare: [
          read(tuning, "multipliers", "dartTurnAtShareMin"),
          read(tuning, "multipliers", "dartTurnAtShareMax"),
        ],
        turnBackShare: dive ? 0 : movement.turnBackShare,
        vergeShare: dive ? 0 : read(tuning, "probability", "dartVergeStopShare"),
      };
    }
    case "bounce":
    case "follow":
    case "stopAndGo":
    case "sway":
      return patternMotion(data, movement);
    case "inLane":
      return { kind: "ride", speedMultiplier: movement.factor };
    case "merge":
      return {
        kind: "ride",
        merge: { at: movement.mergeAt, seconds: movement.mergeSeconds },
        speedMultiplier: movement.factor,
      };
    case "approach":
      return {
        firstDelaySeconds: [
          read(tuning, "seconds", "approachFirstDelayMin"),
          read(tuning, "seconds", "approachFirstDelayMax"),
        ],
        kind: "approach",
        secondRoadShare: [
          read(tuning, "multipliers", "approachSecondRoadShareMin"),
          read(tuning, "multipliers", "approachSecondRoadShareMax"),
        ],
        stepSeconds: read(tuning, "seconds", "moverStepSeconds"),
        steps: movement.steps,
      };
    case "hop": {
      const sideways = movement.sideways === true;
      return {
        count: movement.times,
        kind: "steps",
        sequences: countsOf(movement.times).flatMap((times) =>
          hopSequences(streams.movers, movement.most, sideways, times),
        ),
        ...(movement.shy === true
          ? {
              shy: {
                nearSeconds: read(tuning, "seconds", "shyHopNearSeconds"),
                rise: sideways ? 0 : movement.most,
                shapes: hopShapes(movement.most, sideways),
                share: read(tuning, "probability", "shyHopperShare"),
              },
            }
          : {}),
        stepSeconds: read(tuning, "seconds", "moverHopSeconds"),
      };
    }
    case "step": {
      const { max, min } = movement.steps;
      const steps = Array.from({ length: max }, (_, i) =>
        randomPick(i < min ? streams.spawns : streams.movers, STEP_SHAPES),
      );
      const mirrored = steps.map(({ lanes, travel }) => ({ lanes: -lanes as -1 | 0 | 1, travel }));
      return {
        count: movement.steps,
        kind: "steps",
        sequences: countsOf(movement.steps).flatMap((count) => [
          steps.slice(0, count),
          mirrored.slice(0, count),
        ]),
        stepSeconds: read(tuning, "seconds", "moverStepSeconds"),
      };
    }
    default:
      return assertNever(movement);
  }
}

// How a mover moves, by its movement and the tuning. A stepper's steps are drawn here, as many as
// its most, the first min from the spawns stream and any more from the movers stream; it may take
// the first steps of them, or of their mirror image, as many as its drawn count. A bounce, a
// follower, a stop-and-go and a sway draw nothing here (patternMotion). A dive is a dart that
// always stops in a lane, never on the verge, sliding its last lane. A merge is a rider that
// changes lane once. A stop-and-go across is a dart as wide as its footprint that never stops for
// good or turns back, pausing once in one of its stops, and of which a share may be red
// herrings, which the planner leaves off the road (placeMovers). A hopper may make
// any hops it can, as many as its drawn count, of up to HOP_SEQUENCES_MOST ways for each count,
// drawn here from the movers stream where there are more. The planner takes whichever way keeps
// the road passable, drawing among those from the zone's seed.
export function moverSpec(
  data: Pick<GameData, "tuning">,
  streams: PlannerStreams,
  footprint: MoverFootprint,
  movement: Movement,
): MoverSpec {
  const { tuning } = data;
  const motion = moverMotion(data, streams, movement);
  return {
    footprint,
    motion,
    movement: movement.kind,
    variation: {
      delaySeconds: read(tuning, "seconds", "moverTimingJitter"),
      lengthShare: read(tuning, "seconds", "moverMoveSecondsJitter"),
      speedShare: read(
        tuning,
        "multipliers",
        movement.kind === "dart" || movement.kind === "dive"
          ? "dartSpeedJitter"
          : "moverSpeedJitter",
      ),
    },
    warningSeconds: read(tuning, "seconds", "moverWarningSeconds"),
  };
}
