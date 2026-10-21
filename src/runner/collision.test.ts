import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { testState } from "../testing/runState";
import {
  type Box,
  collideWithPack,
  type DogBox,
  dogsTouching,
  itemBox,
  overlaps,
  tickInvulnerability,
} from "./collision";
import { stillInLane } from "./laneMotion";
import type { RoadItem } from "./roadItems";
import { dogBoxes } from "./walk";

type Kind = "obstacle" | "tip";

const rules = {
  graced: (item: RoadItem<Kind>) => item.kind === "obstacle",
  invulnerabilitySeconds: 1,
  startsInvulnerability: () => true,
};
const CELL = { inset: 8, length: 64 };
// One dog box in lane 2, and one halfway between lanes 2 and 3, as mid-move.
const box = (centreX: number, dog = "koda"): DogBox => ({
  bottom: 600,
  dog,
  left: centreX - 20,
  right: centreX + 20,
  top: 560,
});
const stillBoxes = [box(160)];
const midMoveBoxes = [box(192)];
const touchingWith = (boxes: readonly DogBox[]) => (hit: RoadItem<Kind>) =>
  dogsTouching(boxes, itemBox(CELL, hit));
const still = touchingWith(stillBoxes);
const midMove = touchingWith(midMoveBoxes);

const item = (id: number, kind: Kind, lane: number, y: number, laneSpan = 1): RoadItem<Kind> => ({
  height: 32,
  id,
  kind,
  lane,
  laneSpan,
  y,
});

describe("overlaps", () => {
  const a: Box = { bottom: 10, left: 0, right: 10, top: 0 };
  it.each<[string, Box, boolean]>([
    ["sharing area", { bottom: 15, left: 5, right: 15, top: 5 }, true],
    ["only meeting at an edge", { bottom: 10, left: 10, right: 20, top: 0 }, false],
    ["apart", { bottom: 10, left: 11, right: 20, top: 0 }, false],
  ])("boxes %s: %s", (_, b, expected) => {
    expect(overlaps(a, b)).toBe(expected);
    expect(overlaps(b, a)).toBe(expected);
  });
});

describe("dogsTouching", () => {
  // The item's box spans y to y + 32; the dog's, 560 to 600.
  it.each([
    { touches: false, where: "ending on the box's top", y: 528 },
    { touches: true, where: "reaching into the box", y: 529 },
    { touches: true, where: "starting just above the box's bottom", y: 599 },
    { touches: false, where: "starting on the box's bottom", y: 600 },
  ])("touches an item in the dog's lane $where: $touches", ({ touches, y }) => {
    expect(still(item(1, "tip", 2, y))).toEqual(touches ? ["koda"] : []);
  });

  it("touches an item spanning several lanes in any of them", () => {
    expect(still(item(1, "obstacle", 0, 570, 3))).toEqual(["koda"]);
    expect(still(item(1, "obstacle", 2, 570, 2))).toEqual(["koda"]);
    expect(still(item(1, "obstacle", 0, 570, 2))).toEqual([]);
    expect(still(item(1, "obstacle", 3, 570, 2))).toEqual([]);
  });

  it("touches items only in the dog's lane, both lanes while it is between them", () => {
    expect(still(item(1, "tip", 3, 570))).toEqual([]);
    expect(midMove(item(1, "tip", 2, 570))).toEqual(["koda"]);
    expect(midMove(item(2, "tip", 3, 570))).toEqual(["koda"]);
    expect(midMove(item(3, "tip", 1, 570))).toEqual([]);
  });

  it("lists every dog touching, in pack order", () => {
    const pair = [box(150, "koda"), box(170, "biscuit")];
    expect(dogsTouching(pair, itemBox(CELL, item(1, "tip", 2, 570)))).toEqual(["koda", "biscuit"]);
  });
});

describe("a settled pack's hit boxes", () => {
  const geometry = {
    cell: { inset: 12, length: SCREEN_CONFIG.roadWidth / LANE_COUNT },
    laneCount: LANE_COUNT,
    walkerFootY: 634,
  };
  const DOGS: DogId[] = ["koda", "biscuit", "zippy"];
  const packOf = (count: number) =>
    testState(Object.fromEntries(DOGS.slice(0, count).map((dog) => [dog, 3])));
  const level = (lane: number) => ({
    height: 40,
    id: 1,
    kind: "obstacle" as const,
    lane,
    laneSpan: 1,
    y: geometry.walkerFootY - 80,
  });

  it.each([1, 2, 3])("never touch an obstacle in the lane beside, for %i dogs", (count) => {
    const boxes = dogBoxes(geometry, stillInLane(2), packOf(count));
    expect(dogsTouching(boxes, itemBox(geometry.cell, level(1)))).toEqual([]);
    expect(dogsTouching(boxes, itemBox(geometry.cell, level(3)))).toEqual([]);
    expect(dogsTouching(boxes, itemBox(geometry.cell, level(2))).length).toBeGreaterThan(0);
  });

  it.each([1, 2, 3])("touch both lanes halfway through a lane change, for %i dogs", (count) => {
    const motion = { duration: 1, elapsed: 0.5, from: 2, kind: "moving", to: 3 } as const;
    const boxes = dogBoxes(geometry, motion, packOf(count));
    expect(dogsTouching(boxes, itemBox(geometry.cell, level(2))).length).toBeGreaterThan(0);
    expect(dogsTouching(boxes, itemBox(geometry.cell, level(3))).length).toBeGreaterThan(0);
  });
});

