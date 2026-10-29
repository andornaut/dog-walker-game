import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { seededRandom } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen";
import type { MinorObstacleId, ZoneId } from "../data/types";
import { read } from "../rules/units";
import { moverPlace, moverTell } from "../runner/movers";
import { startRoad, stepWalk, type Walk, zoneLength } from "../runner/walk";
import { planZone } from "../runner/zonePlan";
import { plannerStreams } from "../testing/movers";
import { FASTEST_WALKER, GAME_ROAD, inZone, REAL, type Real, realRun } from "../testing/planner";
import { weighedUp } from "../testing/world";
import { distractionScroll } from "./distractions";
import { herringNow } from "./herrings";

// The kinds with red herrings, each with its share and the zones that weigh it above 0.
const HERRING_KINDS = keysOf(REAL.minorObstacles).flatMap((kind: MinorObstacleId) => {
  const entry = REAL.minorObstacles[kind];
  const movement = "movement" in entry ? entry.movement : undefined;
  if (movement?.kind !== "stopAndGoAcross" || !("herringShare" in movement)) {
    return [];
  }
  const zones = REAL.world.zones
    .filter(({ weights }) => weights.minorObstacles[kind] > 0)
    .map(({ id }) => id as ZoneId);
  return [{ kind, share: read(REAL.tuning, "probability", movement.herringShare), zones }];
});
const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
const HERRING_SHARE_TOLERANCE = 0.1;
// Enough draws that the tolerance is 4 standard deviations of their share, sqrt(0.25 / n) at most.
const HERRING_MOVERS_ENOUGH = Math.ceil(0.25 / (HERRING_SHARE_TOLERANCE / 4) ** 2);
const HERRING_SEEDS_MOST = 240;

// A zone planned on a seed at the walk's first or last position.
const planned = (data: Real, zone: ZoneId, zoneIndex: number, seed: number): Walk =>
  planZone(data, GAME_ROAD, plannerStreams(seed), {
    road: startRoad(LANE_COUNT),
    run: inZone(realRun(data, FASTEST_WALKER), zone, zoneIndex),
  });
const plansOf = (data: Real, zones: readonly ZoneId[], seeds: readonly number[]) =>
  zones.flatMap((zone) =>
    [0, data.world.walkLength - 1].flatMap((zoneIndex) =>
      seeds.map((seed) => ({ seed, walk: planned(data, zone, zoneIndex, seed), zone, zoneIndex })),
    ),
  );

describe("red herrings", { timeout: 120_000 }, () => {
  it("has a kind with red herrings", () => {
    expect(HERRING_KINDS.length).toBeGreaterThan(0);
  });

  // Of a kind's movers each zone plans, about its share come as red herrings, each one of them,
  // not one more. Each mover's draw alone makes it a red herring, whatever else its zone plans, so
  // its zones weigh it up (weighedUp) to bring more of them a plan. Planned a seed at a time from
  // seed 1 until HERRING_MOVERS_ENOUGH of the kind's movers come up or the search has planned
  // HERRING_SEEDS_MOST seeds.
  it.each(HERRING_KINDS)("plans about $share of $kind's movers as red herrings", (herring) => {
    const data = weighedUp(herring.kind, REAL);
    let movers = 0;
    let herrings = 0;
    for (let seed = 1; seed <= HERRING_SEEDS_MOST && movers < HERRING_MOVERS_ENOUGH; seed++) {
      for (const { walk } of plansOf(data, herring.zones, [seed])) {
        const { road } = walk;
        const kindOf = (event: { kind: string }) => event.kind === herring.kind;
        const placed = road.pending.filter((event) => kindOf(event) && event.mover !== undefined);
        const shown = road.herrings.filter(kindOf);
        const asked = road.planned
          .filter((quota) => kindOf(quota) && quota.movement === "stopAndGoAcross")
          .reduce((sum, { count }) => sum + count, 0);
        expect(placed.length + shown.length).toBeLessThanOrEqual(asked);
        movers += asked;
        herrings += shown.length;
      }
    }
    expect(movers).toBeGreaterThanOrEqual(HERRING_MOVERS_ENOUGH);
    expect(Math.abs(herrings / movers - herring.share)).toBeLessThan(HERRING_SHARE_TOLERANCE);
  });

  // Each red herring is no spawn of the walk's, and its seed plans it again the same. It shows from
  // as its row comes on screen with no cue, never coming nearer the pack than the road ahead a
  // distraction is gone by, and crosses the whole road, gone before its zone ends.
  it.each(HERRING_KINDS)("plans $kind's red herrings outside the walk, with no cue", (herring) => {
    const end = distractionScroll(REAL, GAME_ROAD);
    const length = zoneLength(REAL);
    let shown = 0;
    for (const { seed, walk, zone, zoneIndex } of plansOf(REAL, herring.zones, SEEDS)) {
      const { road } = walk;
      expect(planned(REAL, zone, zoneIndex, seed).road.herrings).toEqual(road.herrings);
      for (const event of road.herrings) {
        shown += 1;
        expect(road.pending).not.toContainEqual(event);
        expect(herringNow(REAL, GAME_ROAD, event.distance - 1, event)).toBeNull();
        const lanes = new Set<number>();
        let at = event.distance;
        for (; ; at++) {
          const item = herringNow(REAL, GAME_ROAD, at, event);
          if (item === null) {
            break;
          }
          const { path, since } = item.mover;
          expect(moverTell(path, since)).toBeNull();
          const place = moverPlace(LANE_COUNT, path, since);
          expect(place.travel).toBeLessThanOrEqual(end + 1e-6);
          for (let lane = 0; lane < item.laneSpan; lane++) {
            lanes.add(Math.round(place.lanePosition) + lane);
          }
        }
        expect(at).toBeLessThanOrEqual(length + 1);
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          expect(lanes).toContain(lane);
        }
      }
    }
    expect(shown).toBeGreaterThan(0);
  });

  // The walk never reads its red herrings: stepped with or without them, a planned zone walks the
  // same, every hit and pickup included.
  it.each(HERRING_KINDS)(
    "walks a zone the same with or without $kind's red herrings",
    (herring) => {
      // The first seed's plan with one of them.
      let plan: { walk: Walk } | undefined;
      for (let seed = 1; seed <= HERRING_SEEDS_MOST && plan === undefined; seed++) {
        plan = plansOf(REAL, herring.zones, [seed]).find(({ walk }) =>
          walk.road.herrings.some(({ kind }) => kind === herring.kind),
        );
      }
      expect(plan).toBeDefined();
      const walked = (walk: Walk) => {
        const random = seededRandom(1);
        const steps = [];
        let current = walk;
        for (let i = 0; i < 60 * 60; i++) {
          const step = stepWalk(REAL, GAME_ROAD, random, STEP_SECONDS, current);
          current = step.walk;
          steps.push({
            ...step,
            walk: { ...step.walk, road: { ...step.walk.road, herrings: [] } },
          });
        }
        return steps;
      };
      const walk = plan?.walk ?? planned(REAL, herring.zones[0] ?? "highPark", 0, 1);
      expect(walked({ ...walk, road: { ...walk.road, herrings: [] } })).toEqual(walked(walk));
    },
  );
});
