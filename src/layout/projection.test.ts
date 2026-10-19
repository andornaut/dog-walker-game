import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import { walkerFootY } from "../runner/walkGeometry";
import {
  columnSpan,
  distanceAtY,
  farEdgeAt,
  lineColumn,
  project,
  roadProjection,
  roadXAt,
  scaleAt,
  screenYAt,
  snapScale,
} from "./projection";
import { screenLayout } from "./screenLayout";

const { backdrop, road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
// The backdrop's bottom row, which the art draws as the road's continuation.
const bandRow = backdrop.y + backdrop.height - 1;

describe("roadProjection", () => {
  it("draws the walker's feet at scale 1 on row 634, centred on the road", () => {
    expect(projection.footY).toBe(634);
    expect(projection.centerX).toBe(220);
    expect(scaleAt(projection, 0)).toBe(1);
    expect(screenYAt(projection, 0)).toBe(634);
  });

  it("joins the backdrop's bottom row, band row 149, pixel for pixel", () => {
    expect(bandRow).toBe(189);
    expect(columnSpan(projection, bandRow, 80, 360)).toEqual({ first: 150, last: 289 });
    expect(columnSpan(projection, bandRow, 76, 80)).toEqual({ first: 148, last: 149 });
    expect(columnSpan(projection, bandRow, 360, 364)).toEqual({ first: 290, last: 291 });
    expect(columnSpan(projection, bandRow, 32, 76)).toEqual({ first: 125, last: 147 });
    expect(columnSpan(projection, bandRow, 364, 408)).toEqual({ first: 292, last: 314 });
    expect([136, 192, 248, 304].map((x) => lineColumn(projection, bandRow, x))).toEqual([
      177, 205, 234, 262,
    ]);
  });

  it("converges on the backdrop's vanishing point column", () => {
    expect(lineColumn(projection, bandRow, 220)).toBe(220);
    expect(project(projection, { distance: 1e9, x: 80 }).x).toBeCloseTo(220);
  });

  it("shows about 5.25 seconds of road ahead at base speed", () => {
    expect(projection.visibleDistance).toBeCloseTo(630.06, 2);
    const seconds = projection.visibleDistance / TUNING.pixels.roadScrollSpeed;
    expect(seconds).toBeGreaterThan(5.2);
    expect(seconds).toBeLessThan(5.3);
    expect(farEdgeAt(projection, 1000)).toBeCloseTo(1630.06, 2);
  });

  it("puts the far edge of the road in view on the band's bottom edge", () => {
    expect(screenYAt(projection, projection.visibleDistance)).toBeCloseTo(road.y);
  });

  it("keeps a lane step 56px wide at the pack", () => {
    const left = project(projection, { distance: 0, x: 164 });
    const right = project(projection, { distance: 0, x: 220 });
    expect(right.x - left.x).toBe(56);
  });
});

describe("inverses", () => {
  it("distanceAtY undoes screenYAt", () => {
    for (const distance of [-6, 0, 100, 400, 630]) {
      expect(distanceAtY(projection, screenYAt(projection, distance))).toBeCloseTo(distance);
    }
  });

  it("roadXAt undoes project's x", () => {
    const placed = project(projection, { distance: 300, x: 108 });
    expect(roadXAt(projection, placed.scale, placed.x)).toBeCloseTo(108);
  });
});

describe("snapScale", () => {
  it("snaps to the nearest of 1, 0.75 and 0.5 by ratio", () => {
    expect(snapScale(1.01)).toBe(1);
    expect(snapScale(0.87)).toBe(1);
    expect(snapScale(0.86)).toBe(0.75);
    expect(snapScale(0.62)).toBe(0.75);
    expect(snapScale(0.6)).toBe(0.5);
    expect(snapScale(0.3)).toBe(0.5);
  });

  it("draws the pack at 1 and the far edge at 0.5", () => {
    expect(snapScale(scaleAt(projection, 58))).toBe(1);
    expect(snapScale(scaleAt(projection, projection.visibleDistance))).toBe(0.5);
  });
});
