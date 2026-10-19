import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, ROAD_LOOK_AHEAD_SECONDS, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import { screenLayout } from "../layout/screenLayout";
import { walkerFootY, walkGeometry, walkProjection } from "./walkGeometry";

const road = { height: 600, width: 280, x: 80, y: 40 };
const flat = { visibleDistance: 594 };

describe("walkGeometry", () => {
  it("stands the walker just above the bottom of the road", () => {
    expect(walkerFootY(road)).toBeLessThan(640);
    expect(walkerFootY(road)).toBeGreaterThan(620);
  });

  it("spans the road from the far edge in view to the bottom", () => {
    const geometry = walkGeometry(5, 2, flat, road);
    expect([geometry.roadTop, geometry.roadBottom]).toEqual([40, 640]);
  });

  it("brings spawns into view at the projected road's far edge, 5.25s ahead of the feet", () => {
    const gameRoad = screenLayout(SCREEN_CONFIG).road;
    const projection = walkProjection(ROAD_CAMERA, gameRoad);
    const geometry = walkGeometry(5, 3, projection, gameRoad);
    const lookAhead = ROAD_LOOK_AHEAD_SECONDS * TUNING.pixels.roadScrollSpeed;
    expect(walkerFootY(gameRoad) - geometry.roadTop).toBeCloseTo(lookAhead, 6);
    expect(geometry.sightLength).toBeGreaterThan(500);
  });

  it("puts the pack's band on the road, no taller than the tallest pack's", () => {
    for (const dogs of [1, 2, 3]) {
      const { packBand, tallestPackBand } = walkGeometry(5, dogs, flat, road);
      expect(packBand.top).toBeGreaterThan(40);
      expect(packBand.bottom).toBeLessThanOrEqual(640);
      expect(packBand.bottom - packBand.top).toBeLessThanOrEqual(tallestPackBand);
    }
  });
});
