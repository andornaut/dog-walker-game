import { describe, expect, it } from "vitest";

import type { CardSource } from "../data/types";
import { STEP_SECONDS } from "./fixedStep";
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

describe("tickHitStop", () => {
  // Ticks a stop a fixed step at a time, counting the steps until it lets go.
  const stepsHeld = (seconds: number) => {
    let stop: HitStop | null = startHitStop(false, seconds, { cards: [CARD], zoneEnded: false });
    let steps = 0;
    while (stop !== null) {
      const ticked = tickHitStop(STEP_SECONDS, stop);
      steps += 1;
      if ("released" in ticked) {
        expect(ticked.released).toEqual({ cards: [CARD], zoneEnded: false });
        stop = null;
      } else {
        stop = ticked.stop;
      }
    }
    return steps;
  };

  it("lets go after exactly the stop's length of steps, despite rounding", () => {
    expect(stepsHeld(1)).toBe(60);
    expect(stepsHeld(0.6)).toBe(36);
  });

  it("keeps what it holds until it lets go", () => {
    const stop: HitStop = { cards: [CARD], firing: false, seconds: 0.5, zoneEnded: true };
    expect(tickHitStop(0.2, stop)).toEqual({ stop: { ...stop, seconds: 0.3 } });
    expect(tickHitStop(0.5, stop)).toEqual({ released: { cards: [CARD], zoneEnded: true } });
  });
});
