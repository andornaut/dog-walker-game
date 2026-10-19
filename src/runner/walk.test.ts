import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type { EncounterId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WORLD } from "../data/world";
import { screenLayout } from "../layout/screenLayout";
import { tipValue } from "../rules/run";
import { cents, pixels, read } from "../rules/units";
import { newRun, type PackDogs } from "../state/runState";
import { lanesReachedAtEnd } from "../testing/avoidable";
import { TEST_TUNING } from "../testing/tuning";
import { isSteeringLocked } from "./laneControl";
import { stillInLane } from "./laneMotion";
import { seededRandom } from "./random";
import {
  finishZone,
  footprintOf,
  headHome,
  itemCategory,
  itemHeight,
  obstacleWeights,
  pickWeighted,
  planZone,
  type RoadGeometry,
  startRoad,
  stepWalk,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
  zoneLength,
} from "./walk";
import { walkGeometry } from "./walkGeometry";

// 80px/s for 30s is a 2400px zone: 14 rows of spawns 160px apart.
const tuning = {
  ...TEST_TUNING,
  counts: {
    ...TEST_TUNING.counts,
    luckyEncountersPerZone: 2,
    minorObstaclesFirstZone: 4,
    minorObstaclesGainPerZone: 1,
    obstaclesFirstZone: 6,
    obstaclesGainPerZone: 1,
    tipsFirstZone: 8,
    tipsGainPerZone: 1,
    treatsPerZone: 2,
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
  seconds: { ...TEST_TUNING.seconds, collisionGrace: 1, laneMove: 0.18, zoneAtBaseSpeed: 30 },
};
const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  minorObstacles: MINOR_OBSTACLES,
  shopGear: SHOP_GEAR,
  tuning,
  upgrades: UPGRADES,
  world: WORLD,
};
const geometry: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { forcedStop: 16, lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  packBand: { bottom: 630, top: 554 },
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
};

const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: { ...startRoad(5), items, nextItemId: items.length },
  run: newRun(data, 3, { dogs, gear: null }),
});
// An item in the middle lane, its bottom just inside the pack's band.
const atPack = (kind: WalkItem["kind"], id = 0, lane = 2, laneSpan = 1): WalkItem => ({
  height: 12,
  id,
  kind,
  lane,
  laneSpan,
  y: 560,
});
const step = (walk: Walk, seconds = 0.01) =>
  stepWalk(data, geometry, seededRandom(1), seconds, walk);

