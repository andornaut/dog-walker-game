import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { unionBox } from "../layout/packFormation";
import { testState } from "../testing/runState";
import {
  type Box,
  collideWithPack,
  type DogBox,
  hitDog,
  itemBox,
  type LanedBox,
  overlaps,
  type PackBoxes,
  pickupDog,
  type ScaledBox,
  tickInvulnerability,
} from "./collision";
import { stillInLane } from "./laneMotion";
import type { MoverPath } from "./movers";
import type { RoadItem } from "./roadItems";
import { screenRoadGeometry } from "./screenGeometry";
import { itemHeight, obstacleHitBox, packBoxes } from "./walk";
import { footprintOf, type WalkItem } from "./walkItems";

type Kind = "obstacle" | "tip";

const rules = {
  graced: (item: RoadItem<Kind>) => item.kind === "obstacle",
  invulnerabilitySeconds: 1,
  startsInvulnerability: () => true,
};
const CELL = { inset: 8, length: 64 };
// A box drawn at scale 1, as every row of a flat road is.
const flat = <Part extends Box>(box: Part): Part & ScaledBox => ({ ...box, scale: 1 });
// An item's box on a flat road, in lanes wide enough never to cut it.
const solid = (box: Box): LanedBox => ({
  ...flat(box),
  lanes: { left: -Infinity, right: Infinity },
});
// A pack of parts on a flat road, outlined by their bounding box.
const packOf = (walker: Box, dogs: readonly Omit<DogBox, "scale">[]): PackBoxes => ({
  centreX: 0,
  dogs: dogs.map(flat),
  outline: unionBox([walker, ...dogs]),
  walker: flat(walker),
});
// A one-dog pack 40 wide centred on centreX, its dog over the walker's feet: in lane 2, or
// halfway between lanes 2 and 3, as mid-move.
const single = (centreX: number) =>
  packOf({ bottom: 600, left: centreX - 20, right: centreX + 20, top: 585 }, [
    { bottom: 585, dog: "kilo", left: centreX - 20, right: centreX + 20, top: 560 },
  ]);
const touchingWith = (pack: PackBoxes) => (hit: RoadItem<Kind>) =>
  hitDog(pack, solid(itemBox(CELL, hit)));
const still = touchingWith(single(160));
const midMove = touchingWith(single(192));

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
  it("overlaps boxes that share a pixel, and not boxes that only touch", () => {
    for (const [, b, expected] of [
      ["sharing area", { bottom: 15, left: 5, right: 15, top: 5 }, true],
      ["only meeting at an edge", { bottom: 10, left: 10, right: 20, top: 0 }, false],
      ["apart", { bottom: 10, left: 11, right: 20, top: 0 }, false],
    ] satisfies readonly [string, Box, boolean][]) {
      expect(overlaps(a, b)).toBe(expected);
      expect(overlaps(b, a)).toBe(expected);
    }
  });
});

describe("a one-dog pack", () => {
  // The item's box spans y to y + 32; the pack's, 560 to 600.
  it("touches an item in the pack's lane only while their boxes overlap", () => {
    for (const { touches, y } of [
      { touches: false, where: "ending on the box's top", y: 528 },
      { touches: true, where: "reaching into the box", y: 529 },
      { touches: true, where: "starting just above the box's bottom", y: 599 },
      { touches: false, where: "starting on the box's bottom", y: 600 },
    ]) {
      expect(still(item(1, "tip", 2, y))).toBe(touches ? "kilo" : null);
    }
  });

  it("touches an item spanning several lanes in any of them", () => {
    expect(still(item(1, "obstacle", 0, 570, 3))).toBe("kilo");
    expect(still(item(1, "obstacle", 2, 570, 2))).toBe("kilo");
    expect(still(item(1, "obstacle", 0, 570, 2))).toBeNull();
    expect(still(item(1, "obstacle", 3, 570, 2))).toBeNull();
  });

  it("touches items only in the pack's lane, both lanes while it is between them", () => {
    expect(still(item(1, "tip", 3, 570))).toBeNull();
    expect(midMove(item(1, "tip", 2, 570))).toBe("kilo");
    expect(midMove(item(2, "tip", 3, 570))).toBe("kilo");
    expect(midMove(item(3, "tip", 1, 570))).toBeNull();
  });
});

