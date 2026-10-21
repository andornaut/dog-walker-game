import { describe, expect, it } from "vitest";

import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { CELEBRATION_LAYOUT as LAYOUT } from "./celebrationLayout";

const WALKER = {
  height: ROAD_SPRITE_SIZE * 1.5 * LAYOUT.walkerScale,
  width: ROAD_SPRITE_SIZE * LAYOUT.walkerScale,
};

describe("CELEBRATION_LAYOUT", () => {
  it.each([
    ["new walker", LAYOUT.newWalker],
    ["zone done", LAYOUT.zoneDone],
  ])("stands the %s walker centred on its feet line, under both lines", (_name, version) => {
    expect(version.walker.x + WALKER.width / 2).toBe(LAYOUT.centerX);
    expect(version.walker.y + WALKER.height).toBe(version.feetY);
    expect(version.titleY).toBeLessThan(version.subtitleY);
    expect(version.subtitleY).toBeLessThan(version.walker.y);
    expect(version.burst.y).toBeGreaterThan(version.walker.y);
    expect(version.burst.x).toBeLessThan(version.walker.x);
  });
});
