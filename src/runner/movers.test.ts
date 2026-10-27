import { describe, expect, it } from "vitest";

import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { TUNING } from "../data/tuning";
import { itemAt } from "../lib/arrays";
import { type Random, seededRandom } from "../lib/random";
import { read } from "../rules/units";
import { plannerStreams } from "../testing/movers";
import {
  DART_LIFTS,
  dartOutcome,
  drawMover,
  drawnCount,
  facesLeft,
  hasLeftRoad,
  HOP_SEQUENCES_MOST,
  hopSequences,
  hopShapes,
  inMotion,
  isWarning,
  laneAt,
  type LaneSpan,
  moveMovers,
  type MoverCaps,
  type MoverDraws,
  type MoverGeometry,
  type MoverItem,
  type MoverPath,
  moverPlace,
  moverPlacements,
  type MoverSpec,
  type MoverStand,
  type MoverTell,
  moverTell,
  type OnScreen,
  onScreenOf,
  placeMovers,
  screenHasRoom,
  type StepShape,
  stepSpots,
  sweptLanes,
} from "./movers";
import { moverOutcomes } from "./outcomes";

// 100px/s: a 1s warning is 100px, and a crosser at 2 lanes a second crosses 0.02 lanes a pixel.
const geometry: MoverGeometry = {
  cellLength: 50,
  laneCount: 5,
  laneInset: 10,
  packHitLength: 40,
  packLength: 40,
  roadLength: 600,
  rowSpacing: 150,
  scrollSpeed: 100,
  sightLength: 400,
  window: 100,
};
const crosser = (
  direction: 1 | -1,
  tilt = 0,
  turnAfter: number | null = null,
  stopAfter: number | null = null,
): MoverPath => ({
  direction,
  enterTravel: 300,
  idle: 0,
  lanesPerPixel: 0.02,
  motion: "cross",
  movement: "dart",
  stopAfter,
  tilt,
  turnAfter,
  warning: 100,
});
// A crosser that waits idle at its edge for 40px before its 100px cue.
const waiting: MoverPath = {
  direction: -1,
  enterTravel: 300,
  idle: 40,
  lanesPerPixel: 0.02,
  motion: "cross",
  movement: "dart",
  stopAfter: null,
  tilt: 0,
  turnAfter: null,
  warning: 140,
};
// A crosser that stops once it has crossed stopAfter lanes.
const stopper = (direction: 1 | -1, tilt: number, stopAfter: number): MoverPath =>
  crosser(direction, tilt, null, stopAfter);
const rider = (speedMultiplier: number): MoverPath => ({
  lane: 3,
  lanes: 1,
  motion: "ride",
  movement: "inLane",
  speedMultiplier,
  warning: 100,
});
// A step a lane right at 100, then a row toward the pack at 300, each 50px long.
const stepper: MoverPath = {
  lane: 2,
  motion: "steps",
  movement: "step",
  steps: [
    { at: 100, lanes: 1, length: 50, travel: 0 },
    { at: 300, lanes: 0, length: 50, travel: 50 },
  ],
  warning: 100,
};
// A hop two lanes left at 100, 30px long.
const hopper: MoverPath = {
  lane: 3,
  motion: "steps",
  movement: "hop",
  steps: [{ at: 100, lanes: -2, length: 30, travel: 0 }],
  warning: 100,
};
// The stream hop sequences are drawn from where there are more than HOP_SEQUENCES_MOST.
const HOP_RANDOM = seededRandom(1);
// The game's caps on movers on screen.
const CAPS: MoverCaps = {
  darts: read(TUNING, "counts", "maxDartMovers"),
  slowVehicles: read(TUNING, "counts", "maxSlowVehicles"),
  total: read(TUNING, "counts", "maxMovers"),
};
const spec = (motion: MoverSpec["motion"], lanes = 1, rows = 1): MoverSpec => ({
  footprint: { lanes, rows },
  motion,
  movement:
    motion.kind === "cross"
      ? "dart"
      : motion.kind === "ride"
        ? "inLane"
        : motion.kind === "approach"
          ? "approach"
          : "step",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
  warningSeconds: 1,
});

describe("moverPlace", () => {
  it("places each kind of mover along its path", () => {
    for (const { path, since, want } of [
      {
        name: "a crosser's cue on its row at the edge it enters from",
        path: crosser(1),
        since: 40,
        want: { lanePosition: -0.5, solid: false, travel: 240 },
      },
      {
        name: "a crosser from the right, at its cue",
        path: crosser(-1),
        since: 0,
        want: { lanePosition: 4.5, solid: false, travel: 200 },
      },
      {
        name: "a crosser running across, keeping step with the road",
        path: crosser(1),
        since: 150,
        want: { lanePosition: 0.5, solid: true, travel: 350 },
      },
      {
        name: "a crosser tilted toward the pack, gaining on the road",
        path: crosser(1, 0.5),
        since: 200,
        want: { lanePosition: 1.5, solid: true, travel: 450 },
      },
      {
        name: "a crosser tilted away, falling behind the road",
        path: crosser(1, -0.5),
        since: 200,
        want: { lanePosition: 1.5, solid: true, travel: 350 },
      },
      {
        name: "a crosser turned back halfway, crossing back",
        path: crosser(1, 0, 2.5),
        since: 275,
        want: { lanePosition: 1, solid: true, travel: 475 },
      },
      {
        name: "a crosser from the right turned back at the far edge, crossing back",
        path: crosser(-1, 0, 5),
        since: 400,
        want: { lanePosition: 0.5, solid: true, travel: 600 },
      },
      {
        name: "a crosser that stops, tilted toward the pack, before its stop",
        path: stopper(1, 0.5, 1.5),
        since: 150,
        want: { lanePosition: 0.5, solid: true, travel: 375 },
      },
      {
        name: "a crosser stopped in its second lane, keeping step with the road",
        path: stopper(1, 0.5, 1.5),
        since: 400,
        want: { lanePosition: 1, solid: true, travel: 637.5 },
      },
      {
        name: "a crosser from the right stopped in its fourth lane",
        path: stopper(-1, 0, 3.5),
        since: 500,
        want: { lanePosition: 1, solid: true, travel: 700 },
      },
      {
        name: "a rider at the top of its lane during its cue",
        path: rider(2),
        since: 50,
        want: { lanePosition: 3, solid: false, travel: 0 },
      },
      {
        name: "a rider faster than the road",
        path: rider(2),
        since: 150,
        want: { lanePosition: 3, solid: true, travel: 100 },
      },
      {
        name: "a rider slower than the road",
        path: rider(0.5),
        since: 300,
        want: { lanePosition: 3, solid: true, travel: 100 },
      },
      {
        name: "a stepper standing before its first step",
        path: stepper,
        since: 90,
        want: { lanePosition: 2, solid: true, travel: 90 },
      },
      {
        name: "a stepper halfway through a step sideways",
        path: stepper,
        since: 125,
        want: { lanePosition: 2.5, solid: true, travel: 125 },
      },
      {
        name: "a stepper after both steps",
        path: stepper,
        since: 400,
        want: { lanePosition: 3, solid: true, travel: 450 },
      },
      {
        name: "a hopper over the lane between, halfway through a two-lane hop",
        path: hopper,
        since: 115,
        want: { lanePosition: 2, solid: true, travel: 115 },
      },
      {
        name: "a hopper landed",
        path: hopper,
        since: 130,
        want: { lanePosition: 1, solid: true, travel: 130 },
      },
    ] satisfies readonly {
      name: string;
      path: MoverPath;
      since: number;
      want: ReturnType<typeof moverPlace>;
    }[]) {
      expect(moverPlace(5, path, since)).toEqual(want);
    }
  });
});

