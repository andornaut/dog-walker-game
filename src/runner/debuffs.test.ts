import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import { applyEffects } from "../rules/effects";
import { read } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { startRoad, stepWalk, type Walk } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const data = gameData;
const { tuning } = data;
const DEBUFF_IDS = Object.keys(data.debuffs) as DebuffId[];
const PACK = Object.fromEntries(
  (Object.keys(data.dogs) as DogId[]).slice(0, 2).map((dog) => [dog, 5]),
);
const GEOMETRY = (() => {
  const road = screenLayout(SCREEN_CONFIG).road;
  const pack = { dogs: Object.keys(PACK) as DogId[], walker: data.defaultWalker };
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
const STEP = 1 / 60;
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

// The seconds a debuff lasts.
function secondsOf(debuff: DebuffId): number {
  return read(tuning, "seconds", data.debuffs[debuff].seconds);
}

describe("debuff durations", () => {
  it.each(DEBUFF_IDS)("%s lasts its data's seconds", (debuff) => {
    const run = withDebuffs(testState(PACK, { zoneIndex: 1 }), [debuff]);
    expect(held(run, debuff)).toEqual({ debuff, secondsLeft: secondsOf(debuff), untilZone: 1 });
  });

  it.each(DEBUFF_IDS)("%s counts down while walking and ends when its time runs out", (debuff) => {
    const seconds = secondsOf(debuff);
    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    const halfway = walkFor(seconds / 2, start);
    expect(held(halfway.run, debuff)?.secondsLeft).toBeCloseTo(seconds / 2, 5);
    expect(held(walkFor(seconds / 2 + STEP, halfway).run, debuff)).toBeUndefined();
  });

  it.each(DEBUFF_IDS)("%s holds its time during a hit stop", (debuff) => {
    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    const stopped: Walk = {
      ...start,
      road: { ...start.road, hitStop: { cards: [], firing: false, seconds: 1, zoneEnded: false } },
    };
    expect(held(walkFor(0.5, stopped).run, debuff)).toEqual(held(start.run, debuff));
  });

  it.each(DEBUFF_IDS)("%s applied again starts its time over", (debuff) => {
    const worn = walkFor(1, walkOf(withDebuffs(testState(PACK), [debuff])));
    const refreshed = withDebuffs(worn.run, [debuff]);
    expect(refreshed.debuffs.filter((active) => active.debuff === debuff)).toHaveLength(1);
    expect(held(refreshed, debuff)?.secondsLeft).toBe(secondsOf(debuff));
  });
});
