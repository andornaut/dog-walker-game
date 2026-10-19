import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { zoneFee } from "../rules/dogs";
import { seededRandom } from "../runner/random";
import type { PackDogs } from "../state/runState";
import type { PolicyId } from "./policies";
import { DEFAULT_RATES, type RunResult, type SimConfig, simulateRun } from "./simulate";

const STARTERS: PackDogs = ["duchess", "biscuit", "koda"];
const RISKY: PackDogs = ["zippy", "dash", "snowball"];

function config(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    gear: null,
    hitRate: 0.1,
    pack: STARTERS,
    policy: "heartsUnlessLow",
    ...DEFAULT_RATES,
    ...overrides,
  };
}

function runs(count: number, overrides: Partial<SimConfig> = {}): RunResult[] {
  return Array.from({ length: count }, (_, seed) =>
    simulateRun(gameData, seededRandom(seed + 1), config(overrides)),
  );
}

describe("simulateRun", () => {
  it("gives the same result for the same seed", () => {
    const first = simulateRun(gameData, seededRandom(7), config({ pack: RISKY }));
    const second = simulateRun(gameData, seededRandom(7), config({ pack: RISKY }));
    const other = simulateRun(gameData, seededRandom(8), config({ pack: RISKY }));

    expect(second).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("plays every zone of a run that keeps its dogs", () => {
    const [result] = runs(1, { hitRate: 0, policy: "alwaysPay" });

    expect(result?.finished).toBe(true);
    expect(result?.zonesCompleted).toBe(gameData.world.zones.length);
    expect(result?.choices.filter((choice) => choice.from === "forcedStop")).toHaveLength(
      gameData.world.zones.length,
    );
  });

  it("never pays money with the alwaysHearts policy", () => {
    const choices = runs(40, { hitRate: 0.2, pack: RISKY, policy: "alwaysHearts" }).flatMap(
      (result) => result.choices,
    );

    expect(choices.length).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0)).toEqual([]);
  });

  it("pays whenever it can afford to with the alwaysPay policy", () => {
    const choices = runs(40, { hitRate: 0.2, pack: RISKY, policy: "alwaysPay" }).flatMap(
      (result) => result.choices,
    );
    const payable = choices.filter((choice) => choice.couldPay);

    expect(payable.length).toBeGreaterThan(0);
    expect(payable.filter((choice) => choice.cost === 0)).toEqual([]);
  });

  it.each<PolicyId>(["heartsUnlessLow", "alwaysHearts", "alwaysPay"])(
    "opens no obstacle cards and no firings from hits at a 0%% hit rate (%s)",
    (policy) => {
      const results = runs(30, { hitRate: 0, pack: RISKY, policy });
      const choices = results.flatMap((result) => result.choices);
      const firedByChoices = choices.flatMap((choice) => choice.fired);

      expect(choices.filter((choice) => choice.from === "obstacle")).toEqual([]);
      expect(results.flatMap((result) => result.firings.map((firing) => firing.dog))).toEqual(
        firedByChoices,
      );
    },
  );

  it("pays each zone's fee for every dog still walking at its end", () => {
    const results = runs(40, { hitRate: 0.25, pack: RISKY, policy: "alwaysHearts" });
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
          expect(zone.fees.map((fee) => fee.amount)).toEqual(
            walking.map((dog) => zoneFee(gameData.tuning, [], gameData.dogs[dog])),
          );
        }
      }
    }
  });

  // alwaysHearts never spends money, so the money always covers a fired owner's fees.
  it("takes back the fees a fired owner's dog earned", () => {
    const results = runs(60, { hitRate: 0.25, pack: RISKY, policy: "alwaysHearts" });
    const feesBefore = (result: RunResult, dog: DogId, zoneIndex: number) =>
      result.zones
        .filter((zone) => zone.zoneIndex < zoneIndex)
        .flatMap((zone) => zone.fees)
        .filter((fee) => fee.dog === dog)
        .reduce((sum, fee) => sum + fee.amount, 0);
    const firings = results.flatMap((result) =>
      result.firings.map((firing) => ({
        ...firing,
        paid: feesBefore(result, firing.dog, firing.zoneIndex),
      })),
    );

    expect(firings.filter((firing) => firing.paid > 0).length).toBeGreaterThan(0);
    for (const firing of firings) {
      expect(firing.feesEarned).toBe(firing.paid);
      expect(firing.clawback).toBe(firing.paid);
    }
  });

  it("ends with no dogs when every owner has fired you", () => {
    const ended = runs(40, { hitRate: 0.5, pack: ["dash"], policy: "alwaysHearts" }).filter(
      (result) => !result.finished,
    );

    expect(ended.length).toBeGreaterThan(0);
    for (const result of ended) {
      expect(result.firings.map((firing) => firing.dog)).toEqual(["dash"]);
      expect(result.zonesCompleted).toBeLessThan(gameData.world.zones.length);
    }
  });
});
