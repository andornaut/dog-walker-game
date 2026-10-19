import { describe, expect, it } from "vitest";

import {
  hasLeftRoad,
  isMoverObstacle,
  isWarning,
  laneAt,
  type LaneSpan,
  moveMovers,
  type MoverGeometry,
  type MoverItem,
  type MoverPath,
  moverPlace,
  moverPlacements,
  type MoverSpec,
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
const crosser = (direction: 1 | -1): MoverPath => ({
  direction,
  enterTravel: 300,
  lanesPerPixel: 0.02,
  motion: "cross",
  mover: "squirrel",
  warning: 100,
});
const rider: MoverPath = {
  lane: 3,
  motion: "ride",
  mover: "cyclist",
  speedMultiplier: 2,
  warning: 100,
};
const squirrelSpec: MoverSpec = {
  motion: { kind: "cross", lanesPerSecond: 2 },
  mover: "squirrel",
  warningSeconds: 1,
};
const cyclistSpec: MoverSpec = {
  motion: { kind: "ride", speedMultiplier: 2 },
  mover: "cyclist",
  warningSeconds: 1,
};

describe("moverPlace", () => {
  it("keeps a crosser's cue on its row at the edge it enters from until the warning ends", () => {
    expect(moverPlace(5, crosser(1), 40)).toEqual({
      lanePosition: -0.5,
      moving: false,
      travel: 240,
    });
    expect(moverPlace(5, crosser(-1), 0)).toEqual({
      lanePosition: 4.5,
      moving: false,
      travel: 200,
    });
  });

  it("runs a crosser across the lanes at its pace, keeping step with the road", () => {
    expect(moverPlace(5, crosser(1), 150)).toEqual({
      lanePosition: 0.5,
      moving: true,
      travel: 350,
    });
    expect(moverPlace(5, crosser(-1), 200)).toEqual({
      lanePosition: 2.5,
      moving: true,
      travel: 400,
    });
  });

  it("holds a rider at the top of its lane, then brings it down faster than the road", () => {
    expect(moverPlace(5, rider, 50)).toEqual({ lanePosition: 3, moving: false, travel: 0 });
    expect(moverPlace(5, rider, 150)).toEqual({ lanePosition: 3, moving: true, travel: 100 });
  });
});

describe("laneAt and hasLeftRoad", () => {
  it("puts a lane position in the lane whose half-lane span holds it", () => {
    expect([-0.6, -0.5, 0.49, 0.5, 4.49, 4.5].map(laneAt)).toEqual([-1, 0, 0, 1, 4, 5]);
  });

  it("drops a crosser half a lane past either edge", () => {
    const at = (lanePosition: number) => ({ lanePosition, moving: true, travel: 0 });
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

  it("tells a cue from a mover that moves", () => {
    expect(isWarning(5, item({ path: crosser(1), since: 99 }))).toBe(true);
    expect(isWarning(5, item({ path: crosser(1), since: 100 }))).toBe(false);
    expect(isWarning(5, item())).toBe(false);
  });
});

describe("isMoverObstacle", () => {
  it("is true only for the movers that are minor obstacles", () => {
    expect(["ball", "cyclist", "squirrel", "otherDog", "cone"].map(isMoverObstacle)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe("sweptLanes", () => {
  it("is every lane a crosser passes between two travels, clipped to the road", () => {
    expect(sweptLanes(5, crosser(1), 300, 400)).toEqual({ count: 3, first: 0 });
    expect(sweptLanes(5, crosser(-1), 350, 450)).toEqual({ count: 3, first: 2 });
    expect(sweptLanes(5, crosser(1), 500, 700)).toEqual({ count: 1, first: 4 });
  });

  it("is no lane before a crosser moves or after it has left", () => {
    expect(sweptLanes(5, crosser(1), 100, 300)).toEqual({ count: 0, first: 0 });
    expect(sweptLanes(5, crosser(1), 600, 700).count).toBe(0);
  });

  it("is a rider's own lane", () => {
    expect(sweptLanes(5, rider, 0, 1000)).toEqual({ count: 1, first: 3 });
  });
});

// Every lane a placement's mover is in while it overlaps the pack, and the scrolls past its
// row's distance over which it does, walking the road a pixel of scroll at a time.
function packContact(placement: ReturnType<typeof moverPlacements>[number]) {
  const lanes = new Set<number>();
  const scrolls: number[] = [];
  for (let scroll = placement.appears; scroll < placement.screen[1]; scroll++) {
    const place = moverPlace(5, placement.path, scroll - placement.appears);
    const lane = laneAt(place.lanePosition);
    const overlaps =
      place.travel >= geometry.sightLength && place.travel < geometry.sightLength + geometry.window;
    if (place.moving && overlaps && lane >= 0 && lane < 5 && !hasLeftRoad(5, place)) {
      lanes.add(lane);
      scrolls.push(scroll);
    }
  }
  return { lanes: [...lanes].sort(), scrolls };
}

describe("moverPlacements", () => {
  const spanLanes = ({ count, first }: { count: number; first: number }) =>
    Array.from({ length: count }, (_, i) => first + i);

  it("reserves every lane a crosser touches while it overlaps the pack, within its row's window", () => {
    const placements = moverPlacements(geometry, squirrelSpec);
    expect(placements.length).toBeGreaterThan(4);
    for (const placement of placements) {
      const contact = packContact(placement);
      expect(contact.lanes.every((lane) => spanLanes(placement.lanes).includes(lane))).toBe(true);
      expect(Math.min(...contact.scrolls)).toBeGreaterThanOrEqual(geometry.sightLength);
      expect(Math.max(...contact.scrolls)).toBeLessThan(geometry.sightLength + geometry.window);
    }
  });

  it("shows a crosser's cue on the road a full second before it moves", () => {
    for (const placement of moverPlacements(geometry, squirrelSpec)) {
      expect(moverPlace(5, placement.path, 0).travel).toBeGreaterThanOrEqual(geometry.cellLength);
      expect(placement.path.warning).toBe(100);
    }
  });

  it("keeps a crosser's row and its lead-in clear across the road, and enters from both edges", () => {
    const placements = moverPlacements(geometry, squirrelSpec);
    const across = (row: number) => [0, 1, 2, 3, 4].map((lane) => ({ lane, row }));
    for (const placement of placements) {
      expect(placement.cells).toEqual([...across(-1), ...across(0)]);
      expect(placement.leadIn).toBe(true);
    }
    const sides = new Set(placements.map(({ path }) => path.motion === "cross" && path.direction));
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it("brings a rider to the pack in its own lane within its row's window", () => {
    const placements = moverPlacements(geometry, cyclistSpec);
    expect(placements.map(({ lanes }) => lanes.first)).toEqual([0, 1, 2, 3, 4]);
    for (const placement of placements) {
      const contact = packContact(placement);
      expect(contact.lanes).toEqual([placement.lanes.first]);
      expect(Math.min(...contact.scrolls)).toBeGreaterThanOrEqual(geometry.sightLength);
      expect(Math.max(...contact.scrolls)).toBeLessThan(geometry.sightLength + geometry.window);
    }
  });

  it("keeps a rider's lane clear in the rows it overtakes", () => {
    const [placement] = moverPlacements(geometry, cyclistSpec);
    // It enters as its row has travelled 200px and leaves 325px of scroll later: from 200px
    // ahead of its row to 125px behind it.
    expect(placement?.cells).toEqual([-1, 0, 1, 2].map((row) => ({ lane: 0, row })));
    expect(placement?.leadIn).toBe(false);
  });

  it("needs a rider to be faster than the road", () => {
    const slow = { ...cyclistSpec, motion: { kind: "ride", speedMultiplier: 1 } } as const;
    expect(() => moverPlacements(geometry, slow)).toThrow(/faster/);
  });
});

describe("screenHasRoom", () => {
  it("allows one mover on screen at a time", () => {
    expect(screenHasRoom([], [0, 10])).toBe(true);
    expect(screenHasRoom([[0, 10]], [10, 20])).toBe(true);
    expect(screenHasRoom([[0, 10]], [9, 20])).toBe(false);
    expect(screenHasRoom([[5, 6]], [0, 10])).toBe(false);
  });
});

describe("placeMovers", () => {
  const rows = Array.from({ length: 40 }, (_, i) => (i + 1) * 150);
  const zoned = { ...geometry, zoneLength: 6150 };
  const freeGrid = () => {
    const taken = new Set<string>();
    const blocked: { leadIn: boolean; row: number; span: LaneSpan }[] = [];
    return {
      blocked,
      grid: {
        block: (row: number, span: LaneSpan, leadIn: boolean, keep: boolean) => {
          if (keep) {
            blocked.push({ leadIn, row, span });
          }
          return true;
        },
        isFree: (lane: number, row: number) => !taken.has(`${lane},${row}`),
        leavesRoom: () => true,
        take: (lane: number, row: number) => {
          taken.add(`${lane},${row}`);
        },
      },
      taken,
    };
  };

  it("places each mover with the screen to itself, wholly within the zone", () => {
    const { grid } = freeGrid();
    const spawns = placeMovers(seededRandom(1), zoned, grid, rows, [
      { count: 3, kind: "squirrel", spec: squirrelSpec },
      { count: 3, kind: "cyclist", spec: cyclistSpec },
    ]);
    expect(spawns.map(({ kind }) => kind)).toEqual([
      "squirrel",
      "squirrel",
      "squirrel",
      "cyclist",
      "cyclist",
      "cyclist",
    ]);
    // Each is on screen from its cue until it has left the road or passed its bottom.
    const intervals = spawns.map(({ distance, mover }) => {
      let scroll = 0;
      for (; scroll < 5000; scroll++) {
        const place = moverPlace(5, mover, scroll);
        if (hasLeftRoad(5, place) || place.travel > geometry.roadLength) {
          break;
        }
      }
      return [distance, distance + scroll] as const;
    });
    for (const [i, [start, end]] of intervals.entries()) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(zoned.zoneLength);
      intervals.slice(i + 1).forEach(([from, to]) => expect(from >= end || to <= start).toBe(true));
    }
  });

  it("blocks the lanes it sweeps with its lead-in, and takes the cells it keeps clear", () => {
    const { blocked, grid, taken } = freeGrid();
    const [spawn] = placeMovers(seededRandom(2), zoned, grid, rows, [
      { count: 1, kind: "squirrel", spec: squirrelSpec },
    ]);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.leadIn).toBe(true);
    expect(taken.size).toBe(10);
    const row = blocked[0]?.row ?? -1;
    expect(taken.has(`0,${row - 1}`) && taken.has(`4,${row}`)).toBe(true);
    expect(spawn?.lane).toBe(
      spawn?.mover.motion === "cross" && spawn.mover.direction === 1 ? 0 : 4,
    );
  });

  it.each([
    ["blocks", { block: () => false }],
    ["has no room for", { leavesRoom: () => false }],
  ])("skips a mover the grid %s everywhere, drawing nothing", (_, refusal) => {
    const { grid } = freeGrid();
    const refusing = { ...grid, ...refusal };
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0;
    };
    const spawns = placeMovers(counting, zoned, refusing, rows, [
      { count: 1, kind: "squirrel", spec: squirrelSpec },
    ]);
    expect(spawns).toEqual([]);
    expect(draws).toBe(0);
  });

  it("skips the movers a zone cannot give the screen to themselves", () => {
    const { grid } = freeGrid();
    const spawns = placeMovers(
      seededRandom(1),
      { ...zoned, zoneLength: 1200 },
      grid,
      rows.slice(0, 7),
      [{ count: 3, kind: "squirrel", spec: squirrelSpec }],
    );
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.length).toBeLessThan(3);
  });
});
