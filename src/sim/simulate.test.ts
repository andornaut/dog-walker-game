import { beforeAll, describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DebuffId, MinorObstacleId } from "../data/types";
import { itemAt } from "../lib/arrays";
import { TALLY_IDS } from "../save/schema";
import { packDogs, packOrder } from "../state/pack";
import type { PackDogs, RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { IDEAL_SKILL, simConfig } from "../testing/sim";
import { badgeCounters } from "./report";
import { type RunResult, type SimConfig, simulateRun } from "./simulate";
import { type Skill, SKILL_PRESETS } from "./skills";

const TRIO: PackDogs = ["duchess", "biscuit", "kilo"];
const RISKY: PackDogs = ["buddy", "archie", "snowball"];
// A bot that misses every lane change it plans, so it walks into whatever comes.
const BLIND: Skill = {
  errorRate: 1,
  laneChangeCooldown: 0,
  lookAheadSeconds: 0,
  reactionSeconds: 0,
};

type Overrides = Partial<Omit<SimConfig, "player">> & { readonly skill?: Skill };

function config(overrides: Overrides = {}): SimConfig {
  const { pack = TRIO, skill = SKILL_PRESETS.typical, ...rest } = overrides;
  return simConfig(skill, pack, rest);
}

function runs(count: number, overrides: Overrides = {}): RunResult[] {
  return Array.from({ length: count }, (_, seed) =>
    simulateRun(gameData, seed + 1, config(overrides)),
  );
}

// Every run plans each zone with the spawn planner, tens of milliseconds a zone, and the first
// run in a worker also pays the warm-up: enough to pass 5 s on an oversubscribed machine.
describe("simulateRun", { timeout: 30_000 }, () => {
  it("gives the same result for the same seed", () => {
    const risky = config({ pack: RISKY, skill: SKILL_PRESETS.novice });
    const first = simulateRun(gameData, 7, risky);
    const second = simulateRun(gameData, 7, risky);
    const other = simulateRun(gameData, 8, risky);

    expect(second).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("walks different zones from the first zone, taking the route policy's path at each fork", () => {
    const order = gameData.world.zones.map(({ id }) => id);
    const routeOf = (route: SimConfig["route"]) =>
      itemAt(runs(1, { policy: "alwaysPay", route, skill: IDEAL_SKILL }), 0).route;
    const [left, right, random] = [routeOf("left"), routeOf("right"), routeOf("random")];
    for (const route of [left, right, random]) {
      expect(route.length).toBeLessThanOrEqual(gameData.world.walkLength);
      expect(route[0]).toBe(gameData.world.firstZone);
      expect(new Set(route).size).toBe(route.length);
    }
    // A fork offers 3 of the zones left after the first zone: the easiest offered is one of the 3
    // easiest left, and the hardest one of the 3 hardest. The ideal player reaches the first fork.
    const after = order
      .filter((zone) => zone !== gameData.world.firstZone)
      .map((zone) => order.indexOf(zone));
    expect(after.slice(0, 3)).toContain(order.indexOf(defined(left[1])));
    expect(after.slice(-3)).toContain(order.indexOf(defined(right[1])));
  });

  it("never pays money with the alwaysHearts policy", () => {
    const choices = runs(2, { pack: RISKY, policy: "alwaysHearts", skill: BLIND }).flatMap(
      (result) => result.choices,
    );

    expect(choices.length).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0)).toEqual([]);
  });

  // A cash option the purse can't cover is disabled, so with the tuned starting purse whether
  // the blind walk can pay depends on the tips it grabs before its pack is fired. Starting with
  // a purse of the dearest card option's price, every card's cash option is open from the
  // first card.
  it("pays for cards with the alwaysPay policy", () => {
    const { money } = gameData.tuning;
    const prices = Object.values(gameData.encounters).flatMap(({ resolution }) =>
      resolution.kind === "card"
        ? resolution.options.map(({ effects }) =>
            effects.reduce(
              (sum, effect) =>
                effect.kind === "money" && effect.change === "lose"
                  ? sum + money[effect.amount]
                  : sum,
              0,
            ),
          )
        : [],
    );
    const flush = {
      ...gameData,
      tuning: {
        ...gameData.tuning,
        money: { ...money, startPurse: Math.ceil(Math.max(...prices)) },
      },
    };
    const paying = config({ pack: RISKY, policy: "alwaysPay", skill: BLIND });
    const choices = [1, 2].flatMap((seed) => simulateRun(flush, seed, paying).choices);

    expect(Math.max(...prices)).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0).length).toBeGreaterThan(0);
  });

  // The mixed policy draws its choices from the seed.
  it("gives the same choices for the same seed with the mixed policy", () => {
    const played = () => runs(1, { pack: RISKY, policy: "mixed", skill: BLIND });
    expect(played()).toEqual(played());
  });

  // What each fee pays is the run rules' own test; this checks the walk pays the dogs it should.
  it("holds each zone's pay for every dog still walking at its end", () => {
    const results = runs(2, { pack: RISKY, policy: "alwaysHearts", skill: SKILL_PRESETS.novice });

    for (const result of results) {
      for (const zone of result.zones) {
        const gone = result.firings
          .filter((firing) => firing.zoneIndex <= zone.zoneIndex)
          .map((firing) => firing.dog);
        const walking = packOrder(gameData.dogs, RISKY).filter((dog) => !gone.includes(dog));
        expect(zone.fees.map((fee) => fee.dog)).toEqual(walking);
      }
    }
  });

  it("ends with no dogs when every owner has fired you", () => {
    const ended = runs(3, { pack: ["archie"], policy: "alwaysHearts", skill: BLIND }).filter(
      (result) => !result.finished,
    );

    expect(ended.length).toBeGreaterThan(0);
    for (const result of ended) {
      expect(result.firings.map((firing) => firing.dog)).toEqual(["archie"]);
      expect(result.zones.length).toBeLessThan(gameData.world.walkLength);
    }
  });
});

