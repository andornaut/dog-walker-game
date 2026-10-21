import { describe, expect, it } from "vitest";

import { chance, randomInt, randomPick, randomStream, seededRandom, streamSeed } from "./random";

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

  it("gives a different sequence for a different seed", () => {
    expect(take(10, randomStream(1, "spawns"))).not.toEqual(take(10, randomStream(2, "spawns")));
  });
});

describe("streamSeed", () => {
  it("is a fixed unsigned 32-bit integer for a seed and name", () => {
    const seed = streamSeed(123, "rolls");
    expect(seed).toBe(streamSeed(123, "rolls"));
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true);
  });

  it("gives every seed in a run of nearby seeds its own stream seed for each name", () => {
    for (const name of NAMES) {
      const seeds = Array.from({ length: 1000 }, (_, seed) => streamSeed(seed, name));
      expect(new Set(seeds).size).toBe(1000);
    }
  });

  it("gives every name its own stream seed, including names that differ by one character", () => {
    const names = [...NAMES, "spawns-2", "spawns", "spawnt", ""];
    expect(new Set(names.map((name) => streamSeed(0, name))).size).toBe(names.length);
  });
});
