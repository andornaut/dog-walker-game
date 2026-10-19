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
  roadCameraFor,
  roadProjection,
  roadXAt,
  rowScale,
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
  it("draws the walker's feet at scale 1 on row 464, centred on the screen", () => {
    expect(projection.footY).toBe(464);
    expect(projection.centerX).toBe(180);
    expect(scaleAt(projection, 0)).toBe(1);
    expect(screenYAt(projection, 0)).toBe(464);
  });

  it("joins the backdrop's bottom row, band row 109, pixel for pixel", () => {
    expect(bandRow).toBe(149);
    expect(columnSpan(projection, bandRow, 40, 320)).toEqual({ first: 110, last: 249 });
    expect(columnSpan(projection, bandRow, 36, 40)).toEqual({ first: 108, last: 109 });
    expect(columnSpan(projection, bandRow, 320, 324)).toEqual({ first: 250, last: 251 });
    expect([96, 152, 208, 264].map((x) => lineColumn(projection, bandRow, x))).toEqual([
      138, 166, 193, 221,
    ]);
  });

  it("reaches about 360 road pixels either side of the centre line at the band's edges", () => {
    expect(roadXAt(projection, rowScale(projection, bandRow), 0.5)).toBeCloseTo(-179.6, 1);
    expect(roadXAt(projection, rowScale(projection, bandRow), 359.5)).toBeCloseTo(539.6, 1);
  });

  it("converges on the backdrop's vanishing point column", () => {
    expect(lineColumn(projection, bandRow, 180)).toBe(180);
    expect(project(projection, { distance: 1e9, x: 40 }).x).toBeCloseTo(180);
  });

  it("shows the tuned look-ahead of road at the tuned base speed", () => {
    const speed = TUNING.pixels.roadScrollSpeed;
    const seconds = TUNING.seconds.lookAheadSeconds;
    expect(projection.visibleDistance / speed).toBeCloseTo(seconds, 6);
    expect(farEdgeAt(projection, 1000)).toBeCloseTo(1000 + seconds * speed, 6);
  });

  it("keeps the vanishing row at -164 and the join's columns whatever the speed", () => {
    expect(ROAD_CAMERA.horizonY).toBeCloseTo(-164, 9);
    const footY = walkerFootY(road);
    for (const speed of [120, 150]) {
      const camera = roadCameraFor({
        farScale: 0.5,
        farY: road.y,
        footY,
        visibleDistance: 5.25 * speed,
      });
      const other = roadProjection(camera, footY, road);
      expect(other.visibleDistance).toBeCloseTo(5.25 * speed, 6);
      expect(columnSpan(other, bandRow, 40, 320)).toEqual({ first: 110, last: 249 });
    }
  });

  it("puts the far edge of the road in view at scale 0.5", () => {
    expect(scaleAt(projection, projection.visibleDistance)).toBeCloseTo(0.5);
  });

  it("puts the far edge of the road in view on the band's bottom edge", () => {
    expect(screenYAt(projection, projection.visibleDistance)).toBeCloseTo(road.y);
  });

  it("keeps a lane step 56px wide at the pack", () => {
    const left = project(projection, { distance: 0, x: 124 });
    const right = project(projection, { distance: 0, x: 180 });
    expect(right.x - left.x).toBe(56);
  });
});

describe("inverses", () => {
  it("distanceAtY undoes screenYAt", () => {
    for (const distance of [-6, 0, 100, 400, 700]) {
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
