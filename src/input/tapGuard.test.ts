import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { read } from "../rules/units";
import { guardPassed, tapGuardMs } from "./tapGuard";

const GUARD_MS = read(gameData.tuning, "seconds", "screenTapGuard") * 1000;
const DRAWN_MS = 5_000;

describe("tapGuardMs", () => {
  it("reads seconds.screenTapGuard, in milliseconds", () => {
    const seconds = { ...gameData.tuning.seconds, screenTapGuard: 2.5 };
    expect(tapGuardMs({ ...gameData.tuning, seconds })).toBe(2_500);
  });
});

describe("a tap on a screen that breaks into the walk", () => {
  // drawnMs: the screen's first drawn frame, or null before it. nowMs: the tap's time.
  it.each([
    ["is ignored before the screen is first drawn", null, DRAWN_MS + GUARD_MS, false],
    ["is ignored on the first drawn frame", DRAWN_MS, DRAWN_MS, false],
    ["is ignored just inside the guard", DRAWN_MS, DRAWN_MS + GUARD_MS - 1, false],
    ["acts once the guard has passed", DRAWN_MS, DRAWN_MS + GUARD_MS, true],
    ["acts after the guard", DRAWN_MS, DRAWN_MS + GUARD_MS + 1_000, true],
  ] satisfies readonly [string, number | null, number, boolean][])(
    "%s",
    (_, drawnMs, nowMs, acts) => {
      expect(guardPassed(tapGuardMs(gameData.tuning), drawnMs, nowMs)).toBe(acts);
    },
  );
});