describe("moverTell and inMotion", () => {
  it("cues each kind of mover by its tell and motion", () => {
    for (const { moving, path, since, tell } of [
      {
        moving: false,
        name: "a crosser's cue",
        path: crosser(-1),
        since: 50,
        tell: { direction: -1, kind: "across" },
      },
      {
        moving: false,
        name: "a crosser waiting at its edge before its cue",
        path: waiting,
        since: 30,
        tell: null,
      },
      {
        moving: false,
        name: "a crosser's cue after its wait",
        path: waiting,
        since: 40,
        tell: { direction: -1, kind: "across" },
      },
      { moving: true, name: "a crosser on its way", path: crosser(1), since: 100, tell: null },
      {
        moving: true,
        name: "a crosser that stops, before its stop",
        path: stopper(1, 0, 1.5),
        since: 150,
        tell: null,
      },
      {
        moving: false,
        name: "a crosser stopped, with no cue",
        path: stopper(1, 0, 1.5),
        since: 200,
        tell: null,
      },
      {
        moving: false,
        name: "a rider faster than the road, before it enters",
        path: rider(2),
        since: 0,
        tell: { kind: "down" },
      },
      {
        moving: false,
        name: "a rider slower than the road, before it enters",
        path: rider(0.5),
        since: 99,
        tell: { kind: "up" },
      },
      { moving: true, name: "a rider on its way", path: rider(0.5), since: 100, tell: null },
      {
        moving: false,
        name: "a stepper before its first step",
        path: stepper,
        since: 0,
        tell: { kind: "wander" },
      },
      { moving: true, name: "a stepper stepping", path: stepper, since: 120, tell: null },
      { moving: false, name: "a stepper between steps", path: stepper, since: 160, tell: null },
      {
        moving: false,
        name: "a stepper before its second step",
        path: stepper,
        since: 250,
        tell: { kind: "wander" },
      },
      { moving: false, name: "a stepper done stepping", path: stepper, since: 400, tell: null },
    ] satisfies readonly {
      moving: boolean;
      name: string;
      path: MoverPath;
      since: number;
      tell: MoverTell | null;
    }[]) {
      expect(moverTell(path, since)).toEqual(tell);
      expect(inMotion(path, since)).toBe(moving);
    }
  });
});

describe("facesLeft", () => {
  // A step a lane left at 100, a row toward the pack at 200, then a lane right at 300.
  const wanderer: MoverPath = {
    ...stepper,
    steps: [
      { at: 100, lanes: -1, length: 50, travel: 0 },
      { at: 200, lanes: 0, length: 50, travel: 50 },
      { at: 300, lanes: 1, length: 50, travel: 0 },
    ],
  };
  it("faces left only while moving left", () => {
    for (const { left, path, since } of [
      { left: false, name: "a crosser running right", path: crosser(1), since: 150 },
      { left: true, name: "a crosser running left", path: crosser(-1), since: 150 },
      { left: false, name: "a crosser before it turns back", path: crosser(1, 0, 2.5), since: 200 },
      {
        left: true,
        name: "a crosser turned back to the left",
        path: crosser(1, 0, 2.5),
        since: 275,
      },
      {
        left: false,
        name: "a crosser turned back to the right",
        path: crosser(-1, 0, 2.5),
        since: 275,
      },
      {
        left: true,
        name: "a crosser stopped after running left",
        path: stopper(-1, 0, 1.5),
        since: 400,
      },
      { left: false, name: "a rider", path: rider(2), since: 150 },
      { left: false, name: "a hopper before its hop left", path: hopper, since: 90 },
      { left: true, name: "a hopper as it hops left", path: hopper, since: 100 },
      { left: true, name: "a hopper landed left", path: hopper, since: 200 },
      { left: false, name: "a stepper stepping right", path: stepper, since: 125 },
      {
        left: true,
        name: "a stepper stepping a row after a step left",
        path: wanderer,
        since: 225,
      },
      { left: false, name: "a stepper stepping back right", path: wanderer, since: 300 },
    ] satisfies readonly { left: boolean; name: string; path: MoverPath; since: number }[]) {
      expect(facesLeft(path, since)).toBe(left);
    }
  });
});

describe("laneAt and hasLeftRoad", () => {
  it("puts a lane position in the lane whose half-lane span holds it", () => {
    expect([-0.6, -0.5, 0.49, 0.5, 4.49, 4.5].map(laneAt)).toEqual([-1, 0, 0, 1, 4, 5]);
  });

  it("drops a crosser half a lane past either edge", () => {
    const at = (lanePosition: number) => ({ lanePosition, solid: true, travel: 0 });
    expect([-1.01, -1, 5, 5.01].map((p) => hasLeftRoad(5, at(p)))).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });
});

describe("moveMovers", () => {
  const item = (mover?: MoverItem["mover"]): MoverItem => ({
    height: 30,
    id: 1,
    kind: "squirrel",
    lane: 0,
    laneSpan: 1,
    ...(mover === undefined ? {} : { mover }),
    y: 0,
  });

  it("moves a mover on by the scroll and places it in the lane it has reached", () => {
    const [moved] = moveMovers({ laneCount: 5, roadTop: 40 }, 50, [
      item({ path: crosser(1), since: 100 }),
    ]);
    expect(moved).toEqual({ ...item({ path: crosser(1), since: 150 }), lane: 1, y: 40 - 30 + 350 });
  });

  it("drops a crosser once it is out of sight past the far edge, and leaves other items alone", () => {
    const still = item();
    const gone = item({ path: crosser(1), since: 100 + 5.5 / 0.02 });
    expect(moveMovers({ laneCount: 5, roadTop: 40 }, 1, [still, gone])).toEqual([still]);
  });

  it("tells a cue from a solid mover, and a stepper is always solid", () => {
    expect(isWarning(5, item({ path: crosser(1), since: 99 }))).toBe(true);
    expect(isWarning(5, item({ path: crosser(1), since: 100 }))).toBe(false);
    expect(isWarning(5, item({ path: stepper, since: 0 }))).toBe(false);
    expect(isWarning(5, item())).toBe(false);
  });
});

describe("sweptLanes", () => {
  it("sweeps every lane a mover touches, clipped to the road", () => {
    for (const { from, path, to, want } of [
      {
        from: 300,
        name: "a crosser entering",
        path: crosser(1),
        to: 400,
        want: { count: 3, first: 0 },
      },
      {
        from: 350,
        name: "a crosser from the right",
        path: crosser(-1),
        to: 450,
        want: { count: 4, first: 1 },
      },
      {
        from: 500,
        name: "a crosser leaving",
        path: crosser(1),
        to: 700,
        want: { count: 2, first: 3 },
      },
      {
        from: 100,
        name: "a crosser not yet moving",
        path: crosser(1),
        to: 300,
        want: { count: 0, first: 0 },
      },
      {
        from: 300,
        name: "a crosser tilted toward the pack",
        path: crosser(1, 1),
        to: 500,
        want: { count: 3, first: 0 },
      },
      {
        from: 350,
        name: "a crosser turning back between, out to its turn and back",
        path: crosser(1, 0, 3),
        to: 550,
        want: { count: 4, first: 0 },
      },
      {
        from: 300,
        name: "a crosser out to its stop in its third lane",
        path: stopper(1, 0, 2.5),
        to: 700,
        want: { count: 3, first: 0 },
      },
      {
        from: 500,
        name: "a crosser stopped in its third lane",
        path: stopper(1, 0, 2.5),
        to: 700,
        want: { count: 1, first: 2 },
      },
      { from: 0, name: "a rider", path: rider(2), to: 1000, want: { count: 1, first: 3 } },
    ] satisfies readonly {
      from: number;
      name: string;
      path: MoverPath;
      to: number;
      want: LaneSpan;
    }[]) {
      expect(sweptLanes(5, path, from, to)).toEqual(want);
    }
  });
});

