import { describe, expect, it } from "vitest";

import type { CardSource } from "../state/runState";
import { type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";

const LENGTHS = { encounter: 1, minor: 0.6 };
const CARD: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };

describe("hitStopLength", () => {
  it("is the encounter's length for an encounter, the minor one's for a bump, else 0", () => {
    expect(hitStopLength(LENGTHS, { encounters: 1, minors: 0 })).toBe(1);
    expect(hitStopLength(LENGTHS, { encounters: 0, minors: 2 })).toBe(0.6);
    expect(hitStopLength(LENGTHS, { encounters: 1, minors: 1 })).toBe(1);
    expect(hitStopLength(LENGTHS, { encounters: 0, minors: 0 })).toBe(0);
  });
});

describe("startHitStop", () => {
  it("starts no stop for no length", () => {
    expect(startHitStop(0, { cards: [CARD], zoneEnded: false })).toBeNull();
  });

  it("holds the step's cards and zone end", () => {
    expect(startHitStop(1, { cards: [CARD], zoneEnded: true })).toEqual({
      cards: [CARD],
      seconds: 1,
      zoneEnded: true,
    });
  });
});

describe("tickHitStop", () => {
  // Ticks a stop at 60 steps a second, counting the steps until it lets go.
  const stepsHeld = (seconds: number) => {
    let stop: HitStop | null = startHitStop(seconds, { cards: [CARD], zoneEnded: false });
    let steps = 0;
    while (stop !== null) {
      const ticked = tickHitStop(1 / 60, stop);
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
    const stop: HitStop = { cards: [CARD], seconds: 0.5, zoneEnded: true };
    expect(tickHitStop(0.2, stop)).toEqual({ stop: { ...stop, seconds: 0.3 } });
    expect(tickHitStop(0.5, stop)).toEqual({ released: { cards: [CARD], zoneEnded: true } });
  });
});