describe("planZone", () => {
  const planned = planZone(data, geometry, seededRandom(3), walkWith(["koda"]));
  const countOf = (category: string) =>
    planned.road.pending.filter((event) => itemCategory(data, event.kind) === category).length;

  it("plans the zone's counts of each kind of spawn", () => {
    expect(countOf("obstacle")).toBe(6);
    expect(countOf("minor")).toBe(4);
    expect(countOf("tip")).toBe(8);
    expect(countOf("treat")).toBe(2);
    expect(countOf("lucky")).toBe(2);
  });

  it("places a forced stop in the middle third of the zone", () => {
    const distance = planned.road.forcedStopAhead?.distance ?? 0;
    const length = zoneLength(data, planned.run);
    expect(distance).toBeGreaterThan(length / 3 - 160);
    expect(distance).toBeLessThan((2 * length) / 3 + 160);
  });

  it("fits the tuned spawns into every zone of the game's road, so none is dropped", () => {
    const tuned = { ...data, tuning: TUNING };
    const gameRoad = walkGeometry(LANE_COUNT, 3, screenLayout(SCREEN_CONFIG).road);
    const run = newRun(tuned, 3, { dogs: ["duchess", "biscuit", "koda"], gear: null });
    for (let zoneIndex = 0; zoneIndex < WORLD.zones.length; zoneIndex++) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const walk = { road: startRoad(LANE_COUNT), run: { ...run, zoneIndex } };
        expect(() => planZone(tuned, gameRoad, seededRandom(seed), walk)).not.toThrow();
      }
    }
  });

  it("draws construction barriers only in the zones that allow them", () => {
    for (const zoneIndex of [0, 1, 2, 3]) {
      const walk = walkWith(["koda"]);
      const zoned = { ...walk, run: { ...walk.run, zoneIndex } };
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const kinds = planZone(data, geometry, seededRandom(seed), zoned).road.pending.map(
          (event) => event.kind,
        );
        const barriers = kinds.filter((kind) => kind === "barrier2" || kind === "barrier3");
        if (zoneIndex === 1 || zoneIndex === 3) {
          expect(barriers).toEqual([]);
        }
      }
    }
  });

  it("leaves a way past every obstacle of the game's road, from any lane, up to zone 4's speed", () => {
    const tuned = { ...data, tuning: TUNING };
    const road = screenLayout(SCREEN_CONFIG).road;
    const gameRoad = walkGeometry(LANE_COUNT, 3, road);
    const run = newRun(tuned, 3, { dogs: ["duchess", "biscuit", "koda"], gear: null });
    for (const zoneIndex of [0, 3]) {
      const zoned = { ...run, zoneIndex };
      for (const seed of [1, 2, 3]) {
        const walk = planZone(tuned, gameRoad, seededRandom(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const spans = walk.road.pending
          .filter((event) => ["minor", "obstacle"].includes(itemCategory(tuned, event.kind)))
          .map((event) => ({
            distance: event.distance,
            lane: event.lane,
            laneSpan: footprintOf(tuned, event.kind).lanes,
            length: itemHeight(tuned, gameRoad, event.kind) + gameRoad.tallestPackBand,
          }));
        const walkway = {
          laneCount: LANE_COUNT,
          laneMoveSeconds: read(TUNING, "seconds", "laneMove"),
          scrollSpeed: walkScrollSpeed(tuned, zoned),
          zoneLength: zoneLength(tuned, zoned),
        };
        for (const start of [0, 2, 4]) {
          expect(lanesReachedAtEnd(walkway, spans, start)).not.toEqual([]);
        }
      }
    }
  });

  it("draws a forced stop not met yet this run", () => {
    let walk = planned;
    for (let zone = 0; zone < 4; zone++) {
      walk = planZone(data, geometry, seededRandom(zone), walk);
    }
    expect(new Set(walk.road.forcedStopsSeen).size).toBe(walk.road.forcedStopsSeen.length);
  });
});