// A mover's draws with no delay at its kind's speed, and the count, move lengths, reach side and
// a dart's start, tilt and turn at the low end of their ranges (the fewest and shortest moves,
// the left side first, the lowest start and tilt, turning halfway), there and shy, or at the high
// end (turning at the far edge). A dart of a kind that turns back turns at each end.
const DRAW_ENDS: readonly { draws: MoverDraws; end: string }[] = [
  {
    draws: {
      count: 0,
      delays: [0, 0, 0],
      lengths: [0, 0, 0, 0],
      share: 0,
      shy: 0.999999,
      side: 0,
      speed: 0.5,
      start: 0,
      tilt: 0,
      turn: 0,
      turnAt: 0,
    },
    end: "the low end",
  },
  {
    draws: {
      count: 0,
      delays: [0, 0, 0],
      lengths: [0, 0, 0, 0],
      share: 0,
      shy: 0,
      side: 0,
      speed: 0.5,
      start: 0,
      tilt: 0,
      turn: 0,
      turnAt: 0,
    },
    end: "the low end, shy",
  },
  {
    draws: {
      count: 0.999999,
      delays: [0, 0, 0],
      lengths: [0.999999, 0.999999, 0.999999, 0.999999],
      share: 0,
      shy: 0.999999,
      side: 0.999999,
      speed: 0.5,
      start: 0.999999,
      tilt: 0.999999,
      turn: 0,
      turnAt: 0.999999,
    },
    end: "the high end",
  },
];

type CrossMotion = Extract<MoverSpec["motion"], { kind: "cross" }>;

// How many lanes from its edge a dart that stops does so, at the low and high end of its draw.
const STOP_LANES = {
  max: read(TUNING, "counts", "dartStopLanesMax"),
  min: read(TUNING, "counts", "dartStopLanesMin"),
};

// A crosser that sets off from 0.1 to 0.9 of the road ahead of the pack, leaving the pack half a
// second after its cue, at a tilt drawn from min to max, turning back at turnBackShare of them
// from halfway to all the way across, and stopping at stopShare of them after the game's
// STOP_LANES.
const cross = (
  lanesPerSecond: number,
  min: number,
  max = min,
  turnBackShare = 0,
  stopShare = 0,
): CrossMotion => ({
  kind: "cross",
  lanesPerSecond,
  reactionSeconds: 0.5,
  startRoadShare: [0.1, 0.9],
  stopLanes: STOP_LANES,
  stopShare,
  tilt: [min, max],
  turnAtShare: [0.5, 1],
  turnBackShare,
});

// Each motion, footprint and tilt the planner meets, as a spec.
const SPECS: readonly { name: string; spec: MoverSpec }[] = [
  { name: "a dart", spec: spec(cross(2, 0)) },
  {
    name: "a dart tilted toward the pack",
    spec: spec(cross(3, 0.1, 0.7)),
  },
  { name: "a dart tilted away", spec: spec(cross(3, -0.3)) },
  { name: "a dart that turns back", spec: spec(cross(3, 0, 0, 1)) },
  { name: "a dart that stops", spec: spec(cross(3, 0, 0, 0, 1)) },
  { name: "a dart tilted toward the pack that stops", spec: spec(cross(3, 0.1, 0.7, 0, 1)) },
  { name: "a dart tilted away that stops", spec: spec(cross(3, -0.3, -0.3, 0, 1)) },
  {
    name: "an in-lane mover faster than the road",
    spec: spec({ kind: "ride", speedMultiplier: 1.6 }),
  },
  {
    name: "an in-lane mover slower than the road",
    spec: spec({ kind: "ride", speedMultiplier: 0.6 }),
  },
  { name: "a wide, long in-lane mover", spec: spec({ kind: "ride", speedMultiplier: 0.6 }, 2, 2) },
  {
    name: "a stepper",
    spec: spec({
      count: { max: 3, min: 2 },
      kind: "steps",
      sequences: [
        [
          { lanes: 1, travel: 0 },
          { lanes: 0, travel: -1 },
        ],
        [
          { lanes: 0, travel: 1 },
          { lanes: -1, travel: 0 },
        ],
        [
          { lanes: 1, travel: 0 },
          { lanes: 0, travel: -1 },
          { lanes: -1, travel: 0 },
        ],
        [
          { lanes: 0, travel: 1 },
          { lanes: -1, travel: 0 },
          { lanes: 0, travel: 1 },
        ],
      ],
      stepSeconds: 0.2,
    }),
  },
  {
    name: "a hopper",
    spec: spec({
      count: { max: 2, min: 1 },
      kind: "steps",
      sequences: [
        ...hopSequences(HOP_RANDOM, 2, false, 1),
        ...hopSequences(HOP_RANDOM, 2, false, 2),
      ],
      stepSeconds: 0.3,
    }),
  },
  {
    name: "a sideways hopper",
    spec: spec({
      count: { max: 2, min: 1 },
      kind: "steps",
      sequences: [...hopSequences(HOP_RANDOM, 2, true, 1), ...hopSequences(HOP_RANDOM, 2, true, 2)],
      stepSeconds: 0.3,
    }),
  },
  {
    name: "a hopper of a shy kind",
    spec: spec({
      count: { max: 2, min: 1 },
      kind: "steps",
      sequences: [
        ...hopSequences(HOP_RANDOM, 2, false, 1),
        ...hopSequences(HOP_RANDOM, 2, false, 2),
      ],
      shy: { nearSeconds: 1.6, rise: 2, shapes: hopShapes(2, false), share: 0.5 },
      stepSeconds: 0.3,
    }),
  },
  {
    name: "a stalker",
    spec: spec({
      firstDelaySeconds: [0, 0.5],
      kind: "approach",
      secondRoadShare: [0.25, 0.45],
      stepSeconds: 0.6,
      steps: { max: 3, min: 2 },
    }),
  },
];

describe("hopShapes", () => {
  // A hop goes a lane to either side or, unless sideways, a row up the road or diagonally up:
  // never down toward the pack.
  it("hops 1 to its most spots one way, up too unless sideways", () => {
    for (const hop of [
      { most: 1, sideways: false },
      { most: 2, sideways: false },
      { most: 2, sideways: true },
    ]) {
      const shapes = hopShapes(hop.most, hop.sideways);
      expect(shapes.every(({ travel }) => travel <= 0)).toBe(true);
      expect(shapes.some(({ travel }) => travel < 0)).toBe(!hop.sideways);
      expect(shapes.some(({ lanes, travel }) => lanes !== 0 && travel !== 0)).toBe(!hop.sideways);
      expect(
        shapes.every(
          ({ lanes, travel }) => lanes === 0 || travel === 0 || Math.abs(lanes) === -travel,
        ),
      ).toBe(true);
      expect([...new Set(shapes.map(stepSpots))].sort()).toEqual(
        Array.from({ length: hop.most }, (_, i) => i + 1),
      );
      // Each hop across has its mirror image, so the planner can send it either way.
      for (const { lanes, travel } of shapes) {
        expect(shapes).toContainEqual({ lanes: lanes === 0 ? 0 : -lanes, travel });
      }
    }
  });
});

describe("hopSequences", () => {
  // A sequence's place among every sequence: its hops as digits in base the number of shapes.
  const indexOf = (shapes: readonly StepShape[], sequence: readonly StepShape[]) =>
    sequence.reduce(
      (index, hop) =>
        index * shapes.length +
        shapes.findIndex(({ lanes, travel }) => lanes === hop.lanes && travel === hop.travel),
      0,
    );
  it.each([
    { most: 2, sideways: false, times: 2 },
    { most: 2, sideways: false, times: 3 },
    { most: 2, sideways: true, times: 5 },
    { most: 2, sideways: false, times: 5 },
    { most: 2, sideways: false, times: 6 },
  ])(
    "makes distinct sequences of $times hops of $most, sideways $sideways, up to the most, in order",
    ({ most, sideways, times }) => {
      const shapes = hopShapes(most, sideways);
      const total = shapes.length ** times;
      let draws = 0;
      const counted: Random = () => {
        draws++;
        return HOP_RANDOM();
      };
      const sequences = hopSequences(counted, most, sideways, times);
      const indices = sequences.map((sequence) => indexOf(shapes, sequence));
      expect(sequences).toHaveLength(Math.min(total, HOP_SEQUENCES_MOST));
      expect(sequences.every((sequence) => sequence.length === times)).toBe(true);
      expect(indices.every((index) => index >= 0 && index < total)).toBe(true);
      expect(indices.every((index, i) => i === 0 || index > (indices[i - 1] ?? index))).toBe(true);
      expect(draws).toBe(total > HOP_SEQUENCES_MOST ? 1 : 0);
    },
  );

  it("draws the same sequences from the same seed, and others from another", () => {
    const drawn = (seed: number) => hopSequences(seededRandom(seed), 2, false, 5);
    expect(drawn(1)).toEqual(drawn(1));
    expect(drawn(1)).not.toEqual(drawn(2));
  });
});

