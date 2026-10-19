import { type Random, seededRandom } from "../runner/random";

// One seed feeds several named streams, each its own generator, so an extra draw in one
// stream never shifts the sequence of another.
export const RANDOM_STREAM_NAMES = ["cards", "pulls", "rolls", "spawns"] as const;
export type RandomStreamName = (typeof RANDOM_STREAM_NAMES)[number];
export type RandomStreams = Readonly<Record<RandomStreamName, Random>>;

// FNV-1a over the name, starting from the seed mixed into the offset basis, then the murmur3
// finalizer to spread nearby inputs. Every step is a bijection on 32 bits, so for one name,
// different seeds always give different stream seeds.
export function streamSeed(seed: number, name: string): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// Any name works, so a caller can split a stream further, such as one per zone.
export function randomStream(seed: number, name: string): Random {
  return seededRandom(streamSeed(seed, name));
}

export function randomStreams(seed: number): RandomStreams {
  return {
    cards: randomStream(seed, "cards"),
    pulls: randomStream(seed, "pulls"),
    rolls: randomStream(seed, "rolls"),
    spawns: randomStream(seed, "spawns"),
  };
}