describe("stepWalk", () => {
  it("brings a due spawn into view at the top of the road", () => {
    const walk = walkWith(["koda"]);
    const due: Walk = {
      ...walk,
      road: { ...walk.road, pending: [{ distance: 0.5, kind: "tip", lane: 1 }] },
    };
    const { walk: after } = step(due, 0.05);
    expect(after.road.items).toEqual([
      { height: 12, id: 0, kind: "tip", lane: 1, laneSpan: 1, y: 40 - 12 + (4 - 0.5) },
    ]);
    expect(after.road.pending).toEqual([]);
    expect(after.run.zoneDistance).toBeCloseTo(4);
  });

  it("collects a tip the pack walks into, worth what tips pay now", () => {
    const walk = walkWith(["koda"], [atPack("tip")]);
    const { collected, tips, walk: after } = step(walk);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
    expect(after.run.money).toBe(tipValue(data, walk.run).amount);
    expect(tips).toEqual([tipValue(data, walk.run)]);
    expect(after.road.items).toEqual([]);
  });

  it("carries a treat, up to the carry limit", () => {
    const walk = walkWith(["koda"], [atPack("treat")]);
    expect(step(walk).walk.run.treats).toBe(1);
    const full = { ...walk, run: { ...walk.run, treats: 3 } };
    expect(step(full).walk.run.treats).toBe(3);
  });

  it("carries every treat of a planned zone that the pack walks into", () => {
    // The pack stands in the lane of the lowest treat in view, ignoring obstacles.
    let walk = planZone(data, geometry, seededRandom(4), walkWith(["koda"]));
    let carried = 0;
    for (let i = 0; i < 2000; i++) {
      const treat = walk.road.items
        .filter((item) => item.kind === "treat")
        .sort((a, b) => b.y - a.y)[0];
      const lane = treat?.lane ?? 2;
      const control = { ...walk.road.control, motion: stillInLane(lane), target: lane };
      walk = { ...walk, road: { ...walk.road, control, invulnerableSeconds: 99 } };
      const after = step(walk, 1 / 60).walk;
      carried += after.run.treats - walk.run.treats;
      walk = { ...after, run: { ...after.run, treats: 0 } };
    }
    expect(carried).toBe(2);
  });

  it("misses a pickup in another lane", () => {
    const walk = walkWith(["koda"], [atPack("tip", 0, 4)]);
    expect(step(walk).collected).toEqual([]);
  });

  it("opens a card for an obstacle, for the dogs it affects, and starts the grace window", () => {
    const { cards, walk } = step(walkWith(["koda", "duchess"], [atPack("otherDog")]));
    expect(cards).toEqual([
      { affected: ["koda", "duchess"], encounter: "otherDog", kind: "encounter" },
    ]);
    expect(walk.road.items).toEqual([]);
    expect(walk.road.invulnerableSeconds).toBe(1);
  });

  it("hits an obstacle across several lanes from any of them", () => {
    for (const lane of [1, 2, 3]) {
      const walk = walkWith(["koda"], [atPack("hedge", 0, 1, 3)]);
      const moved = {
        ...walk,
        road: {
          ...walk.road,
          control: { ...walk.road.control, motion: stillInLane(lane), target: lane },
        },
      };
      expect(step(moved).bumps).toHaveLength(1);
    }
  });

  it("drops tips once for a minor bump, locks steering and starts the grace window", () => {
    const walk = walkWith(["koda", "duchess"], [atPack("cone"), atPack("otherDog", 1)]);
    const rich = { ...walk, run: { ...walk.run, money: cents(500) } };
    const { bumps, cards, walk: after } = step(rich);
    expect(bumps.map(({ change }) => change?.amount)).toEqual([-200]);
    expect(bumps[0]?.change?.causes).toEqual([{ amount: -200, kind: "bump" }]);
    expect(after.run.money).toBe(300);
    expect(cards).toEqual([]);
    expect(isSteeringLocked(after.road.control)).toBe(true);
    expect(after.road.invulnerableSeconds).toBe(1);
    expect(after.road.items.map(({ kind }) => kind)).toEqual(["otherDog"]);
  });

  it("drops no more tips than the pack has", () => {
    const walk = walkWith(["koda"], [atPack("bin")]);
    const { bumps, walk: after } = step({ ...walk, run: { ...walk.run, money: cents(50) } });
    expect(bumps[0]?.change?.amount).toBe(-50);
    expect(after.run.money).toBe(0);
  });

  it("ignores obstacles during the grace window, but still collects pickups", () => {
    const walk = walkWith(["koda"], [atPack("otherDog", 0), atPack("tip", 1)]);
    const graced = { ...walk, road: { ...walk.road, invulnerableSeconds: 0.5 } };
    const { cards, collected } = step(graced);
    expect(cards).toEqual([]);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
  });

  it("opens no card for a squirrel when no dog chases", () => {
    expect(step(walkWith(["duchess"], [atPack("squirrel")])).cards).toEqual([]);
    expect(step(walkWith(["koda"], [atPack("squirrel")])).cards).toHaveLength(1);
  });

  it("opens a card for a lucky encounter, even in the grace window", () => {
    const walk = walkWith(["koda"], [atPack("lostWallet")]);
    const graced = { ...walk, road: { ...walk.road, invulnerableSeconds: 0.5 } };
    expect(step(graced).cards).toEqual([
      { affected: ["koda"], encounter: "lostWallet", kind: "encounter" },
    ]);
  });

  it("applies an instant lucky find at once, with no card", () => {
    const walk = walkWith(["koda", "nugget"], [atPack("photoOp")]);
    const { cards, instants, walk: after } = step(walk);
    expect(cards).toEqual([]);
    expect(instants.map(({ encounter }) => encounter)).toEqual(["photoOp"]);
    expect(instants[0]?.outcome.quips).toEqual([{ dog: "nugget", moment: "happier" }]);
    expect(after.run.money).toBe(walk.run.money + TEST_TUNING.money.photoOpTip * 100);
    expect(after.run.phase).toEqual({ kind: "walking" });
  });

  it("opens the forced stop's card when it reaches the pack, in any lane", () => {
    const walk = walkWith(["koda"]);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, forcedStopOnRoad: { stop: "stopSign", y: 540 } },
    };
    const { cards, walk: after } = step(stopped);
    expect(cards).toEqual([{ kind: "forcedStop", stop: "stopSign" }]);
    expect(after.road.forcedStopOnRoad).toBeNull();
  });

  it("ends the zone at its length and goes no further", () => {
    const walk = walkWith(["koda"]);
    const length = zoneLength(data, walk.run);
    const nearEnd = { ...walk, run: { ...walk.run, zoneDistance: pixels(length - 1) } };
    const { walk: after, zoneEnded } = step(nearEnd, 1);
    expect(zoneEnded).toBe(true);
    expect(after.run.zoneDistance).toBe(length);
  });

  it("stands still while a card is open", () => {
    const walk = walkWith(["koda"], [atPack("tip")]);
    const carded: Walk = {
      ...walk,
      run: {
        ...walk.run,
        phase: { kind: "card", source: { kind: "forcedStop", stop: "stopSign" } },
      },
    };
    expect(step(carded).walk).toBe(carded);
  });
});

