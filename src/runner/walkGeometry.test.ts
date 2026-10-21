import { describe, expect, it } from "vitest";

import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import { screenLayout } from "../layout/screenLayout";
import { walkerFootY, walkGeometry, walkProjection } from "./walkGeometry";

const road = { height: 600, width: 280, x: 80, y: 40 };
const flat = { visibleDistance: 594 };

describe("walkGeometry", () => {
  it("spans the road from the far edge in view to the bottom, the walker just above it", () => {
    const geometry = walkGeometry(5, 2, flat, road);
    expect([geometry.roadTop, geometry.roadBottom]).toEqual([40, 640]);
    expect(walkerFootY(road)).toBeLessThan(640);
    expect(walkerFootY(road)).toBeGreaterThan(620);
  });

  // A 1-lane hit box is ROAD_HIT_SIZE wide whatever size the art is drawn, and each lane more
  // adds a lane's width.
  const gameRoad = screenLayout(SCREEN_CONFIG).road;
  const { cell } = walkGeometry(LANE_COUNT, 1, flat, gameRoad);
  it.each([1, 2, 3])("hits a %d-lane obstacle at the hit size, not the sprite size", (lanes) => {
    const hit = lanes * cell.length - 2 * cell.inset;
    expect(hit).toBe(ROAD_HIT_SIZE + (lanes - 1) * cell.length);
    expect(hit).toBeLessThan(ROAD_SPRITE_SIZE + (lanes - 1) * cell.length);
  });

  it("brings spawns into view at the projected road's far edge, the look-ahead ahead", () => {
    const projection = walkProjection(ROAD_CAMERA, gameRoad);
    const geometry = walkGeometry(5, 3, projection, gameRoad);
    const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;
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
