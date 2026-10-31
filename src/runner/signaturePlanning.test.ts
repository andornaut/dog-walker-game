import { describe, expect, it } from "vitest";

import type { SignatureProfile } from "../data/types";
import { plannerStreams } from "../testing/movers";
import {
  type MoverGeometry,
  moverPlacements,
  moverRetries,
  type MoverSpec,
  onScreenOf,
  placeMovers,
  screenHasRoom,
} from "./moverPlanning";
import { signaturePlace } from "./signaturePaths";
import type { SpawnPlan } from "./spawning";
import { planSpawns } from "./zonePlanner";

const common = { finishAheadSeconds: 1, warningSeconds: 0.3 };
const profiles: readonly SignatureProfile[] = [
  { ...common, kind: "rectangle", lanes: 1, legSeconds: 0.5, rows: 1 },
  { ...common, downSeconds: 0.5, kind: "turnExit", lanesPerSecond: 4, rows: 1 },
  {
    ...common,
    arcSeconds: 1,
    arcs: { max: 3, min: 2 },
    downFactor: 1.4,
    kind: "alternatingArcs",
    laneStep: 1,
  },
  {
    ...common,
    downFactor: 1.2,
    kind: "reflectingDiagonal",
    lanesPerSecond: 4,
    reflections: { max: 1, min: 1 },
  },
  {
    ...common,
    count: 2,
    downFactor: 1.5,
    kind: "successiveMerges",
    laneStep: 1,
    mergeSeconds: 0.4,
    straightSeconds: 0.6,
  },
  {
    ...common,
    anchor: { x: 10, y: 23 },
    bendSeconds: 0.6,
    bends: { max: 3, min: 2 },
    downFactor: 1,
    followerDelays: [0.4, 0.8],
    frame: { height: 24, width: 20 },
    kind: "delayedTrail",
    laneStep: 1,
    spriteKey: "chase-duckling",
    straightSeconds: 0.4,
  },
];
const geometry: MoverGeometry & { readonly zoneLength: number } = {
  cellLength: 50,
  laneCount: 5,
  laneInset: 5,
  packHitLength: 40,
  packLength: 40,
  roadLength: 700,
  rowSpacing: 160,
  scrollSpeed: 30,
  sightLength: 600,
  window: 90,
  zoneLength: 8000,
};
const specOf = (profile: SignatureProfile): MoverSpec => ({
  footprint: { lanes: 1, rows: 1 },
  motion: { kind: "signature", profile },
  movement: "inLane",
  variation: { delaySeconds: 0.3, lengthShare: 0.35, speedShare: 0 },
  warningSeconds: profile.warningSeconds,
});
const caps = { darts: 1, slowVehicles: 1, total: 3 };
const grid = {
  block: (_row: number, lanes: { count: number }) => lanes.count <= geometry.laneCount - 2,
  clearOf: () => true,
  clearRun: () => 3,
  heldLanes: () => 0,
  isFree: () => true,
  leavesRoom: () => true,
  occupy: () => {},
  packFits: () => true,
  stand: () => {},
  take: () => {},
};

describe("signature admission", () => {
  it("counts a signature with dart classification against the shared dart cap", () => {
    const profile = profiles.find((profile) => profile.kind === "reflectingDiagonal");
    if (profile === undefined) {
      throw new Error("Missing reflection fixture");
    }
    const placement = moverPlacements(geometry, { ...specOf(profile), movement: "dart" })[0];
    if (placement === undefined) {
      throw new Error("Missing signature placement");
    }
    const shown = onScreenOf(placement.path, [0, 100]);
    const other = { dart: true, interval: [0, 100] as const, slowVehicle: false };
    const limits = { darts: 1, slowVehicles: 1, total: 10 };
    expect(shown.dart).toBe(true);
    expect(screenHasRoom(limits, [other], shown)).toBe(false);
    expect(screenHasRoom(limits, [{ ...other, interval: [100, 200] }], shown)).toBe(true);
  });

  it.each(profiles)(
    "plans complete $kind routes while reserving at least two open lanes",
    (profile) => {
      const spec = specOf(profile);
      const placements = moverPlacements(geometry, spec);
      expect(placements.length).toBeGreaterThan(0);
      expect(
        moverRetries(spec, {
          count: 0,
          delays: [],
          lengths: [],
          share: 0,
          shy: 0,
          side: 0,
          speed: 0,
          start: 0,
          tilt: 0,
          turn: 0,
          turnAt: 0,
        }),
      ).toEqual([]);
      for (const placement of placements) {
        expect(placement.path.motion).toBe("signature");
        if (placement.path.motion !== "signature") {
          throw new Error("Expected a signature route");
        }
        const { route } = placement.path;
        for (const [index] of route.componentDelays.entries()) {
          expect(signaturePlace(route, route.complete, index).y).toBeLessThanOrEqual(
            geometry.sightLength - profile.finishAheadSeconds * geometry.scrollSpeed,
          );
        }
        expect(placement.lanes.count).toBeLessThanOrEqual(geometry.laneCount - 2);
      }
      const rows = Array.from({ length: 20 }, (_, index) => 1000 + index * 240);
      const quota = { count: 1, kind: "example", spec };
      const one = placeMovers(plannerStreams(1), geometry, caps, grid, [], rows, [quota]);
      const replay = placeMovers(plannerStreams(1), geometry, caps, grid, [], rows, [quota]);
      expect(one.spawns).toHaveLength(1);
      expect(one).toEqual(replay);
    },
  );

  it("reserves the reflected sweep ahead of the pack without blocking all lanes at pack contact", () => {
    const profile = profiles.find((profile) => profile.kind === "reflectingDiagonal");
    if (profile === undefined) {
      throw new Error("Missing reflection fixture");
    }
    for (const placement of moverPlacements(geometry, specOf(profile))) {
      expect(new Set(placement.cells.map(({ lane }) => lane)).size).toBe(5);
      expect(placement.lanes.count).toBeLessThanOrEqual(1);
    }
  });

  it("drops an unsafe complete route without replacing it with a shorter or stationary one", () => {
    for (const profile of profiles) {
      const spec = specOf(profile);
      expect(moverPlacements({ ...geometry, sightLength: 50 }, spec)).toEqual([]);
      const placed = placeMovers(
        plannerStreams(1),
        geometry,
        caps,
        { ...grid, clearOf: () => false },
        [],
        [1000],
        [{ count: 1, kind: "example", spec }],
      );
      expect(placed.spawns).toEqual([]);
      expect(placed.dropped).toEqual(["example"]);
    }
  });

  it("never converts an unplaceable first obstacle or moving prize into a stationary spawn", () => {
    const profile = profiles[0];
    if (profile === undefined) {
      throw new Error("Missing profile fixture");
    }
    for (const blocksLane of [true, false]) {
      const plan: SpawnPlan<"example"> = {
        ...geometry,
        cellInset: 5,
        fixedKinds: [],
        laneMoveSeconds: 0.2,
        maxEmptyRows: Infinity,
        minOpenLanes: 2,
        minSpacing: 160,
        moverCaps: caps,
        pathLaneMoveSeconds: 0.8,
        pathStart: 2,
        quotas: [
          {
            blocksLane,
            count: 1,
            first: blocksLane,
            kind: "example",
            mover: specOf({ ...profile, finishAheadSeconds: 1000 }),
          },
        ],
        reactionSeconds: 0.8,
        riderFollowGap: 50,
        stepSeconds: 1 / 60,
      };
      expect(planSpawns(plannerStreams(1), plan).events).toEqual([]);
    }
  });
});
