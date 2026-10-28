import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { ZoneId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { seededRandom } from "../lib/random";
import { read } from "../rules/units";
import { newRun, type RunState } from "../state/runState";
import { plannerStreams } from "../testing/movers";
import { STEP_SECONDS } from "./fixedStep";
import { laneControlIn } from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";
import { pullHorizon } from "./pulls";
import { startRoad, steerWalk, stepWalk, type Walk } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";
import { type WalkItem } from "./walkItems";
import { planZone } from "./zonePlan";
import { hasZoomies, stepZoomies } from "./zoomies";

// The game's road for the pack of three the drift test walks; walkIn's lone Kilo leads it.
const ROAD = (() => {
  const road = SCREEN_LAYOUT.road;
  const pack = { dogs: ["kilo", "biscuit", "duchess"], walker: "casey" } as const;
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
const EVERY = read(gameData.tuning, "seconds", "zoomiesDriftSeconds");
// Steps between the test player's steers, a little over three drifts.
const STEER_EVERY = 200;
const ZOOMIES = { debuff: "zoomies", secondsLeft: 20, untilZone: 0 } as const;

const zoomed = (run: RunState): RunState => ({
  ...run,
  debuffs: [{ ...ZOOMIES, untilZone: run.zoneIndex }],
});

// A walk in lane, heading heading, with nothing on the road.
function walkIn(lane: number, heading?: LaneDirection, items: readonly WalkItem[] = []): Walk {
  const run = newRun(gameData, 3, { dogs: ["kilo"], gear: null, walker: "casey" });
  const control = laneControlIn(stillInLane(lane));
  return {
    road: {
      ...startRoad(LANE_COUNT),
      control: heading === undefined ? control : { ...control, heading },
      items,
    },
    run: zoomed(run),
  };
}

// The lane the pack heads for after one drift's worth of walking.
function afterDrift(walk: Walk): number {
  return destinationLane(stepZoomies(gameData, ROAD, EVERY, 0, walk).walk.road.control.motion);
}

describe("stepZoomies", () => {
  it("drifts the pack toward its heading, or back from an edge", () => {
    for (const [, lane, heading, expected] of [
      ["toward its heading", 2, 1, 3],
      ["back toward its heading", 2, -1, 1],
      ["to the right before the pack has moved", 2, undefined, 3],
      ["back from the right edge", LANE_COUNT - 1, 1, LANE_COUNT - 2],
      ["back from the left edge", 0, -1, 1],
    ] satisfies readonly [string, number, LaneDirection | undefined, number][]) {
      expect(afterDrift(walkIn(lane, heading))).toBe(expected);
    }
  });

  it("waits zoomiesDriftSeconds of walking between drifts", () => {
    const walk = walkIn(2, 1);
    const early = stepZoomies(gameData, ROAD, EVERY / 2, 0, walk);
    expect(early.drifted).toBeNull();
    expect(stepZoomies(gameData, ROAD, EVERY / 2, early.seconds, early.walk).drifted).toBe(1);
  });

  // 90 fixed steps sum to just under 1.5 s.
  it.each([1, 1.5])("drifts on the fixed step that walks %f s", (every) => {
    const { tuning } = gameData;
    const data = {
      ...gameData,
      tuning: { ...tuning, seconds: { ...tuning.seconds, zoomiesDriftSeconds: every } },
    };
    let stepped = stepZoomies(data, ROAD, STEP_SECONDS, 0, walkIn(2, 1));
    let steps = 1;
    while (stepped.drifted === null) {
      stepped = stepZoomies(data, ROAD, STEP_SECONDS, stepped.seconds, stepped.walk);
      steps += 1;
    }
    expect(steps).toBe(Math.round(every / STEP_SECONDS));
  });

  it("rests its clock without the Zoomies", () => {
    const walk = walkIn(2, 1);
    const calm = { ...walk, run: { ...walk.run, debuffs: [] } };
    expect(stepZoomies(gameData, ROAD, EVERY, 0.5, calm)).toEqual({
      drifted: null,
      seconds: 0,
      walk: calm,
    });
  });

  // A cone close ahead in a lane, as the pulls' rule sees it: too close to react to.
  const coneIn = (lane: number, id: number): WalkItem => ({
    height: 30,
    id,
    kind: "cone",
    lane,
    laneSpan: 1,
    y: ROAD.packBand.top - 60,
  });

  it("drifts away from obstacles it cannot react to, and nowhere when blocked", () => {
    for (const [, lane, items, expected] of [
      ["the other way from an obstacle it can't react to", 2, [coneIn(3, 0)], 1],
      ["nowhere with both lanes blocked", 2, [coneIn(3, 0), coneIn(1, 1)], 2],
      [
        "nowhere at the edge with the lane back blocked",
        LANE_COUNT - 1,
        [coneIn(LANE_COUNT - 2, 0)],
        LANE_COUNT - 1,
      ],
    ] satisfies readonly [string, number, WalkItem[], number][]) {
      expect(afterDrift(walkIn(lane, 1, items))).toBe(expected);
    }
  });

  it("keeps drifting the other way after turning at the edge", () => {
    const first = stepZoomies(gameData, ROAD, EVERY, 0, walkIn(LANE_COUNT - 1, 1));
    expect(first.drifted).toBe(-1);
    expect(stepZoomies(gameData, ROAD, EVERY, 0, first.walk).drifted).toBe(-1);
  });
});

// With the Zoomies on all the time and nobody steering, the pack drifts about the road; no
// obstacle may reach it in a lane it drifted into sooner than the pulls' rule allows.
describe("the Zoomies on every zone's road", { timeout: 120_000 }, () => {
  const zones = gameData.world.zones.map(({ id }) => id as ZoneId);

  it("drift into no unavoidable hit on any zone's road", () => {
    for (const [zone, seed] of zones.map((zone) => [zone, 1] as const)) {
      const start = newRun(gameData, 3, {
        dogs: ["kilo", "biscuit", "duchess"],
        gear: null,
        walker: "casey",
      });
      const run: RunState = { ...start, invincible: true, route: [zone] };
      let walk = planZone(gameData, ROAD, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run,
      });
      const random = seededRandom(seed);
      let seconds = 0;
      let clock = 0;
      let drifts = 0;
      let lastDrift: { at: number; horizon: number; to: number } | null = null;
      let steps = 0;
      const unavoidable: string[] = [];
      while (clock < 400) {
        walk = { ...walk, run: zoomed(walk.run) };
        // Every STEER_EVERY steps the player steers once toward the middle lane, turning the
        // drift around; a hit after a steer is the player's, not the drift's.
        steps += 1;
        if (steps % STEER_EVERY === 0) {
          const lane = destinationLane(walk.road.control.motion);
          walk = steerWalk(gameData, LANE_COUNT, lane < LANE_COUNT / 2 ? 1 : -1, walk);
          lastDrift = null;
        }
        const from = destinationLane(walk.road.control.motion);
        const drift = stepZoomies(gameData, ROAD, STEP_SECONDS, seconds, walk);
        seconds = drift.seconds;
        if (drift.drifted !== null) {
          drifts += 1;
          const to = from + drift.drifted;
          lastDrift = { at: clock, horizon: pullHorizon(gameData, drift.walk), to };
        }
        const step = stepWalk(gameData, ROAD, random, STEP_SECONDS, drift.walk);
        // A card obstacle met this step is the one of its kind that left the road.
        const cards = drift.walk.road.items.filter(
          (item) =>
            step.encounterHits.some(({ encounter }) => encounter === item.kind) &&
            !step.walk.road.items.some(({ id }) => id === item.id),
        );
        const hit = [
          ...step.bumps.map(({ item }) => item),
          ...step.contacts.map(({ item }) => item),
          ...cards,
        ];
        const recent = lastDrift;
        if (recent !== null && clock - recent.at < recent.horizon) {
          for (const item of hit) {
            // The pulls' rule keeps the lane drifted into clear; the side dogs reach past it.
            const inTo = recent.to >= item.lane && recent.to < item.lane + item.laneSpan;
            if (inTo) {
              unavoidable.push(
                `${item.kind} ${(clock - recent.at).toFixed(2)}s after a drift, horizon ${recent.horizon}`,
              );
            }
          }
        }
        walk = { ...step.walk, run: { ...step.walk.run, phase: { kind: "walking" } } };
        clock += STEP_SECONDS;
        if (step.zoneEnded) {
          break;
        }
      }
      expect(hasZoomies(walk)).toBe(true);
      expect(drifts, zone).toBeGreaterThan(10);
      expect(unavoidable, zone).toEqual([]);
    }
  });
});