// Kilo leads in the centre, out front; Biscuit and Buddy walk front-left and front-right a
// little behind, a gap between them under Kilo; the walker below. Pickups touch the outline
// around them all; obstacles touch the parts.
const chevron = packOf({ bottom: 100, left: -10, right: 10, top: 50 }, [
  { bottom: 20, dog: "kilo", left: -10, right: 10, top: -20 },
  { bottom: 40, dog: "biscuit", left: -30, right: -12, top: 0 },
  { bottom: 40, dog: "buddy", left: 12, right: 30, top: 0 },
]);
// Between the side dogs, under Kilo and over the walker: inside the outline, on no part.
const GAP: Box = { bottom: 48, left: -8, right: 8, top: 26 };

describe("hitDog", () => {
  it("lands an obstacle on the dog it reaches first", () => {
    for (const [, box, dog] of [
      [
        "on the dog whose rectangle it touches",
        { bottom: 30, left: 20, right: 40, top: 10 },
        "buddy",
      ],
      [
        "on the lead when it touches the lead",
        { bottom: -10, left: -5, right: 5, top: -30 },
        "kilo",
      ],
      [
        "on the front dog when it touches only the walker",
        { bottom: 120, left: -5, right: 5, top: 90 },
        "kilo",
      ],
      [
        "on the nearest of the dogs it touches",
        { bottom: 35, left: -40, right: 40, top: 15 },
        "kilo",
      ],
      [
        "on the nearer side dog when it touches both and not the lead",
        { bottom: 38, left: -28, right: 14, top: 22 },
        "biscuit",
      ],
      ["on nothing in the gap between the parts", GAP, null],
      ["on nothing outside the outline", { bottom: 10, left: 40, right: 60, top: -10 }, null],
    ] satisfies readonly [string, Box, DogId | null][]) {
      expect(hitDog(chevron, solid(box))).toBe(dog);
    }
  });

  // Buddy's rectangle runs 12 to 30 across; the box reaches 20 to 40, its lanes 25 on.
  it("lands an obstacle only on a dog its lanes reach, not past them", () => {
    for (const [, laneLeft, dog] of [
      ["on a dog its lanes reach", 15, "buddy"],
      ["on no dog only the box's spill past its lanes reaches", 30, null],
    ] satisfies readonly [string, number, DogId | null][]) {
      const box = {
        ...solid({ bottom: 30, left: 20, right: 40, top: 10 }),
        lanes: { left: laneLeft, right: 60 },
      };
      expect(hitDog(chevron, box)).toBe(dog);
    }
  });

  it("lands on no dog when the pack has none", () => {
    const walker = { bottom: 100, left: -10, right: 10, top: 40 };
    expect(hitDog(packOf(walker, []), solid(walker))).toBeNull();
  });
});

describe("pickupDog", () => {
  it("gives a pickup to the dog it reaches first", () => {
    for (const [, box, dog] of [
      ["to the dog nearest the contact", { bottom: 30, left: 20, right: 40, top: 10 }, "buddy"],
      ["to the dog nearest the contact in the gap between the parts", GAP, "biscuit"],
      [
        "to the front dog when the walker is nearest",
        { bottom: 120, left: -5, right: 5, top: 90 },
        "kilo",
      ],
      [
        "to the dog whose rectangle holds the contact",
        { bottom: 10, left: -1, right: 1, top: -10 },
        "kilo",
      ],
      ["to no dog outside the outline", { bottom: 10, left: 40, right: 60, top: -10 }, null],
    ] satisfies readonly [string, Box, DogId | null][]) {
      expect(pickupDog(chevron, box)).toBe(dog);
    }
  });

  it("gives no dog a pickup when the pack has none", () => {
    const walker = { bottom: 100, left: -10, right: 10, top: 40 };
    expect(pickupDog(packOf(walker, []), walker)).toBeNull();
  });
});

