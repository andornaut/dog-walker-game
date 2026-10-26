import { describe, expect, it } from "vitest";

import {
  randomInt,
  randomPick,
  randomStream,
  seededRandom,
  streamSeed,
  weightedPick,
} from "./random";

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
});

describe("weightedPick", () => {
  it.each([
    { draw: 0, picked: "a" },
    { draw: 0.2, picked: "b" },
    { draw: 0.79, picked: "b" },
    { draw: 0.8, picked: "c" },
    { draw: 0.9999, picked: "c" },
  ])("picks $picked at a draw of $draw, each item as likely as its weight", ({ draw, picked }) => {
    expect(weightedPick(() => draw, ["a", "b", "c"], [1, 3, 1])).toBe(picked);
  });
});

const NAMES = ["forks", "quips", "scenery", "spawns-1"];

describe("randomStream", () => {
  it("repeats a stream's sequence for the same seed and name", () => {
    for (const name of NAMES) {
      expect(take(20, randomStream(42, name))).toEqual(take(20, randomStream(42, name)));
    }
  });

  it("keeps each stream's sequence when another stream draws more", () => {
    const untouched = randomStream(7, "scenery");
    const disturbed = randomStream(7, "scenery");
    take(13, randomStream(7, "spawns-1"));
    expect(take(20, disturbed)).toEqual(take(20, untouched));
  });

  it("gives each stream a sequence of its own", () => {
    const sequences = NAMES.map((name) => take(10, randomStream(7, name)).join());
    expect(new Set([...sequences, take(10, seededRandom(7)).join()]).size).toBe(NAMES.length + 1);
  });
});

describe("streamSeed", () => {
  it("gives every seed in a run of nearby seeds its own stream seed for each name", () => {
    for (const name of NAMES) {
      const seeds = Array.from({ length: 1000 }, (_, seed) => streamSeed(seed, name));
      expect(new Set(seeds).size).toBe(1000);
    }
  });
});