describe("finishZone", () => {
  it("pays every walking dog's fee and moves on to the next zone", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const { fees, run: next } = finishZone(data, { ...run, zoneDistance: zoneLength(data, run) });
    expect(next.money).toBe(2000);
    expect(fees.map(({ amount, dog }) => ({ amount, dog }))).toEqual([
      { amount: 1000, dog: "koda" },
      { amount: 1000, dog: "duchess" },
    ]);
    expect(next.zoneIndex).toBe(1);
    expect(next.zoneDistance).toBe(0);
    expect(next.phase).toEqual({ kind: "walking" });
  });

  it("ends the zone's effects after paying its fees, keeping run-long ones", () => {
    const { run } = walkWith(["koda"]);
    const withEffects = {
      ...run,
      debuffs: [{ debuff: "stinky" as const, untilZone: 0 }],
      immunities: [{ encounter: "puddle" as const }, { encounter: "thief" as const, untilZone: 0 }],
    };
    const { run: next } = finishZone(data, withEffects);
    expect(next.debuffs).toEqual([]);
    expect(next.immunities).toEqual([{ encounter: "puddle" }]);
  });

  it("ends the run, finished, after the last zone", () => {
    const { run } = walkWith(["koda"]);
    const last = finishZone(data, { ...run, zoneIndex: WORLD.zones.length - 1 }).run;
    expect(last.phase).toEqual({ kind: "ended", reason: "finished" });
  });
});

describe("headHome", () => {
  it("ends the run without paying the current zone", () => {
    const { run } = walkWith(["koda"]);
    const home = headHome({ ...run, money: cents(700) });
    expect(home.phase).toEqual({ kind: "ended", reason: "wentHome" });
    expect(home.money).toBe(700);
  });
});

describe("obstacleWeights", () => {
  const weightOf = (dogs: PackDogs, id: EncounterId) =>
    obstacleWeights(data, walkWith(dogs).run).find(([encounter]) => encounter === id)?.[1];

  it("weighs every obstacle encounter, and no lucky one", () => {
    const ids = obstacleWeights(data, walkWith(["biscuit"]).run).map(([id]) => id);
    expect(ids.sort()).toEqual(["otherDog", "puddle", "skunk", "squirrel", "thief"]);
  });

  it("draws other dogs more often for each small dog and less for each big dog", () => {
    expect(weightOf(["biscuit"], "otherDog")).toBe(1);
    expect(weightOf(["duchess", "nugget"], "otherDog")).toBeCloseTo(1.5);
    expect(weightOf(["koda"], "otherDog")).toBeCloseTo(0.75);
    expect(weightOf(["koda"], "skunk")).toBe(1);
  });
});

describe("pickWeighted", () => {
  it("picks each entry in proportion to its weight", () => {
    const random = seededRandom(5);
    const picks = Array.from({ length: 4000 }, () =>
      pickWeighted(random, [
        ["a", 3],
        ["b", 1],
        ["c", 0],
      ]),
    );
    const share = picks.filter((pick) => pick === "a").length / picks.length;
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.8);
    expect(picks).not.toContain("c");
  });
});
