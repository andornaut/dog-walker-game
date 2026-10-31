import { describe, expect, it } from "vitest";

import { animationPhaseAt } from "./animationPhase";

describe("animation phase", () => {
  it("replays variable frame durations in any query order and wraps negative phases", () => {
    const durations = [100, 200, 50];
    expect(
      [350, 99, 300, -1, 100, 0, 300].map((time) => animationPhaseAt(durations, time)),
    ).toEqual([0, 0, 2, 2, 1, 0, 2]);
  });

  it("holds a readable first frame for an empty or zero-duration animation", () => {
    expect(animationPhaseAt([], 100)).toBe(0);
    expect(animationPhaseAt([0, 0], 100)).toBe(0);
  });
});
