// A source of floats in [0, 1). Everything random takes one, so a seed reproduces a run.
export type Random = () => number;

// mulberry32: a 32-bit generator whose sequence is fixed by its seed.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An integer in [min, max).
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min));
}

export function randomPick<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("randomPick needs at least one item");
  }
  return items[randomInt(random, 0, items.length)];
}

// True with the given probability: never at 0, always at 1.
export function chance(random: Random, probability: number): boolean {
  return random() < probability;
}