// The badge counters of a few real walks match what their sessions counted.
describe("badgeCounters", { timeout: 30_000 }, () => {
  let results: RunResult[] = [];
  beforeAll(() => {
    results = runs(2, { pack: RISKY, policy: "alwaysHearts", skill: SKILL_PRESETS.novice });
  }, 30_000);
  const counters = () =>
    badgeCounters(
      gameData,
      RISKY.length,
      results.map((result) => result.facts),
    );
  const sessionMean = (count: (run: RunState, result: RunResult) => number) =>
    results.reduce((sum, result) => sum + count(result.run, result), 0) / results.length;
  const finished = (result: RunResult) =>
    result.finished && result.zones.length === gameData.world.walkLength;
  const cleanZones = (result: RunResult) =>
    result.zones.filter(({ zoneIndex }) => (result.run.bumpsByZone[zoneIndex] ?? 0) === 0).length;

  it("counts some tallies, so the comparisons are not all of zeros", () => {
    expect(Object.values(counters().meanTallies).some((count) => count > 0)).toBe(true);
  });

  it.each(TALLY_IDS)("gives the mean %s per walk", (tally) => {
    expect(counters().meanTallies[tally]).toBe(sessionMean((run) => run.tallies[tally] ?? 0));
  });

  it.each(Object.keys(gameData.minorObstacles) as MinorObstacleId[])(
    "gives the mean landed bumps by %s per walk",
    (kind) => {
      expect(counters().meanBumpsByKind[kind]).toBe(
        sessionMean((run) => run.bumpsByKind[kind] ?? 0),
      );
    },
  );

  // Of 2 walks, the 90th percentile is the higher.
  it.each(Object.keys(gameData.debuffs) as DebuffId[])(
    "gives the mean and 90th percentile times %s was got in a walk",
    (debuff) => {
      const got = results.map((result) => result.run.debuffsGot[debuff] ?? 0);
      expect(counters().debuffsGot[debuff]).toEqual({
        mean: sessionMean((run) => run.debuffsGot[debuff] ?? 0),
        p90: Math.max(...got),
      });
    },
  );

  it.each([
    {
      field: "allCleanShare",
      holds: (result: RunResult) =>
        finished(result) && cleanZones(result) === gameData.world.walkLength,
    },
    { field: "cleanZoneShare", holds: (result: RunResult) => cleanZones(result) > 0 },
    {
      field: "fullPackBonusShare",
      holds: (result: RunResult) =>
        finished(result) && packDogs(result.run).length === RISKY.length,
    },
    {
      field: "lastHeartShare",
      holds: (result: RunResult) =>
        finished(result) &&
        result.run.pack.some((slot) => slot.status === "walking" && slot.hearts === 1),
    },
  ] as const)("gives $field as the share of walks it holds for", ({ field, holds }) => {
    expect(counters()[field]).toBe(sessionMean((_, result) => (holds(result) ? 1 : 0)));
  });

  it("gives no Walk bonus share for a pack under the most dogs", () => {
    const facts = results.map((result) => result.facts);
    expect(badgeCounters(gameData, RISKY.length - 1, facts).fullPackBonusShare).toBeNull();
  });
});