describe("moverPlacements", () => {
  // Wherever it is placed, a mover touches the pack only within what its placement blocks: in
  // its lanes, from its row's window for as long as its rows' blocking length.
  it.each(
    SPECS.flatMap(({ name, spec: moving }) =>
      DRAW_ENDS.map(({ draws, end }) => ({ draws, end, moving, name })),
    ),
  )(
    "keeps $name within the lanes and rows it blocks, at $end of its draws",
    ({ draws, moving }) => {
      const { cellLength, sightLength, window } = geometry;
      const { lanes: across, rows } = moving.footprint;
      const placements = moverPlacements(geometry, moving, draws);
      expect(placements.length).toBeGreaterThan(0);
      for (const placement of placements) {
        const blocked = window + (placement.rows - 1) * cellLength;
        const reach = window + (rows - 1) * cellLength;
        const { path } = placement;
        const outcomes = moverOutcomes(path);
        for (const outcome of outcomes) {
          for (let since = 0; since < 4000; since += 1) {
            const place = moverPlace(geometry.laneCount, outcome, since);
            const lane = laneAt(place.lanePosition);
            const touching =
              place.solid && place.travel >= sightLength && place.travel < sightLength + reach;
            const onRoad = lane + across > 0 && lane < geometry.laneCount;
            if (!touching || !onRoad) {
              continue;
            }
            const scroll = placement.appears + since;
            expect(scroll).toBeGreaterThanOrEqual(sightLength - 1e-6);
            expect(scroll).toBeLessThanOrEqual(sightLength + blocked + 1e-6);
            const first = Math.max(0, lane);
            const last = Math.min(geometry.laneCount - 1, lane + across - 1);
            expect(first).toBeGreaterThanOrEqual(placement.lanes.first);
            expect(last).toBeLessThan(placement.lanes.first + placement.lanes.count);
          }
        }
      }
    },
  );

  // A dart stands for the pack-fit gap in the lanes its hit box touches while it overlaps the
  // pack, until that contact ends: once its travel is past the window, or once its hit box, inset
  // inside its lane at each side, is off the road. A stand wider or longer than that would hide
  // road beside or behind it, where the pack can step in. Sampled a pixel of scroll apart, so the
  // contact's end is up to a pixel past the last sample.
  it.each(
    SPECS.flatMap(({ name, spec: moving }) =>
      moving.motion.kind === "cross"
        ? DRAW_ENDS.flatMap(({ draws, end }) =>
            [0, ...DART_LIFTS].map((lift) => ({ draws, end, lift, moving, name })),
          )
        : [],
    ),
  )(
    "stands $name where and while its hit box meets the pack, at $end of its draws, lifted $lift",
    ({ draws, lift, moving }) => {
      const { cellLength, laneCount, laneInset, packLength, sightLength, window } = geometry;
      const inset = laneInset / cellLength;
      for (const { appears, path, stands } of moverPlacements(geometry, moving, draws, lift)) {
        // The lanes its hit box touches while it overlaps the pack, by scroll since its cue.
        const contacts = Array.from({ length: 4000 }, (_, since) => {
          const place = moverPlace(laneCount, path, since);
          const overlaps =
            place.solid && place.travel >= sightLength && place.travel < sightLength + window;
          const first = Math.max(0, Math.floor(place.lanePosition - 1 + inset) + 1);
          const last = Math.min(laneCount - 1, Math.ceil(place.lanePosition + 1 - inset) - 1);
          const lanes = Array.from({ length: last - first + 1 }, (_unused, i) => first + i);
          return { lanes: overlaps ? lanes : [], since };
        }).filter(({ lanes }) => lanes.length > 0);
        expect(stands).toHaveLength(contacts.length > 0 ? 1 : 0);
        const touched = contacts.flatMap(({ lanes }) => lanes);
        for (const stand of stands) {
          const end = sightLength + stand.distance + stand.length + packLength;
          const last = appears + itemAt(contacts, contacts.length - 1).since;
          expect([stand.lane, stand.lane + stand.lanes - 1]).toEqual([
            Math.min(...touched),
            Math.max(...touched),
          ]);
          expect(end).toBeGreaterThanOrEqual(last - 1e-6);
          expect(end).toBeLessThanOrEqual(last + 1 + 1e-6);
        }
      }
    },
  );

  // A stepper, hopper or stalker moves as many times as its drawn count, the fewest or the most
  // of its range, less any step that would come once it has reached the pack's rows.
  it.each(
    SPECS.flatMap(({ name, spec: moving }) =>
      moving.motion.kind === "steps" || moving.motion.kind === "approach"
        ? DRAW_ENDS.map(({ draws, end }) => ({ draws, end, moving, name }))
        : [],
    ),
  )("moves $name its drawn count of times, at $end of its draws", ({ draws, moving }) => {
    const { motion } = moving;
    const range =
      motion.kind === "approach" ? motion.steps : motion.kind === "steps" ? motion.count : null;
    if (range === null) {
      throw new Error("not a stepping mover");
    }
    const count = drawnCount(range, draws.count);
    expect(count).toBe(draws.count === 0 ? range.min : range.max);
    const placements = moverPlacements(geometry, moving, draws);
    const moves = placements.flatMap(({ path }) =>
      moverOutcomes(path).map((outcome) =>
        outcome.motion === "cross" || outcome.motion === "ride" ? 0 : outcome.steps.length,
      ),
    );
    // A shy hopper may make no hop at all, when the pack leaves it none that move away.
    const shy = placements.some(({ path }) => path.motion === "shy");
    expect(Math.max(...moves)).toBe(count);
    expect(Math.min(...moves)).toBeGreaterThanOrEqual(shy ? 0 : 1);
  });

  // A stepper's or hopper's moves run back to back, and only the first has a cue: the wander mark
  // shows before the first move and never during a later one. A shy hopper's pending hops are
  // spaced the same way.
  it.each(
    SPECS.flatMap(({ name, spec: moving }) =>
      moving.motion.kind === "steps"
        ? [0, 0.999999].map((shy) => ({
            draws: {
              count: 0.999999,
              delays: [0, 0, 0] as const,
              lengths: [0.5, 0.5, 0.5, 0.5],
              share: 0,
              shy,
              side: 0,
              speed: 0.5,
              start: 0,
              tilt: 0,
              turn: 0,
              turnAt: 0,
            },
            moving,
            name,
            way: shy === 0 ? "shy if its kind can be" : "never shy",
          }))
        : [],
    ),
  )("runs $name's most moves back to back, cueing the first only, $way", ({ draws, moving }) => {
    const placements = moverPlacements(geometry, moving, draws);
    const length =
      (moving.motion.kind === "steps" ? moving.motion.stepSeconds : 0) * geometry.scrollSpeed;
    let checked = 0;
    for (const { path } of placements) {
      if (path.motion === "shy") {
        path.pending.slice(1).forEach((at, i) => {
          expect(at - (path.pending[i] ?? 0)).toBeCloseTo(length);
          checked += 1;
        });
      } else if (path.motion === "steps") {
        const [first] = path.steps;
        expect(first?.uncued).toBeUndefined();
        expect(moverTell(path, (first?.at ?? 0) - 1)).toEqual({ kind: "wander" });
        path.steps.slice(1).forEach((step, i) => {
          const before = path.steps[i];
          expect(step.at).toBeCloseTo((before?.at ?? 0) + (before?.length ?? 0));
          expect(step.uncued).toBe(true);
          for (let since = before?.at ?? 0; since < step.at + step.length; since += 1) {
            expect(moverTell(path, since)).toBeNull();
          }
          checked += 1;
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it.each([
    { draw: 0, range: { max: 3, min: 2 }, want: 2 },
    { draw: 0.49, range: { max: 3, min: 2 }, want: 2 },
    { draw: 0.5, range: { max: 3, min: 2 }, want: 3 },
    { draw: 0.999999, range: { max: 3, min: 2 }, want: 3 },
    { draw: 0.999999, range: { max: 1, min: 1 }, want: 1 },
  ])("draws a count of $want from $range.min to $range.max at $draw", ({ draw, range, want }) => {
    expect(drawnCount(range, draw)).toBe(want);
  });

  // The pack-fit gap keeps room behind a hopper at every spot it hops over, not only where it
  // takes off and lands.
  it("stands a hopper at every spot its hop passes over", () => {
    const placements = moverPlacements(
      geometry,
      spec({
        count: { max: 1, min: 1 },
        kind: "steps",
        sequences: [[{ lanes: 2, travel: 0 }], [{ lanes: 0, travel: 2 }]],
        stepSeconds: 0.3,
      }),
    );
    for (const { lane, path, stands } of placements) {
      const sideways = path.motion === "steps" && path.steps.some(({ lanes }) => lanes !== 0);
      expect(stands.map((stand) => stand.lane - lane)).toEqual(sideways ? [0, 1, 2] : [0, 0, 0]);
      expect(new Set(stands.map(({ distance }) => distance)).size).toBe(sideways ? 1 : 3);
    }
  });

  // A diagonal hop is across and along at once, so it stands at the corners between its ends as
  // well; a hop one way only has none.
  it.each([
    { hop: { lanes: 1, travel: -1 }, stands: ["0,0", "0,1", "1,0", "1,1"] },
    { hop: { lanes: 1, travel: 0 }, stands: ["0,0", "1,0"] },
    { hop: { lanes: 0, travel: -1 }, stands: ["0,0", "0,1"] },
  ])("stands a hop of $hop at $stands (lane, row up the road)", ({ hop, stands }) => {
    const [placement] = moverPlacements(
      geometry,
      spec({ count: { max: 1, min: 1 }, kind: "steps", sequences: [[hop]], stepSeconds: 0.3 }),
    );
    const lane = placement?.lane ?? 0;
    const appears = placement?.appears ?? 0;
    const at = (placement?.stands ?? []).map(
      (stand) => `${stand.lane - lane},${(stand.distance - appears) / geometry.cellLength}`,
    );
    expect([...new Set(at)].sort()).toEqual(stands);
  });

  // Up to a second of delay before each of four steps, 0.1s long: at 100px/s each step comes its
  // own draw's tenth of 100px after the one before ends.
  it("delays each of a stepper's moves by a draw of its own, up to its most moves", () => {
    const delays = [0.1, 0.2, 0.3, 0.4];
    const stepper = {
      ...spec({
        count: { max: delays.length, min: delays.length },
        kind: "steps",
        sequences: [[1, -1, 1, -1].map((lanes) => ({ lanes, travel: 0 }))],
        stepSeconds: 0.1,
      }),
      variation: { delaySeconds: 1, lengthShare: 0, speedShare: 0 },
    };
    const [placement] = moverPlacements(geometry, stepper, {
      ...drawMover({ movers: () => 0.5, spawns: () => 0.5 }),
      delays,
    });
    const steps = placement?.path.motion === "steps" ? placement.path.steps : [];
    const ready = [geometry.cellLength + 100, ...steps.map(({ at, length }) => at + length)];
    expect(steps).toHaveLength(delays.length);
    steps.forEach(({ at }, i) => {
      expect(at - itemAt(ready, i)).toBeCloseTo(itemAt(delays, i) * 100);
    });
  });

  // At 3 lanes a second, set off as high as its cue allows it has crossed the road before it
  // reaches the pack's rows; set off as low as the pack's reaction allows, it meets the pack in
  // the 4 lanes it sweeps while its row is in the window.
  it.each([
    { end: "high", lanes: 0, meets: false, start: 0.999999 },
    { end: "low", lanes: 4, meets: true, start: 0 },
  ])(
    "meets the pack with a dart set off $end only if it is still crossing",
    ({ lanes, meets, start }) => {
      const draws = {
        count: 0,
        delays: [0, 0, 0] as const,
        lengths: [0.5, 0.5, 0.5, 0.5],
        share: 0,
        shy: 0.999999,
        side: 0,
        speed: 0.5,
        start,
        tilt: 0,
        turn: 0.999999,
        turnAt: 0,
      };
      const [rightward] = moverPlacements(geometry, spec(cross(3, 0)), draws);
      expect(rightward?.lanes.count).toBe(lanes);
      expect(rightward?.leadIn).toBe(meets);
      expect(rightward?.stands.length).toBe(meets ? 1 : 0);
    },
  );

  // Half a second of reaction at 100px/s, sooner at the dart's drawn tilt; a 1s cue and a cell
  // must fit above the start, which sets off at most 0.625 of the 400px road ahead, its travel at
  // least 150. Within a narrower range, the start's high end is the range's, raised as far as a
  // steep tilt needs.
  const narrow = (motion: CrossMotion): CrossMotion => ({
    ...motion,
    startRoadShare: [0.1, 0.3],
  });
  it.each([
    { draw: 0, highTravel: 150, motion: cross(3, 0), name: "untilted", tilt: 0 },
    { draw: 0, highTravel: 150, motion: cross(3, 0.1, 0.7), name: "at its lowest tilt", tilt: 0.1 },
    {
      draw: 0.999999,
      highTravel: 150,
      motion: cross(3, 0.1, 0.7),
      name: "at its highest tilt",
      tilt: 0.7,
    },
    // At 100px/s a start at most 0.625 of the road ahead leaves half a second at tilt 4 at most.
    {
      draw: 0.999999,
      highTravel: 150,
      motion: cross(3, 0.1, 10),
      name: "at a tilt cut to the steepest the road allows",
      tilt: 4,
    },
    {
      draw: 0,
      highTravel: 280,
      motion: narrow(cross(3, 0)),
      name: "untilted, up to its range's high end",
      tilt: 0,
    },
    // At tilt 2, half a second needs 0.375 of the road ahead, above the range's 0.3.
    {
      draw: 0,
      highTravel: 250,
      motion: narrow(cross(3, 2)),
      name: "tilted past its range's high end, raised as far as its tilt needs",
      tilt: 2,
    },
  ])(
    "starts a dart $name no lower than leaves the pack its reaction time, nor higher than shows its cue",
    ({ draw, highTravel, motion, tilt }) => {
      const ends = [0, 0.999999].map((start) => {
        const [placement] = moverPlacements(geometry, spec(motion), {
          count: 0,
          delays: [0, 0, 0],
          lengths: [0.5, 0.5, 0.5, 0.5],
          share: 0,
          shy: 0.999999,
          side: 0,
          speed: 0.5,
          start,
          tilt: draw,
          turn: 0.999999,
          turnAt: 0,
        });
        return placement?.path.motion === "cross" ? placement.path.enterTravel : NaN;
      });
      const { scrollSpeed, sightLength } = geometry;
      const [low, high] = ends;
      expect(low).toBeCloseTo(sightLength - 0.5 * scrollSpeed * (1 + tilt), 3);
      expect(high).toBeCloseTo(highTravel);
    },
  );

  // Tilted 0.4 and drawn to set off as low as the pack's half second of reaction allows, 70px
  // ahead at 100px/s, its travel 330 of the 400px road, a dart lifted sets off that share of the
  // way up to the highest start that shows its 1s cue and a cell, travel 150, keeping its tilt,
  // either way it enters.
  it.each([0, ...DART_LIFTS].map((lift) => ({ lift, travel: 330 - lift * (330 - 150) })))(
    "lifts a dart's start $lift of the way up to its cue's limit",
    ({ lift, travel }) => {
      const draws = drawMover({ movers: () => 0, spawns: () => 0 });
      const placements = moverPlacements(geometry, spec(cross(3, 0.4)), draws, lift);
      expect(placements).toHaveLength(2);
      for (const { path } of placements) {
        expect(path.motion === "cross" ? [path.tilt, path.enterTravel] : []).toEqual([
          0.4,
          expect.closeTo(travel, 3),
        ]);
      }
    },
  );

  // Halfway across the 5-lane road at the low end of the turn draw, at its far edge at the high
  // end, or not at all at a turn draw at its kind's share. Turning, it is on screen until it has
  // crossed back: 2.5 or 5 lanes out and as far back, and half a lane past the edge.
  it.each([
    { name: "crosses once", turn: 0.5, turnAfter: null, turnAt: 0 },
    { name: "turns back halfway across", turn: 0.49, turnAfter: 2.5, turnAt: 0 },
    { name: "turns back at the far edge", turn: 0, turnAfter: 5, turnAt: 0.999999 },
  ])("draws whether a dart that turns back at half its kind's darts $name", (row) => {
    const draws = {
      count: 0,
      delays: [0, 0, 0] as const,
      lengths: [0.5, 0.5, 0.5, 0.5],
      share: 0,
      shy: 0.999999,
      side: 0,
      speed: 0.5,
      start: 0.999999,
      tilt: 0,
      turn: row.turn,
      turnAt: row.turnAt,
    };
    const placements = moverPlacements(geometry, spec(cross(3, 0, 0, 0.5)), draws);
    expect(placements).toHaveLength(2);
    for (const { path, screen } of placements) {
      // Crossing once, null, compares as -1.
      const turnAfter = path.motion === "cross" ? path.turnAfter : NaN;
      expect(turnAfter ?? -1).toBeCloseTo(row.turnAfter ?? -1, 3);
      const lanesPerPixel = path.motion === "cross" ? path.lanesPerPixel : NaN;
      const lanes = row.turnAfter === null ? geometry.laneCount : 2 * row.turnAfter;
      expect(screen[1] - screen[0]).toBeCloseTo(
        path.warning +
          Math.min(
            (lanes + 0.5) / lanesPerPixel,
            geometry.roadLength +
              geometry.cellLength -
              (path.motion === "cross" ? path.enterTravel : NaN),
          ),
        3,
      );
    }
  });

  // A dart's outcome draw, at the cat's shares: below its turn-back share it turns back, below
  // that and its stop share together it stops, and above both it crosses. A dart that stops
  // does so in the middle of the lane it draws from STOP_LANES, from the edge it enters from,
  // and stands there, coming down the road with it, until it scrolls off the road's bottom.
  const CAT = MINOR_OBSTACLES.cat.movement;
  const stopDraw = (lanes: number) =>
    (lanes - STOP_LANES.min + 0.5) / (STOP_LANES.max - STOP_LANES.min + 1);
  it.each([
    { name: "crosses", stopLanes: null, turn: CAT.turnBackShare + CAT.stopShare, turnAt: 0 },
    { name: "turns back", stopLanes: null, turn: 0, turnAt: 0 },
    ...Array.from(
      { length: STOP_LANES.max - STOP_LANES.min + 1 },
      (_, i) => STOP_LANES.min + i,
    ).map((lanes) => ({
      name: `stops after ${lanes} lanes`,
      stopLanes: lanes,
      turn: CAT.turnBackShare,
      turnAt: stopDraw(lanes),
    })),
  ])("draws a dart that $name", (row) => {
    const draws = {
      count: 0,
      delays: [0, 0, 0] as const,
      lengths: [0.5, 0.5, 0.5, 0.5],
      share: 0,
      shy: 0.999999,
      side: 0,
      speed: 0.5,
      start: 0,
      tilt: 0,
      turn: row.turn,
      turnAt: row.turnAt,
    };
    const motion = cross(3, 0, 0, CAT.turnBackShare, CAT.stopShare);
    const placements = moverPlacements(geometry, spec(motion), draws);
    expect(placements).toHaveLength(2);
    for (const { appears, path, screen } of placements) {
      if (path.motion !== "cross") {
        throw new Error("A dart crosses");
      }
      expect(path.turnAfter !== null).toBe(row.name === "turns back");
      expect(path.stopAfter).toBe(row.stopLanes === null ? null : row.stopLanes - 0.5);
      if (row.stopLanes === null) {
        continue;
      }
      const stopped = path.warning + (row.stopLanes - 0.5) / path.lanesPerPixel;
      const lane = path.direction === 1 ? row.stopLanes - 1 : geometry.laneCount - row.stopLanes;
      const left = screen[1] - appears;
      for (const since of [stopped, (stopped + left) / 2, left - 1]) {
        const place = moverPlace(geometry.laneCount, path, since);
        expect(place.lanePosition).toBeCloseTo(lane);
        expect(inMotion(path, since)).toBe(false);
        expect(moverTell(path, since)).toBeNull();
      }
      const gone = moverPlace(geometry.laneCount, path, left);
      expect(gone.travel).toBeCloseTo(geometry.roadLength + geometry.cellLength);
    }
  });

  // The outcome draw takes any shares adding up to at most 1, and a stop lane past the road's far
  // edge makes the dart cross.
  it.each([
    { draw: 0.49, outcome: "turn", stopShare: 0.5, turnBackShare: 0.5 },
    { draw: 0.5, outcome: "stop", stopShare: 0.5, turnBackShare: 0.5 },
    { draw: 0.999999, outcome: "stop", stopShare: 0.5, turnBackShare: 0.5 },
    { draw: 0, outcome: "stop", stopShare: 1, turnBackShare: 0 },
    { draw: 0.999999, outcome: "cross", stopShare: 0, turnBackShare: 0 },
  ])(
    "draws $outcome at $draw with shares $turnBackShare to turn back and $stopShare to stop",
    ({ draw, outcome, stopShare, turnBackShare }) => {
      expect(dartOutcome({ stopShare, turnBackShare }, draw)).toBe(outcome);
    },
  );

  it("crosses a dart whose stop lane is past the road's far edge", () => {
    const far = { max: geometry.laneCount + 1, min: geometry.laneCount + 1 };
    const placements = moverPlacements(geometry, spec({ ...cross(3, 0, 0, 0, 1), stopLanes: far }));
    expect(placements.length).toBeGreaterThan(0);
    for (const { path } of placements) {
      expect(path.motion === "cross" ? path.stopAfter : NaN).toBeNull();
    }
  });

  // Tilted away, a dart that stops comes down the road faster once stopped, so it sets off
  // higher than one that crosses to leave the pack its reaction time: 2s at 100px/s is 200px of
  // scroll. Crossing at tilt -0.5, that is 100px of road. Stopping a lane and a half across at 3
  // lanes a second, it covers 25px in its first 50px of scroll, then 150px in the rest.
  it.each([
    { enterTravel: 300, name: "crosses", stopShare: 0 },
    { enterTravel: 225, name: "stops", stopShare: 1 },
  ])(
    "starts a dart tilted away that $name no lower than leaves the pack its reaction time",
    (row) => {
      const motion = { ...cross(3, -0.5, -0.5, 0, row.stopShare), reactionSeconds: 2 };
      const [placement] = moverPlacements(geometry, spec(motion), {
        count: 0,
        delays: [0, 0, 0],
        lengths: [0.5, 0.5, 0.5, 0.5],
        share: 0,
        shy: 0.999999,
        side: 0,
        speed: 0.5,
        start: 0,
        tilt: 0,
        turn: 0,
        turnAt: 0,
      });
      const path = placement?.path;
      if (path?.motion !== "cross") {
        throw new Error("A dart crosses");
      }
      expect(path.enterTravel).toBeCloseTo(row.enterTravel);
      let since = path.warning;
      while (moverPlace(geometry.laneCount, path, since).travel < geometry.sightLength) {
        since += 1;
      }
      expect(since - path.warning).toBeGreaterThanOrEqual(200 - 1);
    },
  );

  it("needs an in-lane mover to move at another speed than the road", () => {
    expect(() => moverPlacements(geometry, spec({ kind: "ride", speedMultiplier: 1 }))).toThrow();
  });

  // A dart shows as its row comes on screen, or from the road's top where it starts farther up
  // the road than its row, waiting idle until its cue, its warning before it sets off. A rider's
  // cue shows from as soon as its row comes on screen, for at least its warning.
  it.each(
    SPECS.filter(({ spec: moving }) => ["cross", "ride"].includes(moving.motion.kind)).flatMap(
      ({ name, spec: moving }) => DRAW_ENDS.map(({ draws, end }) => ({ draws, end, moving, name })),
    ),
  )(
    "shows $name by the time its row comes on screen, at $end of its draws",
    ({ draws, moving }) => {
      const warning = moving.warningSeconds * geometry.scrollSpeed;
      for (const { appears, path } of moverPlacements(geometry, moving, draws)) {
        if (path.motion === "cross") {
          const atTop = moverPlace(geometry.laneCount, path, 0).travel;
          expect(path.warning - path.idle).toBeCloseTo(warning);
          expect(atTop).toBeGreaterThanOrEqual(-1e-9);
          expect(Math.min(Math.max(0, appears), atTop)).toBeCloseTo(0);
        } else {
          expect(path.warning).toBeGreaterThanOrEqual(warning);
          expect(appears).toBeLessThanOrEqual(1e-9);
        }
      }
    },
  );
});

describe("screenHasRoom", () => {
  // A mover on screen over [0, 10): darting, a slow vehicle, or neither.
  const dart: OnScreen = onScreenOf(crosser(1), [0, 10]);
  const slow: OnScreen = onScreenOf(rider(0.5), [0, 10]);
  const other: OnScreen = onScreenOf(rider(2), [0, 10]);
  const times = (count: number, mover: OnScreen) => Array.from({ length: count }, () => mover);
  const later = (mover: OnScreen): OnScreen => ({ ...mover, interval: [10, 20] });
  it("has room for a mover only under every cap", () => {
    for (const { mover, planned, room } of [
      { mover: other, name: "a mover on an empty screen", planned: [], room: true },
      {
        mover: other,
        name: "a mover beside one fewer than the cap",
        planned: times(CAPS.total - 1, other),
        room: true,
      },
      {
        mover: other,
        name: "a mover beside a full screen",
        planned: times(CAPS.total, other),
        room: false,
      },
      {
        mover: later(other),
        name: "a mover after a full screen",
        planned: times(CAPS.total, other),
        room: true,
      },
      {
        mover: dart,
        name: "a dart beside the darts' cap",
        planned: times(CAPS.darts, dart),
        room: false,
      },
      {
        mover: dart,
        name: "a dart beside one fewer than the darts' cap",
        planned: times(CAPS.darts - 1, dart),
        room: true,
      },
      {
        mover: other,
        name: "another mover beside the darts' cap",
        planned: times(CAPS.darts, dart),
        room: true,
      },
      {
        mover: slow,
        name: "a slow vehicle beside the slow vehicles' cap",
        planned: times(CAPS.slowVehicles, slow),
        room: false,
      },
      {
        mover: dart,
        name: "a dart beside the slow vehicles' cap",
        planned: times(CAPS.slowVehicles, slow),
        room: true,
      },
      {
        mover: { ...other, interval: [0, 30] },
        name: "a mover around a full screen's worth one after another",
        planned: Array.from({ length: CAPS.total }, (_, i) => ({
          ...other,
          interval: [10 * i, 10 * i + 10],
        })),
        room: true,
      },
    ] satisfies readonly {
      mover: OnScreen;
      name: string;
      planned: readonly OnScreen[];
      room: boolean;
    }[]) {
      expect(screenHasRoom(CAPS, planned, mover)).toBe(room);
    }
  });
});

describe("placeMovers", () => {
  const rows = Array.from({ length: 40 }, (_, i) => (i + 1) * 150);
  const zoned = { ...geometry, zoneLength: 6150 };
  // The cells taken, and of them those a dart holds.
  const freeGrid = () => {
    const taken = new Set<string>();
    const darts = new Set<string>();
    const blocked: { leadIn: boolean; row: number; rows: number; span: LaneSpan }[] = [];
    return {
      blocked,
      grid: {
        block: (row: number, span: LaneSpan, blockRows: number, leadIn: boolean, keep: boolean) => {
          if (keep) {
            blocked.push({ leadIn, row, rows: blockRows, span });
          }
          return true;
        },
        // Every lane equally clear, so start lanes are drawn evenly.
        clearRun: () => 1,
        isFree: (motion: MoverPath["motion"], lane: number, row: number) =>
          !(motion === "cross" ? darts : taken).has(`${lane},${row}`),
        keepsLeadIns: true,
        leavesRoom: () => true,
        occupy: () => undefined,
        packFits: () => true,
        stand: () => undefined,
        take: (dart: boolean, lane: number, row: number) => {
          taken.add(`${lane},${row}`);
          if (dart) {
            darts.add(`${lane},${row}`);
          }
        },
      },
      taken,
    };
  };

  it("places every mover wholly within the zone, within every cap on screen", () => {
    const { grid } = freeGrid();
    const { spawns } = placeMovers(
      plannerStreams(1),
      zoned,
      CAPS,
      grid,
      [],
      rows,
      SPECS.map(({ spec: moving }, i) => ({ count: 2, kind: `kind${i}`, spec: moving })),
    );
    expect(spawns.length).toBeGreaterThan(SPECS.length);
    const intervals = spawns.map(({ distance, mover }) => {
      let scroll = 0;
      for (; scroll < 5000; scroll++) {
        const place = moverPlace(5, mover, scroll);
        if (hasLeftRoad(5, place) || place.travel > geometry.roadLength + 2 * geometry.cellLength) {
          break;
        }
      }
      return onScreenOf(mover, [distance, distance + scroll]);
    });
    const caps: [number, (mover: OnScreen) => boolean][] = [
      [CAPS.total, () => true],
      [CAPS.darts, (mover) => mover.dart],
      [CAPS.slowVehicles, (mover) => mover.slowVehicle],
    ];
    for (const {
      interval: [start, end],
    } of intervals) {
      expect(start).toBeGreaterThanOrEqual(0);
      // Sampled a whole pixel of scroll at a time, so the end may be a pixel late.
      expect(end).toBeLessThanOrEqual(zoned.zoneLength + 1);
      for (const [cap, counted] of caps) {
        const atOnce = intervals.filter(
          (mover) => counted(mover) && mover.interval[0] <= start && start < mover.interval[1],
        ).length;
        expect(atOnce).toBeLessThanOrEqual(cap);
      }
    }
  });

  // A crosser that meets the pack takes every cell of its own row, and on a grid that keeps
  // lead-ins, as the lane-blocking movers' does, those of the row before too. A moving prize's
  // grid keeps none.
  it.each([
    { keepsLeadIns: true, rowsTaken: 2 },
    { keepsLeadIns: false, rowsTaken: 1 },
  ])(
    "blocks the lanes a crosser sweeps with its lead-in, taking $rowsTaken rows' cells (keepsLeadIns $keepsLeadIns)",
    ({ keepsLeadIns, rowsTaken }) => {
      const { blocked, grid, taken } = freeGrid();
      const [moving] = SPECS;
      const { spawns } = placeMovers(
        plannerStreams(2),
        zoned,
        CAPS,
        { ...grid, keepsLeadIns },
        [],
        rows,
        [
          {
            count: 1,
            kind: "squirrel",
            spec: moving?.spec ?? spec({ kind: "ride", speedMultiplier: 2 }),
          },
        ],
      );
      const [spawn] = spawns;
      expect(blocked).toHaveLength(1);
      expect(blocked[0]?.leadIn).toBe(true);
      expect(taken.size).toBe(rowsTaken * geometry.laneCount);
      const row = blocked[0]?.row ?? Number.NaN;
      const takenRows = new Set([...taken].map((cell) => Number(cell.split(",")[1])));
      expect([...takenRows].sort((a, b) => a - b)).toEqual(keepsLeadIns ? [row - 1, row] : [row]);
      expect(spawn?.lane).toBe(
        spawn?.mover.motion === "cross" && spawn.mover.direction === 1 ? 0 : geometry.laneCount - 1,
      );
    },
  );

  // Every cell of the grid already held, by a dart or by another spawn. A dart sets off over
  // cells another spawn holds; no mover takes a cell a dart holds, and no other mover takes a
  // held cell at all.
  it.each([
    { heldByDart: false, mover: "a dart", placed: true, spec: spec(cross(2, 0)) },
    { heldByDart: true, mover: "a dart", placed: false, spec: spec(cross(2, 0)) },
    {
      heldByDart: false,
      mover: "an in-lane mover",
      placed: false,
      spec: spec({ kind: "ride", speedMultiplier: 2 }),
    },
    {
      heldByDart: true,
      mover: "an in-lane mover",
      placed: false,
      spec: spec({ kind: "ride", speedMultiplier: 2 }),
    },
  ])(
    "places $mover over cells held by a dart ($heldByDart): $placed",
    ({ heldByDart, placed, spec: moving }) => {
      const { grid, taken } = freeGrid();
      for (let row = -geometry.laneCount; row < rows.length + geometry.laneCount; row++) {
        for (let lane = 0; lane < geometry.laneCount; lane++) {
          grid.take(heldByDart, lane, row);
        }
      }
      const held = taken.size;
      const { spawns } = placeMovers(plannerStreams(1), zoned, CAPS, grid, [], rows, [
        { count: 1, kind: "mover", spec: moving },
      ]);
      expect(spawns).toHaveLength(placed ? 1 : 0);
      expect(taken.size).toBe(held);
    },
  );

  // A dart placed first holds its cells: a second dart or another mover planned on the same rows
  // has no room, while one planned on the rows of an in-lane mover placed first sets off there.
  it.each([
    { first: "a dart", firstSpec: spec(cross(2, 0)), placed: 0, then: spec(cross(2, 0)) },
    {
      first: "a dart",
      firstSpec: spec(cross(2, 0)),
      placed: 0,
      then: spec({ kind: "ride", speedMultiplier: 2 }),
    },
    {
      first: "an in-lane mover",
      firstSpec: spec({ kind: "ride", speedMultiplier: 2 }),
      placed: 1,
      then: spec(cross(2, 0)),
    },
  ])("after $first, places $placed mover on its cells", ({ firstSpec, placed, then }) => {
    const { grid, taken } = freeGrid();
    placeMovers(plannerStreams(1), zoned, CAPS, grid, [], rows, [
      { count: 1, kind: "first", spec: firstSpec },
    ]);
    const firstCells = new Set(taken);
    const onlyFirstRows = (row: number) => [...firstCells].some((cell) => cell.endsWith(`,${row}`));
    const { spawns } = placeMovers(
      plannerStreams(2),
      zoned,
      CAPS,
      { ...grid, block: (row, ...rest) => onlyFirstRows(row) && grid.block(row, ...rest) },
      [],
      rows,
      [{ count: 1, kind: "then", spec: then }],
    );
    expect(spawns).toHaveLength(placed);
  });

  it("drops a mover the grid refuses everywhere, drawing only its own draws", () => {
    for (const [, refusal] of [
      ["blocks", { block: () => false }],
      ["has no room for", { leavesRoom: () => false }],
      ["leaves no pack-fit gap for", { packFits: () => false }],
    ] as const) {
      const { grid } = freeGrid();
      const counted = () => {
        const draws = { movers: 0, spawns: 0 };
        const counter = (stream: keyof typeof draws) => () => {
          draws[stream] += 1;
          return 0;
        };
        return { draws, streams: { movers: counter("movers"), spawns: counter("spawns") } };
      };
      const placing = counted();
      const placed = placeMovers(placing.streams, zoned, CAPS, { ...grid, ...refusal }, [], rows, [
        { count: 1, kind: "squirrel", spec: spec(cross(2, 0)) },
      ]);
      expect(placed).toEqual({ dropped: ["squirrel"], spawns: [] });
      const own = counted();
      drawMover(own.streams);
      expect(placing.draws).toEqual(own.draws);
    }
  });

  // Three movers, one per third of the rows (0 to 12, 13 to 25, 26 to 39). One with no room in
  // its own third, such as one over a cap there, comes on at the nearest later row with room,
  // never an earlier one, and is dropped when no later row has room.
  it.each([
    { dropped: 0, firstRefused: 13, lastRefused: 25, name: "the middle third", nearest: 26 },
    { dropped: 0, firstRefused: 13, lastRefused: 29, name: "rows 13 to 29", nearest: 30 },
    { dropped: 2, firstRefused: 13, lastRefused: 39, name: "the last two thirds", nearest: null },
  ])(
    "places a mover refused $name at the nearest later row with room, or drops it",
    ({ dropped, firstRefused, lastRefused, nearest }) => {
      const refused = (row: number) => row >= firstRefused && row <= lastRefused;
      const { blocked, grid } = freeGrid();
      const placed = placeMovers(
        plannerStreams(3),
        zoned,
        CAPS,
        { ...grid, block: (row, ...rest) => !refused(row) && grid.block(row, ...rest) },
        [],
        rows,
        [{ count: 3, kind: "car", spec: spec({ kind: "ride", speedMultiplier: 2 }) }],
      );
      expect(placed.dropped).toHaveLength(dropped);
      expect(placed.spawns).toHaveLength(3 - dropped);
      expect(blocked.map(({ row }) => refused(row))).not.toContain(true);
      if (nearest !== null) {
        expect(blocked[1]?.row).toBe(nearest);
      }
      blocked.forEach(({ row }, i) => {
        expect(row).toBeGreaterThanOrEqual(Math.floor((i * rows.length) / 3));
      });
    },
  );

  // Drawn at 0, a dart at 3 lanes a second sets off as low as it may and sweeps 4 lanes in the
  // pack's window; lifted 0.25, 0.5, 0.75 and 1 of the way to its cue's limit it sweeps 3, 1, 0
  // and 0. With no row fitting a dart that sweeps more than some lanes, as the grid refuses its
  // lanes or the pack-fit gap its stands, it sets off at the lowest lift that fits, and one that
  // fits as drawn is not lifted. A lift uses no random draw.
  it.each(
    [
      { lift: 0, most: 4 },
      { lift: 0.25, most: 3 },
      { lift: 0.5, most: 2 },
      { lift: 0.5, most: 1 },
      { lift: 0.75, most: 0 },
    ].flatMap((row) => [
      { ...row, refused: "lanes" as const },
      { ...row, refused: "stands" as const },
    ]),
  )(
    "sets off a dart at a lift of $lift when no row fits its $refused over $most lanes",
    ({ lift, most, refused }) => {
      const moving = spec(cross(3, 0));
      // Every draw 0, counted.
      const place = (grid: Parameters<typeof placeMovers>[3]) => {
        const draws = { movers: 0, spawns: 0 };
        const counter = (stream: keyof typeof draws) => () => {
          draws[stream] += 1;
          return 0;
        };
        const streams = { movers: counter("movers"), spawns: counter("spawns") };
        const { spawns } = placeMovers(streams, zoned, CAPS, grid, [], rows, [
          { count: 1, kind: "squirrel", spec: moving },
        ]);
        return { draws, spawns };
      };
      const { grid } = freeGrid();
      const refusal =
        refused === "lanes"
          ? {
              block: (row: number, span: LaneSpan, ...rest: [number, boolean, boolean]) =>
                span.count <= most && grid.block(row, span, ...rest),
            }
          : {
              packFits: (stands: readonly MoverStand[]) =>
                stands.every(({ lanes }) => lanes <= most),
            };
      const placed = place({ ...grid, ...refusal });
      const draws = drawMover({ movers: () => 0, spawns: () => 0 });
      const lifted = moverPlacements(geometry, moving, draws, lift).map(({ path }) => path);
      expect(placed.spawns).toHaveLength(1);
      expect(lifted).toContainEqual(placed.spawns[0]?.mover);
      expect(placed.draws).toEqual(place(freeGrid().grid).draws);
    },
  );
});