describe("a settled pack", () => {
  const DOGS: DogId[] = ["kilo", "biscuit", "buddy"];
  const runOf = (count: number) =>
    testState(Object.fromEntries(DOGS.slice(0, count).map((dog) => [dog, 3])));
  // A goose, drawn about as wide as a lane's hit box, standing level with the lead's rectangle, in
  // lane.
  const levelIn = (lane: number, count: number): WalkItem => {
    const run = runOf(count);
    const geometry = screenRoadGeometry(run);
    const height = itemHeight(gameData, geometry, "goose", false);
    const feetY = (geometry.packParts.dogs[0]?.top ?? 0) + 20;
    return { height, id: 1, kind: "goose", lane, laneSpan: 1, y: feetY - height };
  };
  const contact = (count: number, motion: Parameters<typeof packBoxes>[1], lane: number) => {
    const run = runOf(count);
    const geometry = screenRoadGeometry(run);
    const pack = packBoxes(geometry, motion, run);
    const item = levelIn(lane, count);
    return [
      hitDog(pack, obstacleHitBox(gameData, geometry, item)),
      pickupDog(pack, itemBox(geometry.cell, item)),
    ];
  };

  it("never touches anything in the lane beside, for any pack size", () => {
    for (const count of [1, 2, 3]) {
      expect(contact(count, stillInLane(2), 1)).toEqual([null, null]);
      expect(contact(count, stillInLane(2), 3)).toEqual([null, null]);
      expect(contact(count, stillInLane(2), 2)).not.toContain(null);
    }
  });

  it("touches both lanes halfway through a lane change, for any pack size", () => {
    for (const count of [1, 2, 3]) {
      const motion = { duration: 1, elapsed: 0.5, from: 2, kind: "moving", to: 3 } as const;
      expect(contact(count, motion, 2)).not.toContain(null);
      expect(contact(count, motion, 3)).not.toContain(null);
    }
  });

  // Every stalker kind, standing on the road at lane 1 with no step taken, its feet level with
  // the lead's rectangle.
  const stalkers = [
    ...Object.entries(gameData.encounters),
    ...Object.entries(gameData.minorObstacles),
  ].flatMap(([kind, entry]) =>
    "movement" in entry && entry.movement.kind === "approach" ? [kind as WalkItem["kind"]] : [],
  );
  it.each(stalkers)("hits a pack in every lane a standing %s covers, and none beside", (kind) => {
    const run = runOf(3);
    const geometry = screenRoadGeometry(run);
    const { lanes } = footprintOf(gameData, kind);
    const height = itemHeight(gameData, geometry, kind, true);
    const feetY = (geometry.packParts.dogs[0]?.top ?? 0) + 20;
    const path: MoverPath = {
      burst: 1,
      lane: 1,
      lengths: [],
      motion: "approach",
      movement: "approach",
      pending: [],
      reach: { count: 1, first: 1 },
      rows: 0,
      steps: [],
      stopTravel: 0,
      warning: 0,
    };
    const item: WalkItem = {
      height,
      id: 1,
      kind,
      lane: 1,
      laneSpan: lanes,
      mover: { path, since: 0 },
      y: feetY - height,
    };
    const box = obstacleHitBox(gameData, geometry, item);
    const hitIn = (lane: number) => hitDog(packBoxes(geometry, stillInLane(lane), run), box);
    expect(Array.from({ length: lanes }, (_, i) => hitIn(1 + i))).not.toContain(null);
    expect([hitIn(0), hitIn(1 + lanes)]).toEqual([null, null]);
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
