import { describe, expect, it } from "vitest";

import { walkerFootY, walkGeometry } from "./walkGeometry";

const road = { height: 600, width: 280, x: 80, y: 40 };

describe("walkGeometry", () => {
  it("stands the walker just above the bottom of the road", () => {
    expect(walkerFootY(road)).toBeLessThan(640);
    expect(walkerFootY(road)).toBeGreaterThan(620);
  });

  it("spans the road's top and bottom", () => {
    const geometry = walkGeometry(5, 2, road);
    expect([geometry.roadTop, geometry.roadBottom]).toEqual([40, 640]);
  });

  it("puts the pack's band on the road, no taller than the tallest pack's", () => {
    for (const dogs of [1, 2, 3]) {
      const { packBand, tallestPackBand } = walkGeometry(5, dogs, road);
      expect(packBand.top).toBeGreaterThan(40);
      expect(packBand.bottom).toBeLessThanOrEqual(640);
      expect(packBand.bottom - packBand.top).toBeLessThanOrEqual(tallestPackBand);
    }
  });
});
