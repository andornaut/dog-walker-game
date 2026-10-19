import { describe, expect, it } from "vitest";

import { type Random, seededRandom } from "../runner/random";
import { randomStream, streamSeed } from "./randomStreams";

const take = (count: number, random: Random) => Array.from({ length: count }, random);
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
