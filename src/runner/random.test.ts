import { describe, expect, it } from "vitest";

import { chance, randomInt, randomPick, seededRandom } from "./random";

const take = (count: number, random: () => number) => Array.from({ length: count }, random);

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed and varies with the seed", () => {
    expect(take(10, seededRandom(42))).toEqual(take(10, seededRandom(42)));
    expect(take(10, seededRandom(1))).not.toEqual(take(10, seededRandom(2)));
  });

  it("stays in [0, 1) and spreads across the range", () => {
    const values = take(2000, seededRandom(7));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(values.filter((value) => value < 0.5).length).toBeGreaterThan(900);
    expect(values.filter((value) => value >= 0.5).length).toBeGreaterThan(900);
  });
});

describe("randomInt", () => {
  it("maps the ends of [0, 1) to min and max - 1", () => {
    expect(randomInt(() => 0, 2, 6)).toBe(2);
    expect(randomInt(() => 0.9999, 2, 6)).toBe(5);
  });
});

describe("randomPick", () => {
  it("picks each item by where the random value falls", () => {
    expect(randomPick(() => 0, ["a", "b", "c"])).toBe("a");
    expect(randomPick(() => 0.5, ["a", "b", "c"])).toBe("b");
    expect(randomPick(() => 0.99, ["a", "b", "c"])).toBe("c");
  });

  it("throws on an empty list", () => {
    expect(() => randomPick(() => 0, [])).toThrow("at least one item");
  });
});

describe("chance", () => {
  it("passes when the random value is below the probability", () => {
    expect(chance(() => 0.29, 0.3)).toBe(true);
    expect(chance(() => 0.3, 0.3)).toBe(false);
  });
});
