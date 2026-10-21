import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { itemAt } from "../lib/arrays";
import { packOrder } from "../state/pack";
import type { PackDogs } from "../state/runState";
import { defined } from "../testing/defined";
import { type RunResult, type SimConfig, simulateRun } from "./simulate";
import { IDEAL_SKILL, type Skill, SKILL_PRESETS } from "./skills";

const TRIO: PackDogs = ["duchess", "biscuit", "koda"];
const RISKY: PackDogs = ["zippy", "archie", "snowball"];
// A bot that misses every lane change it plans, so it walks into whatever comes.
const BLIND: Skill = {
  errorRate: 1,
  laneChangeCooldown: 0,
  lookAheadSeconds: 0,
  reactionSeconds: 0,
};

type Overrides = Partial<Omit<SimConfig, "player">> & { readonly skill?: Skill };

function config(overrides: Overrides = {}): SimConfig {
  const { skill = SKILL_PRESETS.typical, ...rest } = overrides;
  return {
    gear: null,
    pack: TRIO,
    player: { kind: "skill", skill },
    policy: "heartsUnlessLow",
    route: "straight",
    walker: "casey",
    ...rest,
  };
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

  it("pays for cards with the alwaysPay policy", () => {
    const choices = runs(2, { pack: RISKY, policy: "alwaysPay", skill: BLIND }).flatMap(
      (result) => result.choices,
    );

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
      expect(result.zonesCompleted).toBeLessThan(gameData.world.walkLength);
    }
  });
});
