import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import { walkerFootY } from "../runner/walkGeometry";
import { PACK_DEPTH } from "./packFormation";
import {
  columnSpan,
  distanceAtY,
  lineColumn,
  project,
  roadCameraFor,
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
  it("draws the walker's feet at scale 1 on their row, centred on the screen", () => {
    expect(projection.footY).toBe(walkerFootY(road));
    expect(projection.centerX).toBe(180);
    expect(scaleAt(projection, 0)).toBe(1);
    expect(screenYAt(projection, 0)).toBe(projection.footY);
  });

  it("joins the backdrop's bottom row with the road at the far scale, centred", () => {
    expect(bandRow).toBe(road.y - 1);
    const span = columnSpan(projection, bandRow, road.x, road.x + road.width);
    const drawn = (span?.last ?? 0) - (span?.first ?? 0) + 1;
    expect(Math.abs(drawn - ROAD_FAR_SCALE * road.width)).toBeLessThanOrEqual(2);
    expect((span?.first ?? 0) + (span?.last ?? 0) + 1).toBe(SCREEN_CONFIG.width);
  });

  it("converges on the backdrop's vanishing point column", () => {
    expect(lineColumn(projection, bandRow, 180)).toBe(180);
    expect(project(projection, { distance: 1e9, x: 40 }).x).toBeCloseTo(180);
  });

  // The camera derives from the band's bottom edge (farY), the feet (footY), the far scale and
  // the tuned look-ahead: horizonY puts the far scale on farY, and focal shows the look-ahead.
  const footY = walkerFootY(road);
  const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;
  it.each([
    ["the far edge in view on the band's bottom edge", screenYAt(projection, lookAhead), road.y],
    ["the far edge at the far scale", scaleAt(projection, lookAhead), ROAD_FAR_SCALE],
    ["the feet at scale 1", scaleAt(projection, 0), 1],
    ["the look-ahead in view", projection.visibleDistance, lookAhead],
    [
      "the horizon row",
      ROAD_CAMERA.horizonY,
      (road.y - ROAD_FAR_SCALE * footY) / (1 - ROAD_FAR_SCALE),
    ],
    ["the focal length", projection.focal, (lookAhead * ROAD_FAR_SCALE) / (1 - ROAD_FAR_SCALE)],
  ])("derives %s from the screen layout and tuning", (_name, actual, expected) => {
    expect(actual).toBeCloseTo(expected, 6);
  });

  it.each([120, 150, 200])("keeps the join's columns at a base speed of %d", (speed) => {
    const camera = roadCameraFor({
      farScale: ROAD_FAR_SCALE,
      farY: road.y,
      footY,
      visibleDistance: TUNING.seconds.lookAheadSeconds * speed,
    });
    const other = roadProjection(camera, footY, road);
    expect(other.visibleDistance / speed).toBeCloseTo(TUNING.seconds.lookAheadSeconds, 6);
    expect(columnSpan(other, bandRow, road.x, road.x + road.width)).toEqual(
      columnSpan(projection, bandRow, road.x, road.x + road.width),
    );
  });

  it("keeps a lane step 56px wide at the pack", () => {
    const left = project(projection, { distance: 0, x: 124 });
    const right = project(projection, { distance: 0, x: 180 });
    expect(right.x - left.x).toBe(56);
  });
});

describe("inverses", () => {
  it.each([-6, 0, 100, 400, 700])("distanceAtY undoes screenYAt at %d", (distance) => {
    expect(distanceAtY(projection, screenYAt(projection, distance))).toBeCloseTo(distance);
  });

  it("roadXAt undoes project's x", () => {
    const placed = project(projection, { distance: 300, x: 108 });
    expect(roadXAt(projection, placed.scale, placed.x)).toBeCloseTo(108);
  });
});

describe("snapScale", () => {
  // The nearest depth step by ratio, each pair either side of a boundary.
  it.each([
    [1.01, 1],
    [0.94, 1],
    [0.93, 0.875],
    [0.82, 0.875],
    [0.8, 0.75],
    [0.69, 0.75],
    [0.68, 0.625],
    [0.56, 0.625],
    [0.55, 0.5],
    [0.3, 0.5],
  ])("snaps %d to %d", (scale, step) => {
    expect(snapScale(scale)).toBe(step);
  });

  it("draws the pack at 1 and the far edge at 0.5", () => {
    expect(snapScale(PACK_DEPTH)).toBe(1);
    expect(snapScale(scaleAt(projection, projection.visibleDistance))).toBe(0.5);
  });

  it("snaps a road sprite just ahead of the pack to 0.875, unlike the pack", () => {
    // The far edge is at scale 0.5 (visibleDistance), so scale s is (1 / s - 1) of it ahead.
    const justAhead = projection.visibleDistance * (1 / 0.9 - 1);
    expect(snapScale(scaleAt(projection, justAhead))).toBe(0.875);
  });
});
