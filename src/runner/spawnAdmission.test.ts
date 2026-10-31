import { describe, expect, it } from "vitest";

import { MOVEMENT_PROFILES } from "../data/movementProfiles";
import { plannerStreams } from "../testing/movers";
import { type MoverSpec, placeMovers } from "./moverPlanning";
import { minimumSignatureOnScreen } from "./signatureCapacity";
import { validateSpawnCapacity } from "./spawnAdmission";
import type { SpawnPlan } from "./spawning";
import { planCompleteSpawns, planSpawns } from "./zonePlanner";

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

  it("bounds duckling groups by the held cue, final follower and slow tail", () => {
    const profile = MOVEMENT_PROFILES.ducklingTrail;
    if (profile?.kind !== "delayedTrail") {
      throw new Error("Missing duckling trail profile");
    }
    const spec: MoverSpec = {
      ...rider,
      motion: { kind: "signature", profile },
      variation: { ...rider.variation, delaySeconds: 20 },
    };
    const minimum = minimumSignatureOnScreen(plan, spec);
    expect(minimum).toBeCloseTo(
      profile.warningSeconds * plan.scrollSpeed +
        Math.max(...profile.followerDelays) * plan.scrollSpeed +
        plan.roadLength / profile.downFactor,
    );
    expect(() =>
      validateSpawnCapacity(
        {
          ...plan,
          quotas: [{ blocksLane: true, count: 1000, kind: "ducklings", mover: spec }],
          zoneLength: 29600,
        },
        100,
      ),
    ).toThrow(/mover screen distance/);
    expect(
      minimumSignatureOnScreen(plan, {
        ...spec,
        variation: { ...spec.variation, delaySeconds: 0 },
      }),
    ).toBe(minimum);
  });

  it("bounds a reflection count domain by geometry before compiling routes", () => {
    const profile = MOVEMENT_PROFILES.reflectingRoll;
    if (profile?.kind !== "reflectingDiagonal") {
      throw new Error("Missing reflecting profile");
    }
    const spec: MoverSpec = {
      ...rider,
      motion: {
        kind: "signature",
        profile: { ...profile, reflections: { max: Number.MAX_SAFE_INTEGER, min: 1 } },
      },
    };
    expect(Number.isFinite(minimumSignatureOnScreen(plan, spec))).toBe(true);
    expect(
      minimumSignatureOnScreen(plan, {
        ...spec,
        motion: {
          kind: "signature",
          profile: {
            ...profile,
            reflections: { max: Number.MAX_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER },
          },
        },
      }),
    ).toBe(Infinity);
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

describe("constructive spawn admission", () => {
  const counted = () => {
    const draws = { movers: 0, spawns: 0 };
    const source = plannerStreams(7);
    return {
      draws,
      streams: {
        movers: () => {
          draws.movers += 1;
          return source.movers();
        },
        spawns: () => {
          draws.spawns += 1;
          return source.spawns();
        },
      },
    };
  };

  it("returns a complete original layout and primary RNG cursor unchanged", () => {
    const mixed: SpawnPlan<string> = {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 1,
          kind: "rider",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 2 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
        { blocksLane: true, count: 2, kind: "wall" },
        { blocksLane: false, count: 2, kind: "tip" },
      ],
      roadLength: 500,
      sightLength: 400,
      zoneLength: 4000,
    };
    const raw = counted();
    const expected = planSpawns(raw.streams, mixed);
    const searched = counted();
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, searched.streams, mixed);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.status);
    }
    expect(result.strategy).toBe("original");
    expect(result.attempts).toHaveLength(1);
    expect(result.planned).toEqual(expected);
    expect(searched.draws).toEqual(raw.draws);
  });

  it("repairs a path-blocked mix without further primary draws or changed requests", () => {
    const blocked: SpawnPlan<string> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 1, footprint: { lanes: 3, rows: 1 }, kind: "hedge" },
        {
          blocksLane: true,
          count: 1,
          kind: "rider",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 1.5 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
      ],
      roadLength: 500,
      sightLength: 400,
      zoneLength: 4000,
    };
    const heldPath = () => {
      const draws = { movers: 0, spawns: 0 };
      return {
        draws,
        streams: {
          movers: () => {
            draws.movers += 1;
            return 0.9;
          },
          spawns: () => {
            draws.spawns += 1;
            return 0.5;
          },
        },
      };
    };
    const raw = heldPath();
    expect(
      planSpawns(raw.streams, blocked).events.filter(({ kind }) => kind === "hedge"),
    ).toHaveLength(0);
    const primary = heldPath();
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, primary.streams, blocked);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.status);
    }
    expect(result.strategy).not.toBe("original");
    expect(result.planned.events.map(({ kind }) => kind).sort()).toEqual(["hedge", "rider"]);
    expect(result.planned.admission.substitutions).toEqual([]);
    expect(primary.draws).toEqual(raw.draws);
  });

  it("reports exact original missing members rather than crediting a still downgrade", () => {
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 1,
          first: true,
          kind: "shared",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 0.2 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
        { blocksLane: true, count: 1, footprint: { lanes: 5, rows: 1 }, kind: "shared" },
      ],
    });
    expect(result.status).toBe("planner-unable");
    if (result.status !== "planner-unable") {
      throw new Error(result.status);
    }
    expect(result.attempts).toHaveLength(3);
    expect(
      result.missing.map(({ count, kind, movement, requests }) => ({
        count,
        kind,
        movement,
        requests,
      })),
    ).toEqual([
      {
        count: 1,
        kind: "shared",
        movement: "inLane",
        requests: [{ memberIndex: 0, quotaIndex: 0 }],
      },
      { count: 1, kind: "shared", movement: null, requests: [{ memberIndex: 0, quotaIndex: 1 }] },
    ]);
    expect(result.missing.flatMap(({ observedRejections }) => observedRejections)).toContainEqual(
      expect.objectContaining({ reason: "open-lanes" }),
    );
  });

  it("separates proved capacity failure from invalid quota definitions", () => {
    const noDraws = {
      movers: () => {
        throw new Error("unexpected draw");
      },
      spawns: () => {
        throw new Error("unexpected draw");
      },
    };
    const invalid = { ...plan, quotas: [{ blocksLane: true, count: 10000, kind: "wall" }] };
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, noDraws, invalid);
    expect(result.status).toBe("capacity-impossible");
    expect(result.attempts).toEqual([]);
    expect(() =>
      planCompleteSpawns({ seed: 7, zoneIndex: 0 }, noDraws, {
        ...invalid,
        quotas: [{ blocksLane: true, count: NaN, kind: "wall" }],
      }),
    ).toThrow(/count must be/);
  });
});
