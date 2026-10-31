import { describe, expect, it } from "vitest";

import { plannerStreams } from "../testing/movers";
import { type MoverSpec, placeMovers } from "./moverPlanning";
import { validateSpawnCapacity } from "./spawnAdmission";
import type { SpawnPlan } from "./spawning";
import { planSpawns } from "./zonePlanner";

const plan: SpawnPlan<string> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
  quotas: [],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 1100,
  scrollSpeed: 100,
  sightLength: 1000,
  stepSeconds: 0.05,
  zoneLength: 1000,
};

const rider: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: { kind: "ride", speedMultiplier: 1.5 },
  movement: "inLane",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.8 },
  warningSeconds: 0,
};

describe("spawn admission", () => {
  it("rejects demand beyond necessary cell and screen-time bounds before drawing", () => {
    const noDraws = {
      movers: () => {
        throw new Error("unexpected draw");
      },
      spawns: () => {
        throw new Error("unexpected draw");
      },
    };
    expect(() =>
      planSpawns(noDraws, { ...plan, quotas: [{ blocksLane: true, count: 10000, kind: "wall" }] }),
    ).toThrow(/Impossible spawn quota:.*standing cells/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: true, count: 10000, kind: "rider", mover: rider }],
      }),
    ).toThrow(/mover screen distance/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: true, count: 10000, first: true, kind: "rider", mover: rider }],
      }),
    ).toThrow(/blocking logical groups/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: false, count: 1, kind: "tip", within: [0, 0.1] }],
      }),
    ).toThrow(/tip standing cells/);
    expect(() =>
      validateSpawnCapacity(
        { ...plan, quotas: [{ blocksLane: false, count: NaN, kind: "tip" }] },
        9,
      ),
    ).toThrow(/count must be/);
  });

  it("reports seeded search failure separately from passing necessary bounds", () => {
    const { admission } = planSpawns(plannerStreams(1), {
      ...plan,
      quotas: [{ blocksLane: true, count: 1, footprint: { lanes: 5, rows: 1 }, kind: "wall" }],
    });
    expect(admission.counts).toEqual([
      { admitted: 0, herrings: 0, kind: "wall", movement: null, requested: 1 },
    ]);
    expect(admission.rejections).toContainEqual(
      expect.objectContaining({ kind: "wall", reason: "open-lanes" }),
    );
    expect(
      admission.capacity.limits.every(({ available, required }) => required <= available),
    ).toBe(true);
  });

  it("fills a usable earlier row after the first rider waits for room", () => {
    let draws = 0;
    const streams = { movers: () => 0.5, spawns: () => (draws++ < 5 ? 0 : 1 - Number.EPSILON) };
    const grid = {
      block: () => true,
      clearOf: () => true,
      clearRun: () => 1,
      isFree: () => true,
      leavesRoom: () => true,
      occupy: () => {},
      packFits: () => true,
      stand: () => {},
      take: () => {},
    };
    const geometry = {
      ...plan,
      cellLength: 10,
      roadLength: 100,
      rowSpacing: 500,
      sightLength: 80,
      window: 40,
    };
    const { dropped, spawns } = placeMovers(
      streams,
      geometry,
      { darts: 1, slowVehicles: 1, total: 1 },
      grid,
      [],
      [0, 500, 1000],
      [{ count: 2, kind: "rider", spec: rider }],
    );
    expect(spawns).toHaveLength(2);
    expect(dropped).toEqual([]);
    expect(spawns[0]?.distance).toBeGreaterThan(0);
    expect(spawns[1]?.distance).toBe(0);
  });
});
