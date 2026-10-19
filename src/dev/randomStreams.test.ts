import { describe, expect, it } from "vitest";

import { type Random, seededRandom } from "../runner/random";
import { RANDOM_STREAM_NAMES, randomStream, randomStreams, streamSeed } from "./randomStreams";

const take = (count: number, random: Random) => Array.from({ length: count }, random);

describe("randomStreams", () => {
  it("repeats every stream's sequence for the same seed", () => {
    const first = randomStreams(42);
    const second = randomStreams(42);
    for (const name of RANDOM_STREAM_NAMES) {
      expect(take(20, first[name])).toEqual(take(20, second[name]));
    }
  });

  it("matches randomStream for each name", () => {
    const streams = randomStreams(42);
    for (const name of RANDOM_STREAM_NAMES) {
      expect(take(5, streams[name])).toEqual(take(5, randomStream(42, name)));
    }
  });

  it("keeps each stream's sequence when another stream draws more", () => {
    const untouched = randomStreams(7);
    const disturbed = randomStreams(7);
    take(13, disturbed.spawns);
    take(3, disturbed.cards);
    expect(take(20, disturbed.rolls)).toEqual(take(20, untouched.rolls));
    expect(take(20, disturbed.pulls)).toEqual(take(20, untouched.pulls));
  });

  it("gives each stream a sequence of its own", () => {
    const streams = randomStreams(7);
    const sequences = RANDOM_STREAM_NAMES.map((name) => take(10, streams[name]).join());
    expect(new Set([...sequences, take(10, seededRandom(7)).join()]).size).toBe(
      RANDOM_STREAM_NAMES.length + 1,
    );
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
    for (const name of RANDOM_STREAM_NAMES) {
      const seeds = Array.from({ length: 1000 }, (_, seed) => streamSeed(seed, name));
      expect(new Set(seeds).size).toBe(1000);
    }
  });

  it("gives every name its own stream seed, including names that differ by one character", () => {
    const names = [...RANDOM_STREAM_NAMES, "spawns/zone-1", "spawns/zone-2", "spawnt", ""];
    expect(new Set(names.map((name) => streamSeed(0, name))).size).toBe(names.length);
  });
});
