import { describe, expect, it } from "vitest";

import {
  hasLeftRoad,
  inMotion,
  isWarning,
  laneAt,
  type LaneSpan,
  moveMovers,
  type MoverGeometry,
  type MoverItem,
  type MoverPath,
  moverPlace,
  moverPlacements,
  MOVERS_ON_SCREEN_MAX,
  type MoverSpec,
  type MoverTell,
  moverTell,
  placeMovers,
  screenHasRoom,
  sweptLanes,
} from "./movers";
import { seededRandom } from "./random";

// 100px/s: a 1s warning is 100px, and a crosser at 2 lanes a second crosses 0.02 lanes a pixel.
const geometry: MoverGeometry = {
  cellLength: 50,
  laneCount: 5,
  roadLength: 600,
  rowSpacing: 150,
  scrollSpeed: 100,
  sightLength: 400,
  window: 100,
};
const crosser = (direction: 1 | -1, tilt = 0): MoverPath => ({
  direction,
  enterTravel: 300,
  lanesPerPixel: 0.02,
  motion: "cross",
  movement: "dart",
  mover: "squirrel",
  tilt,
  warning: 100,
});
const rider = (speedMultiplier: number): MoverPath => ({
  lane: 3,
  lanes: 1,
  motion: "ride",
  movement: "inLane",
  mover: "cyclist",
  speedMultiplier,
  warning: 100,
});
// A step a lane right at 100, then a row toward the pack at 300, each 50px long.
const stepper: MoverPath = {
  lane: 2,
  motion: "steps",
  movement: "step",
  mover: "thief",
  steps: [
    { at: 100, lanes: 1, length: 50, travel: 0 },
    { at: 300, lanes: 0, length: 50, travel: 50 },
  ],
  warning: 100,
};
const spec = (motion: MoverSpec["motion"], lanes = 1, rows = 1): MoverSpec => ({
  footprint: { lanes, rows },
  motion,
  movement: motion.kind === "cross" ? "dart" : motion.kind === "ride" ? "inLane" : "step",
  mover: "mover",
  warningSeconds: 1,
});

describe("moverPlace", () => {
  it.each<{ name: string; path: MoverPath; since: number; want: ReturnType<typeof moverPlace> }>([
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
  ])("places $name", ({ path, since, want }) => {
    expect(moverPlace(5, path, since)).toEqual(want);
  });
});

describe("moverTell and inMotion", () => {
  it.each<{
    moving: boolean;
    name: string;
    path: MoverPath;
    since: number;
    tell: MoverTell | null;
  }>([
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
  ])("cues $name", ({ moving, path, since, tell }) => {
    expect(moverTell(path, since)).toEqual(tell);
    expect(inMotion(path, since)).toBe(moving);
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
  it.each<{ from: number; name: string; path: MoverPath; to: number; want: LaneSpan }>([
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
    { from: 0, name: "a rider", path: rider(2), to: 1000, want: { count: 1, first: 3 } },
  ])("is every lane $name touches, clipped to the road", ({ from, path, to, want }) => {
    expect(sweptLanes(5, path, from, to)).toEqual(want);
  });
});

// Each motion, footprint and tilt the planner meets, as a spec.
const SPECS: readonly { name: string; spec: MoverSpec }[] = [
  { name: "a dart", spec: spec({ kind: "cross", lanesPerSecond: 2, tilt: 0 }) },
  {
    name: "a dart tilted toward the pack",
    spec: spec({ kind: "cross", lanesPerSecond: 3, tilt: 0.3 }),
  },
  { name: "a dart tilted away", spec: spec({ kind: "cross", lanesPerSecond: 3, tilt: -0.3 }) },
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
      ],
      stepSeconds: 0.5,
    }),
  },
];

describe("moverPlacements", () => {
  // Wherever it is placed, a mover touches the pack only within what its placement blocks: in
  // its lanes, from its row's window for as long as its rows' blocking length.
  it.each(SPECS)("keeps $name within the lanes and rows it blocks", ({ spec: moving }) => {
    const { cellLength, sightLength, window } = geometry;
    const { lanes: across, rows } = moving.footprint;
    const placements = moverPlacements(geometry, moving);
    expect(placements.length).toBeGreaterThan(0);
    for (const placement of placements) {
      const blocked = window + (placement.rows - 1) * cellLength;
      const reach = window + (rows - 1) * cellLength;
      for (let since = 0; since < 4000; since += 1) {
        const place = moverPlace(geometry.laneCount, placement.path, since);
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
  });

  it("needs an in-lane mover to move at another speed than the road", () => {
    expect(() => moverPlacements(geometry, spec({ kind: "ride", speedMultiplier: 1 }))).toThrow();
  });
});

describe("screenHasRoom", () => {
  // Intervals already planned, the one asked about, and whether it fits under the cap.
  const full = Array.from({ length: MOVERS_ON_SCREEN_MAX }, () => [0, 10] as const);
  it.each<{
    interval: readonly [number, number];
    name: string;
    planned: readonly (readonly [number, number])[];
    room: boolean;
  }>([
    { interval: [0, 10], name: "an empty screen", planned: [], room: true },
    { interval: [10, 20], name: "after a full screen", planned: full, room: true },
    { interval: [9, 20], name: "overlapping a full screen", planned: full, room: false },
    {
      interval: [0, 30],
      name: "around movers one after another",
      planned: [
        [0, 10],
        [10, 20],
        [20, 30],
      ],
      room: true,
    },
  ])("is $room for $name", ({ interval, planned, room }) => {
    expect(screenHasRoom(planned, interval)).toBe(room);
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

  it(`places every mover wholly within the zone, at most ${MOVERS_ON_SCREEN_MAX} on screen at once`, () => {
    const { grid } = freeGrid();
    const { spawns } = placeMovers(
      seededRandom(1),
      zoned,
      grid,
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
      return [distance, distance + scroll] as const;
    });
    for (const [start, end] of intervals) {
      expect(start).toBeGreaterThanOrEqual(0);
      // Sampled a whole pixel of scroll at a time, so the end may be a pixel late.
      expect(end).toBeLessThanOrEqual(zoned.zoneLength + 1);
      const atOnce = intervals.filter(([from, to]) => from <= start && start < to).length;
      expect(atOnce).toBeLessThanOrEqual(MOVERS_ON_SCREEN_MAX);
    }
  });

  it("blocks the lanes a crosser sweeps with its lead-in, and takes the cells it keeps clear", () => {
    const { blocked, grid, taken } = freeGrid();
    const [moving] = SPECS;
    const { spawns } = placeMovers(seededRandom(2), zoned, grid, rows, [
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

  it.each([
    ["blocks", { block: () => false }],
    ["has no room for", { leavesRoom: () => false }],
    ["leaves no pack-fit gap for", { packFits: () => false }],
  ])("skips a mover the grid %s everywhere, drawing nothing", (_, refusal) => {
    const { grid } = freeGrid();
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0;
    };
    const placed = placeMovers(counting, zoned, { ...grid, ...refusal }, rows, [
      { count: 1, kind: "squirrel", spec: spec({ kind: "cross", lanesPerSecond: 2, tilt: 0 }) },
    ]);
    expect(placed).toEqual({ skipped: ["squirrel"], spawns: [] });
    expect(draws).toBe(0);
  });
});
