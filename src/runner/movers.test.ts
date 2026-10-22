import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning";
import { read } from "../rules/units";
import { plannerStreams } from "../testing/movers";
import {
  drawMover,
  drawnCount,
  facesLeft,
  hasLeftRoad,
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
  type MoverTell,
  moverTell,
  type OnScreen,
  onScreenOf,
  placeMovers,
  screenHasRoom,
  stepSpots,
  sweptLanes,
} from "./movers";
import { moverOutcomes } from "./outcomes";

// 100px/s: a 1s warning is 100px, and a crosser at 2 lanes a second crosses 0.02 lanes a pixel.
const geometry: MoverGeometry = {
  cellLength: 50,
  laneCount: 5,
  packLength: 40,
  roadLength: 600,
  rowSpacing: 150,
  scrollSpeed: 100,
  sightLength: 400,
  window: 100,
};
const crosser = (direction: 1 | -1, tilt = 0, turnAfter: number | null = null): MoverPath => ({
  direction,
  enterTravel: 300,
  lanesPerPixel: 0.02,
  motion: "cross",
  movement: "dart",
  tilt,
  turnAfter,
  warning: 100,
});
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
  variation: { delaySeconds: 0, speedShare: 0 },
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
      { moving: true, name: "a crosser on its way", path: crosser(1), since: 100, tell: null },
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
        want: { count: 3, first: 2 },
      },
      {
        from: 500,
        name: "a crosser leaving",
        path: crosser(1),
        to: 700,
        want: { count: 1, first: 4 },
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
        want: { count: 3, first: 1 },
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

// A mover's draws with no delay at its kind's speed, and the count, a dart's start, tilt and turn
// at the low end of their ranges (the fewest moves, the lowest start and tilt, turning halfway),
// there and shy, or at the high end (turning at the far edge). A dart of a kind that turns back
// turns at each end.
const DRAW_ENDS: readonly { draws: MoverDraws; end: string }[] = [
  {
    draws: {
      count: 0,
      delays: [0, 0, 0],
      share: 0,
      shy: 0.999999,
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
      share: 0,
      shy: 0,
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
      share: 0,
      shy: 0.999999,
      speed: 0.5,
      start: 0.999999,
      tilt: 0.999999,
      turn: 0,
      turnAt: 0.999999,
    },
    end: "the high end",
  },
];

// A crosser that sets off from 0.1 to 0.9 of the road ahead of the pack, leaving the pack half a
// second after its cue, at a tilt drawn from min to max, turning back at turnBackShare of them
// from halfway to all the way across.
const cross = (
  lanesPerSecond: number,
  min: number,
  max = min,
  turnBackShare = 0,
): MoverSpec["motion"] => ({
  kind: "cross",
  lanesPerSecond,
  reactionSeconds: 0.5,
  startRoadShare: [0.1, 0.9],
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
      sequences: [...hopSequences(2, false, 1), ...hopSequences(2, false, 2)],
      stepSeconds: 0.3,
    }),
  },
  {
    name: "a sideways hopper",
    spec: spec({
      count: { max: 2, min: 1 },
      kind: "steps",
      sequences: [...hopSequences(2, true, 1), ...hopSequences(2, true, 2)],
      stepSeconds: 0.3,
    }),
  },
  {
    name: "a hopper of a shy kind",
    spec: spec({
      count: { max: 2, min: 1 },
      kind: "steps",
      sequences: [...hopSequences(2, false, 1), ...hopSequences(2, false, 2)],
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
              share: 0,
              shy,
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
        share: 0,
        shy: 0.999999,
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
  // must fit above the start.
  it.each([
    { draw: 0, motion: cross(3, 0), name: "untilted", tilt: 0 },
    { draw: 0, motion: cross(3, 0.1, 0.7), name: "at its lowest tilt", tilt: 0.1 },
    { draw: 0.999999, motion: cross(3, 0.1, 0.7), name: "at its highest tilt", tilt: 0.7 },
    // At 100px/s a start at most 0.625 of the road ahead leaves half a second at tilt 4 at most.
    {
      draw: 0.999999,
      motion: cross(3, 0.1, 10),
      name: "at a tilt cut to the steepest the road allows",
      tilt: 4,
    },
  ])(
    "starts a dart $name no lower than leaves the pack its reaction time, nor higher than shows its cue",
    ({ draw, motion, tilt }) => {
      const ends = [0, 0.999999].map((start) => {
        const [placement] = moverPlacements(geometry, spec(motion), {
          count: 0,
          delays: [0, 0, 0],
          share: 0,
          shy: 0.999999,
          speed: 0.5,
          start,
          tilt: draw,
          turn: 0.999999,
          turnAt: 0,
        });
        return placement?.path.motion === "cross" ? placement.path.enterTravel : NaN;
      });
      const { cellLength, scrollSpeed, sightLength } = geometry;
      const [low, high] = ends;
      expect(low).toBeCloseTo(sightLength - 0.5 * scrollSpeed * (1 + tilt), 3);
      expect(high).toBeCloseTo(scrollSpeed + cellLength);
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
      share: 0,
      shy: 0.999999,
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

  it("needs an in-lane mover to move at another speed than the road", () => {
    expect(() => moverPlacements(geometry, spec({ kind: "ride", speedMultiplier: 1 }))).toThrow();
  });
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
  const freeGrid = () => {
    const taken = new Set<string>();
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
        isFree: (lane: number, row: number) => !taken.has(`${lane},${row}`),
        leavesRoom: () => true,
        packFits: () => true,
        stand: () => undefined,
        take: (lane: number, row: number) => {
          taken.add(`${lane},${row}`);
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

  it("blocks the lanes a crosser sweeps with its lead-in, and takes the cells it keeps clear", () => {
    const { blocked, grid, taken } = freeGrid();
    const [moving] = SPECS;
    const { spawns } = placeMovers(plannerStreams(2), zoned, CAPS, grid, [], rows, [
      {
        count: 1,
        kind: "squirrel",
        spec: moving?.spec ?? spec({ kind: "ride", speedMultiplier: 2 }),
      },
    ]);
    const [spawn] = spawns;
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.leadIn).toBe(true);
    expect(taken.size).toBe(2 * geometry.laneCount);
    expect(spawn?.lane).toBe(
      spawn?.mover.motion === "cross" && spawn.mover.direction === 1 ? 0 : geometry.laneCount - 1,
    );
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

  // Three movers, one per third of the rows. One with no room in its own third, such as one over
  // a cap there, comes on at a later row with room, never an earlier one, and is dropped when no
  // later row has room.
  it("waits for a later row, or drops, a mover with no room in part of the zone", () => {
    for (const refusal of [
      { dropped: 0, name: "the middle third", refused: (row: number) => row >= 13 && row < 26 },
      { dropped: 2, name: "the last two thirds", refused: (row: number) => row >= 13 },
    ]) {
      const { blocked, grid } = freeGrid();
      const placed = placeMovers(
        plannerStreams(3),
        zoned,
        CAPS,
        { ...grid, block: (row, ...rest) => !refusal.refused(row) && grid.block(row, ...rest) },
        [],
        rows,
        [{ count: 3, kind: "car", spec: spec({ kind: "ride", speedMultiplier: 2 }) }],
      );
      expect(placed.dropped).toHaveLength(refusal.dropped);
      expect(placed.spawns).toHaveLength(3 - refusal.dropped);
      blocked.forEach(({ row }, i) => {
        expect(refusal.refused(row)).toBe(false);
        expect(row).toBeGreaterThanOrEqual(Math.floor((i * rows.length) / 3));
      });
    }
  });
});
