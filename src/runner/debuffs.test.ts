import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import { applyEffects } from "../rules/effects";
import { read } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { isSteeringLocked } from "./laneControl";
import { needFillRate } from "./needs";
import {
  laneChangeLockSeconds,
  laneMoveSeconds,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
} from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const data = gameData;
const { tuning } = data;
const DEBUFF_IDS = Object.keys(data.debuffs) as DebuffId[];
const GEOMETRY = (() => {
  const road = screenLayout(SCREEN_CONFIG).road;
  return walkGeometry(LANE_COUNT, 3, walkProjection(ROAD_CAMERA, road), road);
})();
const STEP = 1 / 60;
// Two dogs with no sled dog or nervous quirk, so lane moves and needs are at their base.
const PLAIN_DOGS = (Object.keys(data.dogs) as DogId[]).filter(
  (dog) => !["nervous", "sledDog"].includes(data.dogs[dog].quirk),
);
const PLAIN_DOG = itemAt(PLAIN_DOGS, 0);
const PACK = Object.fromEntries(PLAIN_DOGS.slice(0, 2).map((dog) => [dog, 5]));
const noRandom = () => 0;

const withDebuffs = (run: RunState, ids: readonly DebuffId[]): RunState =>
  applyEffects(
    data,
    { affected: [], random: noRandom, source: { kind: "walker", walker: run.walker } },
    ids.map((debuff) => ({ debuff, kind: "debuff" as const })),
    run,
  );

const walkOf = (run: RunState): Walk => ({ road: startRoad(LANE_COUNT), run });

// Steps the walk this many seconds, a 60 Hz step at a time.
function walkFor(seconds: number, walk: Walk): Walk {
  let next = walk;
  for (let step = 0; step < Math.round(seconds / STEP); step++) {
    next = stepWalk(data, GEOMETRY, noRandom, STEP, next).walk;
  }
  return next;
}

const held = (run: RunState, debuff: DebuffId): ActiveDebuff | undefined =>
  run.debuffs.find((active) => active.debuff === debuff);

// The seconds a debuff lasts, or null for one that lasts the zone.
function secondsOf(debuff: DebuffId): number | null {
  const { duration } = data.debuffs[debuff];
  return duration === "zone" ? null : read(tuning, "seconds", duration.seconds);
}

describe("debuff durations", () => {
  it.each(DEBUFF_IDS)("%s lasts its data's duration, through the zone at most", (debuff) => {
    const run = withDebuffs(testState(PACK, { zoneIndex: 1 }), [debuff]);
    const seconds = secondsOf(debuff);
    expect(held(run, debuff)).toEqual({
      debuff,
      ...(seconds === null ? {} : { secondsLeft: seconds }),
      untilZone: 1,
    });
  });

  const timed = DEBUFF_IDS.filter((debuff) => secondsOf(debuff) !== null);
  const zoneLong = DEBUFF_IDS.filter((debuff) => secondsOf(debuff) === null);

  it.each(timed)("%s counts down while walking and ends when its time runs out", (debuff) => {
    const seconds = secondsOf(debuff) ?? 0;
    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    const halfway = walkFor(seconds / 2, start);
    expect(held(halfway.run, debuff)?.secondsLeft).toBeCloseTo(seconds / 2, 5);
    expect(held(walkFor(seconds / 2 + STEP, halfway).run, debuff)).toBeUndefined();
  });

  it.each(timed)("%s holds its time during a hit stop", (debuff) => {
    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    const stopped: Walk = {
      ...start,
      road: { ...start.road, hitStop: { cards: [], seconds: 1, zoneEnded: false } },
    };
    expect(held(walkFor(0.5, stopped).run, debuff)).toEqual(held(start.run, debuff));
  });

  it.each(timed)("%s applied again starts its time over", (debuff) => {
    const worn = walkFor(1, walkOf(withDebuffs(testState(PACK), [debuff])));
    const refreshed = withDebuffs(worn.run, [debuff]);
    expect(refreshed.debuffs.filter((active) => active.debuff === debuff)).toHaveLength(1);
    expect(held(refreshed, debuff)?.secondsLeft).toBe(secondsOf(debuff));
  });

  it.each(zoneLong)("%s does not count down while walking", (debuff) => {
    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    expect(held(walkFor(1, start).run, debuff)).toEqual(held(start.run, debuff));
  });
});

describe("debuff modifiers", () => {
  // Each stat a debuff changes, read with and without the debuff; laneChangeLock is the lock
  // the pack is left with once one lane change arrives.
  const lockAfterLaneChange = (run: RunState) => {
    const steered = steerWalk(data, LANE_COUNT, 1, walkOf(run));
    return walkFor(laneMoveSeconds(data, run) + STEP, steered).road.control.lockSeconds;
  };
  const measures = {
    laneChangeLock: lockAfterLaneChange,
    laneMove: (run: RunState) => laneMoveSeconds(data, run),
    needUrgency: (run: RunState) => needFillRate(data, run, PLAIN_DOG),
  } as const;
  type Measured = keyof typeof measures;
  const cases = DEBUFF_IDS.flatMap((debuff) =>
    data.debuffs[debuff].modifiers.flatMap((modifier) =>
      modifier.stat in measures ? [{ debuff, modifier, stat: modifier.stat as Measured }] : [],
    ),
  );

  it("covers the Spooked, Tangled and Tuckered out stats", () => {
    expect(cases.map(({ stat }) => stat).sort()).toEqual(
      expect.arrayContaining(["laneChangeLock", "laneMove", "needUrgency"]),
    );
  });

  it.each(cases)("$debuff changes $stat by its tuning key", ({ debuff, modifier, stat }) => {
    const plain = testState(PACK);
    const before = measures[stat](plain);
    const after = measures[stat](withDebuffs(plain, [debuff]));
    if (modifier.operation === "multiply") {
      expect(after).toBeCloseTo(before * read(tuning, "multipliers", modifier.by), 5);
    } else if (modifier.stat === "laneChangeLock") {
      expect(after - before).toBeCloseTo(read(tuning, "seconds", modifier.by), 1);
    } else {
      throw new Error(`No measure adds to ${modifier.stat}`);
    }
  });

  it("locks the next lane change after one arrives while Tangled, and not without it", () => {
    const tangled = withDebuffs(testState(PACK), ["tangled"]);
    const lock = laneChangeLockSeconds(data, tangled);
    expect(lock).toBe(read(tuning, "seconds", "tangledLaneLock"));
    const arrived = (run: RunState) =>
      walkFor(laneMoveSeconds(data, run) + STEP, steerWalk(data, LANE_COUNT, 1, walkOf(run)));
    expect(isSteeringLocked(arrived(tangled).road.control)).toBe(true);
    expect(isSteeringLocked(arrived(testState(PACK)).road.control)).toBe(false);
    // Once the lock runs out, the pack steers again.
    const free = walkFor(lock + STEP, arrived(tangled));
    const target = free.road.control.target;
    expect(steerWalk(data, LANE_COUNT, 1, free).road.control.target).toBe(target + 1);
  });
});