describe("collideWithPack", () => {
  // The result with each hit's item alone.
  const collided = (...args: Parameters<typeof collideWithPack<RoadItem<Kind>, string>>) => {
    const result = collideWithPack(...args);
    return { ...result, hits: result.hits.map(({ item }) => item) };
  };

  it("removes a hit item and leaves the rest", () => {
    const hit = item(1, "obstacle", 2, 570);
    const ahead = item(2, "obstacle", 2, 100);
    expect(collided(rules, still, 0, [hit, ahead])).toEqual({
      hits: [hit],
      invulnerableSeconds: 1,
      remaining: [ahead],
    });
  });

  it("hits pickups in both lanes mid-move without opening the window", () => {
    const tips = [item(1, "tip", 2, 570), item(2, "tip", 3, 570)];
    expect(collided(rules, midMove, 0, tips)).toEqual({
      hits: tips,
      invulnerableSeconds: 0,
      remaining: [],
    });
  });

  it("hits an obstacle in the lane being left mid-move", () => {
    const behind = item(1, "obstacle", 2, 570);
    expect(collided(rules, midMove, 0, [behind]).hits).toEqual([behind]);
  });

  it("hits only the lower of two obstacles touching at once, and the other passes", () => {
    const upper = item(1, "obstacle", 3, 545);
    const lower = item(2, "obstacle", 2, 570);
    expect(collided(rules, midMove, 0, [upper, lower])).toEqual({
      hits: [lower],
      invulnerableSeconds: 1,
      remaining: [upper],
    });
  });

  it("ignores obstacles in the window, asking nothing and keeping them on the road, but collects pickups", () => {
    const obstacle = item(1, "obstacle", 2, 570);
    const tip = item(2, "tip", 2, 570);
    const asked: number[] = [];
    const asking = {
      ...rules,
      startsInvulnerability: ({ id }: RoadItem<Kind>) => {
        asked.push(id);
        return true;
      },
    };
    expect(collided(asking, still, 0.4, [obstacle, tip])).toEqual({
      hits: [tip],
      invulnerableSeconds: 0.4,
      remaining: [obstacle],
    });
    expect(asked).toEqual([]);
  });

  it("hits an obstacle again once the window has run out", () => {
    const obstacle = item(1, "obstacle", 2, 570);
    const first = collided(rules, still, 0, [item(9, "obstacle", 2, 570)]);
    const during = tickInvulnerability(0.9, first.invulnerableSeconds);
    expect(collided(rules, still, during, [obstacle]).hits).toEqual([]);
    const after = tickInvulnerability(0.1, during);
    expect(collided(rules, still, after, [obstacle]).hits).toEqual([obstacle]);
  });

  it("opens no window for a scenery hit, so the next obstacle is hit too", () => {
    const scenery = item(1, "obstacle", 2, 570);
    const upper = item(2, "obstacle", 3, 545);
    const asked: number[] = [];
    const sceneryRules = {
      ...rules,
      startsInvulnerability: ({ id }: RoadItem<Kind>) => {
        asked.push(id);
        return id !== scenery.id;
      },
    };
    expect(collided(sceneryRules, midMove, 0, [upper, scenery])).toEqual({
      hits: [scenery, upper],
      invulnerableSeconds: 1,
      remaining: [],
    });
    expect(asked).toEqual([1, 2]);
    expect(collided(sceneryRules, still, 0, [scenery]).invulnerableSeconds).toBe(0);
  });

  it("hits every touching obstacle when the window is zero", () => {
    const noWindow = { ...rules, invulnerabilitySeconds: 0 };
    const obstacles = [item(1, "obstacle", 2, 570), item(2, "obstacle", 3, 570)];
    expect(collided(noWindow, midMove, 0, obstacles).hits).toHaveLength(2);
  });
});

describe("tickInvulnerability", () => {
  it("counts the window down to zero and no further", () => {
    expect(tickInvulnerability(0.25, 1)).toBeCloseTo(0.75);
    expect(tickInvulnerability(2, 1)).toBe(0);
  });
});
