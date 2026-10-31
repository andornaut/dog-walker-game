import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { DebuffDriftMovement, GameData, ZoneId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { read } from "../rules/units";
import { newRun, type RunState } from "../state/runState";
import { plannerStreams } from "../testing/movers";
import { laneControlIn } from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";
import { pullHorizon } from "./pulls";
import { runStreams } from "./session";
import { startRoad, steerWalk, stepWalk, type Walk } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";
import { type WalkItem } from "./walkItems";
import { planZone } from "./zonePlan";
import {
  debuffDriftProfile,
  type DebuffMovementClock,
  hasDebuffDrift,
  stepDebuffMovement,
} from "./zoomies";

const ROAD = (() => {
  const road = SCREEN_LAYOUT.road;
  const pack = { dogs: ["kilo", "lady", "ginger"], walker: "casey" } as const;
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
const STEER_EVERY = 200;
const ZOOMIES = { debuff: "zoomies", secondsLeft: 20, untilZone: 0 } as const;
const FIXED: DebuffDriftMovement = {
  direction: "heading",
  interval: { kind: "fixed", seconds: "zoomiesDriftSeconds" },
  kind: "drift",
};
const UNIFORM: DebuffDriftMovement = {
  direction: "random",
  interval: { kind: "uniform", max: "zoomiesDriftMaxSeconds", min: "zoomiesDriftMinSeconds" },
  kind: "drift",
};
const configured = (movement: DebuffDriftMovement): GameData => ({
  ...gameData,
  debuffs: { ...gameData.debuffs, zoomies: { ...gameData.debuffs.zoomies, movement } },
});
const fixed = configured(FIXED);
const uniform: GameData = {
  ...configured(UNIFORM),
  tuning: {
    ...gameData.tuning,
    seconds: {
      ...gameData.tuning.seconds,
      zoomiesDriftMaxSeconds: 1.4,
      zoomiesDriftMinSeconds: 0.6,
    },
  },
};
const EVERY = read(fixed.tuning, "seconds", "zoomiesDriftSeconds");
const zoomed = (run: RunState): RunState => ({
  ...run,
  debuffs: [{ ...ZOOMIES, untilZone: run.zoneIndex }],
});

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
const boardIn = (lane: number, id: number): WalkItem => ({
  height: 30,
  id,
  kind: "sandwichBoard",
  lane,
  laneSpan: 1,
  y: ROAD.packBand.top - 60,
});

function afterDrift(walk: Walk): number {
  return destinationLane(
    stepDebuffMovement(fixed, ROAD, () => 0, EVERY, null, walk).walk.road.control.motion,
  );
}

describe("debuff movement profiles", () => {
  it("moves eligibility and timing with the data assignment", () => {
    const calm = { ...fixed.debuffs.zoomies };
    delete calm.movement;
    const data: GameData = {
      ...fixed,
      debuffs: {
        ...fixed.debuffs,
        stinky: { ...fixed.debuffs.stinky, movement: FIXED },
        zoomies: calm,
      },
    };
    const walk = walkIn(2, 1);
    const random = vi.fn(() => 0);
    expect(hasDebuffDrift(data, walk)).toBe(false);
    expect(stepDebuffMovement(data, ROAD, random, EVERY, null, walk)).toEqual({
      clock: null,
      drifted: null,
      walk,
    });
    expect(random).not.toHaveBeenCalled();
    const stinky = {
      ...walk,
      run: { ...walk.run, debuffs: [{ ...ZOOMIES, debuff: "stinky" as const }] },
    };
    const early = stepDebuffMovement(data, ROAD, random, EVERY / 2, null, stinky);
    expect(early.drifted).toBeNull();
    expect(stepDebuffMovement(data, ROAD, random, EVERY / 2, early.clock, early.walk).drifted).toBe(
      1,
    );
  });

  it("rejects multiple movement owners", () => {
    const data: GameData = {
      ...fixed,
      debuffs: { ...fixed.debuffs, stinky: { ...fixed.debuffs.stinky, movement: FIXED } },
    };
    expect(() => debuffDriftProfile(data)).toThrow("Only one debuff may define movement");
  });

  it.each([
    { ...FIXED, kind: "teleport" },
    { ...FIXED, direction: "left" },
    { ...FIXED, interval: { kind: "exponential" } },
  ])("rejects unsupported strategies %o", (movement) => {
    expect(() =>
      debuffDriftProfile(configured(movement as unknown as DebuffDriftMovement)),
    ).toThrow("Unsupported debuff");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid fixed interval %s",
    (seconds) => {
      const data: GameData = {
        ...fixed,
        tuning: {
          ...fixed.tuning,
          seconds: { ...fixed.tuning.seconds, zoomiesDriftSeconds: seconds },
        },
      };
      expect(() => debuffDriftProfile(data)).toThrow("positive, finite and ordered");
    },
  );

  it.each([
    [0, 1],
    [1, 0.5],
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
  ])("rejects invalid uniform interval %s..%s", (min, max) => {
    const data: GameData = {
      ...uniform,
      tuning: {
        ...uniform.tuning,
        seconds: {
          ...uniform.tuning.seconds,
          zoomiesDriftMaxSeconds: max,
          zoomiesDriftMinSeconds: min,
        },
      },
    };
    expect(() => debuffDriftProfile(data)).toThrow("positive, finite and ordered");
  });
});

describe("debuff movement schedule", () => {
  it("retains explicit heading and fixed timing without consuming randomness", () => {
    const random = vi.fn(() => 0);
    for (const [lane, heading, expected] of [
      [2, 1, 3],
      [2, -1, 1],
      [2, undefined, 3],
      [4, 1, 3],
      [0, -1, 1],
    ] satisfies readonly [number, LaneDirection | undefined, number][]) {
      const result = stepDebuffMovement(fixed, ROAD, random, EVERY, null, walkIn(lane, heading));
      expect(destinationLane(result.walk.road.control.motion)).toBe(expected);
    }
    expect(random).not.toHaveBeenCalled();
  });

  it("uses the safe opposite or cancels without moving when neither lane is safe", () => {
    for (const [lane, items, expected] of [
      [2, [boardIn(3, 0)], 1],
      [2, [boardIn(3, 0), boardIn(1, 1)], 2],
      [4, [boardIn(3, 0)], 4],
    ] satisfies readonly [number, WalkItem[], number][]) {
      expect(afterDrift(walkIn(lane, 1, items))).toBe(expected);
    }
  });

  it.each([0, 0.25, 0.5, 1])("samples uniform interval once at activation with draw %s", (draw) => {
    const random = vi.fn(() => draw);
    const first = stepDebuffMovement(uniform, ROAD, random, 0, null, walkIn(2));
    expect(first.clock?.interval).toBeCloseTo(0.6 + 0.8 * draw);
    expect(first.clock?.elapsed).toBe(0);
    let current = first;
    for (let step = 0; step < 10; step++) {
      current = stepDebuffMovement(
        uniform,
        ROAD,
        random,
        STEP_SECONDS,
        current.clock,
        current.walk,
      );
    }
    expect(current.clock?.interval).toBe(first.clock?.interval);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it.each([0, 0.49, 0.5, 0.999])(
    "chooses a fresh independent half-probability direction with draw %s",
    (draw) => {
      const random = vi
        .fn()
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(draw)
        .mockReturnValue(0.5);
      const first = stepDebuffMovement(
        uniform,
        ROAD,
        random,
        0,
        null,
        walkIn(2, draw < 0.5 ? 1 : -1),
      );
      const attempted = stepDebuffMovement(
        uniform,
        ROAD,
        random,
        first.clock?.interval ?? 0,
        first.clock,
        first.walk,
      );
      expect(attempted.drifted).toBe(draw < 0.5 ? -1 : 1);
      expect(attempted.clock?.elapsed).toBeCloseTo(0);
      expect(random).toHaveBeenCalledTimes(3);
    },
  );

  it("resamples after a blocked attempt and retains the walking-time remainder", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.9).mockReturnValue(1);
    const walk = walkIn(2, 1, [boardIn(1, 0), boardIn(3, 1)]);
    const first = stepDebuffMovement(uniform, ROAD, random, 0, null, walk);
    const blocked = stepDebuffMovement(uniform, ROAD, random, 0.7, first.clock, walk);
    expect(blocked.drifted).toBeNull();
    expect(blocked.walk).toBe(walk);
    expect(blocked.clock?.elapsed).toBeCloseTo(0.1);
    expect(blocked.clock?.interval).toBeCloseTo(1.4);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it.each([1, 1.5])("attempts on the fixed step that completes %s seconds", (seconds) => {
    const data: GameData = {
      ...fixed,
      tuning: {
        ...fixed.tuning,
        seconds: { ...fixed.tuning.seconds, zoomiesDriftSeconds: seconds },
      },
    };
    let current = stepDebuffMovement(data, ROAD, () => 0, 0, null, walkIn(2, 1));
    let steps = 0;
    while (current.drifted === null) {
      current = stepDebuffMovement(data, ROAD, () => 0, STEP_SECONDS, current.clock, current.walk);
      steps++;
    }
    expect(steps).toBe(Math.round(seconds / STEP_SECONDS));
    expect(current.clock?.elapsed).toBeGreaterThanOrEqual(0);
  });

  it("freezes clock and random draws during hit stops and cards", () => {
    const walk = walkIn(2);
    const clock: DebuffMovementClock = { debuff: "zoomies", elapsed: 0.2, interval: 1 };
    const random = vi.fn(() => 0.5);
    const stopped: readonly Walk[] = [
      {
        ...walk,
        road: { ...walk.road, hitStop: { cards: [], firing: false, seconds: 1, zoneEnded: false } },
      },
      {
        ...walk,
        run: {
          ...walk.run,
          phase: {
            kind: "card",
            source: { affected: ["kilo"], encounter: "skunk", kind: "encounter" },
          },
        },
      },
    ];
    for (const state of stopped) {
      expect(stepDebuffMovement(uniform, ROAD, random, 1, clock, state)).toEqual({
        clock,
        drifted: null,
        walk: state,
      });
      expect(stepDebuffMovement(uniform, ROAD, random, 1, null, state).clock).toBeNull();
    }
    expect(random).not.toHaveBeenCalled();
  });

  it("does not schedule prevented or inactive movement and resets on expiry", () => {
    const walk = walkIn(2);
    const calm = { ...walk, run: { ...walk.run, debuffs: [] } };
    const random = vi.fn(() => 0.5);
    const result = stepDebuffMovement(
      uniform,
      ROAD,
      random,
      1,
      { debuff: "zoomies", elapsed: 0.2, interval: 1 },
      calm,
    );
    expect(result).toEqual({ clock: null, drifted: null, walk: calm });
    expect(random).not.toHaveBeenCalled();
  });

  it("keeps the scheduled interval when an active effect is refreshed", () => {
    const random = vi.fn(() => 0.5);
    const first = stepDebuffMovement(uniform, ROAD, random, 0.1, null, walkIn(2));
    const refreshed = {
      ...first.walk,
      run: {
        ...first.walk.run,
        debuffs: [
          {
            ...ZOOMIES,
            secondsLeft: read(uniform.tuning, "seconds", uniform.debuffs.zoomies.seconds),
          },
        ],
      },
    };
    const next = stepDebuffMovement(uniform, ROAD, random, 0.1, first.clock, refreshed);
    expect(next.clock?.interval).toBe(first.clock?.interval);
    expect(next.clock?.elapsed).toBeCloseTo(0.2);
    expect(random).toHaveBeenCalledTimes(1);
  });
});

// With the Zoomies on all the time and nobody steering, the pack drifts about the road; no
// obstacle may reach it in a lane it drifted into sooner than the pulls' rule allows.
describe("the Zoomies on every zone's road", { timeout: 120_000 }, () => {
  const zones = gameData.world.zones.map(({ id }) => id as ZoneId);

  it("drift into no unavoidable hit on any zone's road", () => {
    for (const [zone, seed] of zones.map((zone) => [zone, 1] as const)) {
      const start = newRun(gameData, 3, {
        dogs: ["kilo", "lady", "ginger"],
        gear: null,
        walker: "casey",
      });
      const run: RunState = { ...start, invincible: true, route: [zone] };
      let walk = planZone(gameData, ROAD, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run,
      });
      const random = seededRandom(seed);
      let movementClock: DebuffMovementClock | null = null;
      const movementRandom = runStreams(seed).debuffMovement(run.zoneIndex);
      let clock = 0;
      let drifts = 0;
      let lastDrift: { at: number; horizon: number; to: number } | null = null;
      let steps = 0;
      const unavoidable: string[] = [];
      while (clock < 400) {
        walk = { ...walk, run: zoomed(walk.run) };
        // Every STEER_EVERY steps the player steers once toward the middle lane, turning the
        // movement back toward the middle; a hit after a steer is the player's, not the drift's.
        steps += 1;
        if (steps % STEER_EVERY === 0) {
          const lane = destinationLane(walk.road.control.motion);
          walk = steerWalk(gameData, LANE_COUNT, lane < LANE_COUNT / 2 ? 1 : -1, walk);
          lastDrift = null;
        }
        const from = destinationLane(walk.road.control.motion);
        const drift = stepDebuffMovement(
          gameData,
          ROAD,
          movementRandom,
          STEP_SECONDS,
          movementClock,
          walk,
        );
        movementClock = drift.clock;
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
      expect(hasDebuffDrift(gameData, walk)).toBe(true);
      expect(drifts, zone).toBeGreaterThan(10);
      expect(unavoidable, zone).toEqual([]);
    }
  });
});
