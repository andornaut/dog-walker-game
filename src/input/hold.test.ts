import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { read } from "../rules/units";
import {
  type HoldRule,
  holdRule,
  moveHold,
  releaseHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "./hold";

const at = { x: 100, y: 200 };
const STARTED_MS = 1_000;
const HOLD_MS = read(gameData.tuning, "seconds", "holdSeconds") * 1000;
const TILE = holdRule(gameData.tuning, TILE_SLOP_PX);
const ANYWHERE = holdRule(gameData.tuning, Number.POSITIVE_INFINITY);

describe("a press on a holdable item", () => {
  // moved: how far right the press moves first. tick: a frame's time from the hold time, or
  // undefined for no frame before the release. release: the release's time from the hold time.
  it.each([
    ["taps when released before the hold time", TILE, 0, -1, false, -1, "tap"],
    ["fires at the hold time; its release does nothing", TILE, 0, 0, true, 500, "none"],
    ["holds if released at the hold time before a frame", TILE, 0, undefined, false, 0, "hold"],
    ["stays a hold when it moves within the slop", TILE, TILE_SLOP_PX, 0, true, 500, "none"],
    ["only taps once it moves past the slop", TILE, TILE_SLOP_PX + 1, 0, false, 400, "tap"],
    ["holds however far it moves under an infinite slop", ANYWHERE, 500, 0, true, 500, "none"],
  ] satisfies readonly [string, HoldRule, number, number | undefined, boolean, number, string][])(
    "%s",
    (_, rule, moved, tick, fires, releaseMs, release) => {
      let press = moveHold({ x: at.x + moved, y: at.y }, startHold(rule, at, STARTED_MS));
      if (tick !== undefined) {
        const ticked = tickHold(STARTED_MS + HOLD_MS + tick, press);
        expect(ticked.fire).toBe(fires);
        press = ticked.press;
      }
      expect(releaseHold(STARTED_MS + HOLD_MS + releaseMs, press)).toBe(release);
    },
  );

  it("fires the hold only once", () => {
    const fired = tickHold(STARTED_MS + HOLD_MS, startHold(TILE, at, STARTED_MS)).press;
    expect(tickHold(STARTED_MS + HOLD_MS + 500, fired).fire).toBe(false);
  });
});
