import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { zoneFee } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import { zoneAt } from "../rules/route";
import { cents } from "../rules/units";
import { walkerEffects } from "../rules/walkers";
import type { PackDogs } from "../state/runState";
import type { PolicyId } from "./policies";
import { DEFAULT_RATES, type RunResult, type SimConfig, simulateRun } from "./simulate";

const STARTERS: PackDogs = ["duchess", "biscuit", "koda"];
const RISKY: PackDogs = ["zippy", "archie", "snowball"];

// A config whose player hits and collects at fixed rates, the rates given with the rest.
type Overrides = Partial<Omit<SimConfig, "player">> & {
  readonly hitRate?: number;
  readonly luckyRate?: number;
  readonly tipRate?: number;
  readonly treatRate?: number;
};

function config(overrides: Overrides = {}): SimConfig {
  const { hitRate = 0.1, luckyRate, tipRate, treatRate, ...rest } = overrides;
  return {
    gear: null,
    pack: STARTERS,
    player: {
      hitRate,
      kind: "rates",
      luckyRate: luckyRate ?? DEFAULT_RATES.luckyRate,
      tipRate: tipRate ?? DEFAULT_RATES.tipRate,
      treatRate: treatRate ?? DEFAULT_RATES.treatRate,
    },
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
describe("simulateRun", { timeout: 15_000 }, () => {
  it("plays a run whose zone has no room left for a hedge, skipping the hedge", () => {
    const run = () =>
      simulateRun(
        gameData,
        114000343,
        config({ luckyRate: 0.7, pack: ["koda", "biscuit"], tipRate: 0.7, treatRate: 0.7 }),
      );
    expect(run).not.toThrow();
    expect(run()).toEqual(run());
  });

  it("gives the same result for the same seed", () => {
    const risky = config({ hitRate: 0.25, pack: RISKY });
    const first = simulateRun(gameData, 7, risky);
    const second = simulateRun(gameData, 7, risky);
    const other = simulateRun(gameData, 8, risky);

    expect(second).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("plays every zone of a run that keeps its dogs", () => {
    const [result] = runs(1, { hitRate: 0, policy: "alwaysPay" });

    expect(result?.finished).toBe(true);
    expect(result?.zonesCompleted).toBe(gameData.world.walkLength);
    expect(result?.choices.filter((choice) => choice.from === "forcedStop")).toHaveLength(
      gameData.world.walkLength,
    );
  });

  it("walks 4 different zones from the first zone, taking the route policy's path at each fork", () => {
    const order = gameData.world.zones.map(({ id }) => id);
    const routeOf = (route: SimConfig["route"]) =>
      runs(3, { hitRate: 0, policy: "alwaysPay", route }).map((result) => result.route);
    for (const route of [...routeOf("left"), ...routeOf("right"), ...routeOf("random")]) {
      expect(route).toHaveLength(gameData.world.walkLength);
      expect(route[0]).toBe("street");
      expect(new Set(route).size).toBe(route.length);
    }
    // A fork offers 3 of the 5 zones left after the first zone: the easiest offered is one of the 3
    // easiest left, and the hardest one of the 3 hardest.
    const firstPick = (route: SimConfig["route"]) =>
      routeOf(route).map((walked) => order.indexOf(walked[1] ?? "street"));
    const after = order.filter((zone) => zone !== "street").map((zone) => order.indexOf(zone));
    for (const pick of firstPick("left")) {
      expect(after.slice(0, 3)).toContain(pick);
    }
    for (const pick of firstPick("right")) {
      expect(after.slice(-3)).toContain(pick);
    }
  });

  it("never pays money with the alwaysHearts policy", () => {
    const choices = runs(4, { hitRate: 0.2, pack: RISKY, policy: "alwaysHearts" }).flatMap(
      (result) => result.choices,
    );

    expect(choices.length).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0)).toEqual([]);
  });

  it("pays whenever it can afford to with the alwaysPay policy", () => {
    const choices = runs(4, { hitRate: 0.2, pack: RISKY, policy: "alwaysPay" }).flatMap(
      (result) => result.choices,
    );
    const payable = choices.filter((choice) => choice.couldPay);

    expect(payable.length).toBeGreaterThan(0);
    expect(payable.filter((choice) => choice.cost === 0)).toEqual([]);
  });

  it("pays for some payable choices and not others with the mixed policy, the same each seed", () => {
    const mixed = () => runs(4, { hitRate: 0.2, pack: RISKY, policy: "mixed" });
    const results = mixed();
    const payable = results.flatMap((result) => result.choices).filter((choice) => choice.couldPay);

    expect(mixed()).toEqual(results);
    expect(payable.some((choice) => choice.cost > 0)).toBe(true);
    expect(payable.some((choice) => choice.cost === 0)).toBe(true);
  });

  it.each<PolicyId>(["heartsUnlessLow", "alwaysHearts", "alwaysPay", "mixed"])(
    "opens no obstacle cards and no firings from hits at a zero hit rate (%s)",
    (policy) => {
      const results = runs(3, { hitRate: 0, pack: RISKY, policy });
      const choices = results.flatMap((result) => result.choices);
      const firedByChoices = choices.flatMap((choice) => choice.fired);

      expect(choices.filter((choice) => choice.from === "obstacle")).toEqual([]);
      expect(results.flatMap((result) => result.firings.map((firing) => firing.dog))).toEqual(
        firedByChoices,
      );
    },
  );

  it("pays each zone's fee for every dog still walking at its end", () => {
    const casey = modifiersOf(walkerEffects(gameData, "casey"));
    const results = runs(4, { hitRate: 0.25, pack: RISKY, policy: "alwaysHearts" });
    const fired = results.flatMap((result) => result.firings);

    expect(fired.length).toBeGreaterThan(0);
    for (const result of results) {
      for (const zone of result.zones) {
        const gone = result.firings
          .filter((firing) => firing.zoneIndex <= zone.zoneIndex)
          .map((firing) => firing.dog);
        const walking = RISKY.filter((dog) => !gone.includes(dog));

        expect(zone.fees.map((fee) => fee.dog)).toEqual(walking);
        if (!result.upgrades.includes("shortcut")) {
          const { fees } = zoneAt(gameData, result.route, zone.zoneIndex);
          expect(zone.fees.map((fee) => fee.amount)).toEqual(
            walking.map((dog) => cents(zoneFee(gameData.tuning, casey, gameData.dogs[dog]) * fees)),
          );
        }
      }
    }
  });

  it("ends with no dogs when every owner has fired you", () => {
    const ended = runs(3, { hitRate: 0.5, pack: ["archie"], policy: "alwaysHearts" }).filter(
      (result) => !result.finished,
    );

    expect(ended.length).toBeGreaterThan(0);
    for (const result of ended) {
      expect(result.firings.map((firing) => firing.dog)).toEqual(["archie"]);
      expect(result.zonesCompleted).toBeLessThan(gameData.world.zones.length);
    }
  });
});
