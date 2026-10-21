import { describe, expect, it } from "vitest";

import { type HoldRule, moveHold, releaseHold, startHold, tickHold } from "./hold";

const at = { x: 100, y: 200 };
const STARTED_MS = 1_000;
const TILE: HoldRule = { holdMs: 400, slopPx: 10 };
const ANYWHERE: HoldRule = { holdMs: 400, slopPx: Number.POSITIVE_INFINITY };

describe("a press on a holdable item", () => {
  // moved: how far right the press moves first. tick: a frame's time after the press, or
  // undefined for no frame before the release.
  it("holds by its rules", () => {
    for (const [, rule, moved, tick, fires, releaseMs, release] of [
      ["taps when released before the hold time", TILE, 0, 399, false, 399, "tap"],
      ["fires at the hold time; its release does nothing", TILE, 0, 400, true, 900, "none"],
      ["holds if released at the hold time before a frame", TILE, 0, undefined, false, 400, "hold"],
      ["stays a hold when it moves within the slop", TILE, 10, 400, true, 900, "none"],
      ["only taps once it moves past the slop", TILE, 11, 400, false, 800, "tap"],
      ["holds however far it moves under an infinite slop", ANYWHERE, 500, 400, true, 900, "none"],
    ] satisfies readonly [
      string,
      HoldRule,
      number,
      number | undefined,
      boolean,
      number,
      string,
    ][]) {
      let press = moveHold(startHold(rule, at, STARTED_MS), { x: at.x + moved, y: at.y });
      if (tick !== undefined) {
        const ticked = tickHold(press, STARTED_MS + tick);
        expect(ticked.fire).toBe(fires);
        press = ticked.press;
      }
      expect(releaseHold(press, STARTED_MS + releaseMs)).toBe(release);
    }
  });

  it("fires the hold only once", () => {
    const fired = tickHold(startHold(TILE, at, STARTED_MS), STARTED_MS + 400).press;
    expect(tickHold(fired, STARTED_MS + 900).fire).toBe(false);
  });
});
