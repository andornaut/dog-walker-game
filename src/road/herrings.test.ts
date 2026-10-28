import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen";
import type { MinorObstacleId, ZoneId } from "../data/types";
import { seededRandom } from "../lib/random";
import { keysOf } from "../lib/records";
import { read } from "../rules/units";
import { STEP_SECONDS } from "../runner/fixedStep";
import { moverPlace, moverTell } from "../runner/movers";
import { startRoad, stepWalk, type Walk, zoneLength } from "../runner/walk";
import { planZone } from "../runner/zonePlan";
import { plannerStreams } from "../testing/movers";
import { FASTEST_WALKER, GAME_ROAD, inZone, REAL, realRun } from "../testing/planner";
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
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

// A zone planned on a seed at the walk's first or last position.
const planned = (zone: ZoneId, zoneIndex: number, seed: number): Walk =>
  planZone(REAL, GAME_ROAD, plannerStreams(seed), {
    road: startRoad(LANE_COUNT),
    run: inZone(realRun(REAL, FASTEST_WALKER), zone, zoneIndex),
  });
const plansOf = (zones: readonly ZoneId[], seeds: readonly number[]) =>
  zones.flatMap((zone) =>
    [0, REAL.world.walkLength - 1].flatMap((zoneIndex) =>
      seeds.map((seed) => ({ seed, walk: planned(zone, zoneIndex, seed), zone, zoneIndex })),
    ),
  );

describe("red herrings", { timeout: 120_000 }, () => {
  it("has a kind with red herrings", () => {
    expect(HERRING_KINDS.length).toBeGreaterThan(0);
  });

  // Of a kind's movers each zone plans, about its share come as red herrings, each one of them,
  // not one more.
  it.each(HERRING_KINDS)("plans about $share of $kind's movers as red herrings", (herring) => {
    let movers = 0;
    let herrings = 0;
    for (const { walk } of plansOf(herring.zones, SEEDS)) {
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
    expect(movers).toBeGreaterThan(50);
    expect(Math.abs(herrings / movers - herring.share)).toBeLessThan(0.1);
  });

  // Each red herring is no spawn of the walk's, and its seed plans it again the same. It shows from
  // as its row comes on screen with no cue, never coming nearer the pack than the road ahead a
  // distraction is gone by, and crosses the whole road, gone before its zone ends.
  it.each(HERRING_KINDS)("plans $kind's red herrings outside the walk, with no cue", (herring) => {
    const end = distractionScroll(REAL, GAME_ROAD);
    const length = zoneLength(REAL);
    let shown = 0;
    for (const { seed, walk, zone, zoneIndex } of plansOf(herring.zones, SEEDS.slice(0, 8))) {
      const { road } = walk;
      expect(planned(zone, zoneIndex, seed).road.herrings).toEqual(road.herrings);
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
      const [plan] = plansOf(herring.zones, SEEDS).filter(({ walk }) =>
        walk.road.herrings.some(({ kind }) => kind === herring.kind),
      );
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
      const walk = plan?.walk ?? planned(herring.zones[0] ?? "park", 0, 1);
      expect(walked({ ...walk, road: { ...walk.road, herrings: [] } })).toEqual(walked(walk));
    },
  );
});
