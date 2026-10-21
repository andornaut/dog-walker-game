import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
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
} from "./projection";
import { screenLayout, walkerFootY } from "./screenLayout";

const { backdrop, road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
// The backdrop's bottom row, which the art draws as the road's continuation.
const bandRow = backdrop.y + backdrop.height - 1;
const screenCentre = SCREEN_CONFIG.width / 2;

describe("roadProjection", () => {
  it("draws the walker's feet at scale 1 on their row, centred on the screen", () => {
    expect(projection.footY).toBe(walkerFootY(road));
    expect(projection.centerX).toBe(screenCentre);
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
    expect(lineColumn(projection, bandRow, screenCentre)).toBe(screenCentre);
    expect(project(projection, { distance: 1e9, x: 40 }).x).toBeCloseTo(screenCentre);
  });

  // The camera derives from the band's bottom edge (farY), the feet (footY), the far scale and
  // the tuned look-ahead: horizonY puts the far scale on farY, and focal shows the look-ahead.
  const footY = walkerFootY(road);
  const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;
  it("derives the far edge, horizon and focal length from the screen layout and tuning", () => {
    for (const [, actual, expected] of [
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
    ] as const) {
      expect(actual).toBeCloseTo(expected, 6);
    }
  });

  it("keeps the join's columns at any base speed", () => {
    for (const speed of [120, 150, 200]) {
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
    }
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
