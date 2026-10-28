import { describe, expect, it } from "vitest";

import type { CardSource } from "../data/types";
import { type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";

const LENGTHS = { encounter: 1, minor: 0.6 };
const CARD: CardSource = { affected: ["kilo"], encounter: "skunk", kind: "encounter" };

describe("hitStopLength", () => {
  // The encounter's length for an encounter, the minor one's for a bump, else 0.
  it.each([
    { encounters: 1, length: LENGTHS.encounter, minors: 0 },
    { encounters: 0, length: LENGTHS.minor, minors: 2 },
    { encounters: 1, length: LENGTHS.encounter, minors: 1 },
    { encounters: 0, length: 0, minors: 0 },
  ])(
    "is $length for $encounters encounters and $minors bumps",
    ({ encounters, length, minors }) => {
      expect(hitStopLength(LENGTHS, { encounters, minors })).toBe(length);
    },
  );
});

describe("startHitStop", () => {
  it("holds the step's cards and zone end, marked firing or not, and starts no stop for no length", () => {
    for (const firing of [false, true]) {
      expect(startHitStop(firing, 0, { cards: [CARD], zoneEnded: false })).toBeNull();
      expect(startHitStop(firing, 1, { cards: [CARD], zoneEnded: true })).toEqual({
        cards: [CARD],
        firing,
        seconds: 1,
        zoneEnded: true,
      });
    }
  });
});

// The walk's hit stop tests count the steps a stop holds; this checks what it holds.
describe("tickHitStop", () => {
  it("keeps what it holds until it lets go", () => {
    const stop: HitStop = { cards: [CARD], firing: false, seconds: 0.5, zoneEnded: true };
    expect(tickHitStop(0.2, stop)).toEqual({ stop: { ...stop, seconds: 0.3 } });
    expect(tickHitStop(0.5, stop)).toEqual({ released: { cards: [CARD], zoneEnded: true } });
  });
});
