import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { CROSS_STREET } from "./crossStreet";
import { screenLayout } from "./screenLayout";

describe("screenLayout", () => {
  it("splits the game's road into 64px lanes", () => {
    const { road } = screenLayout(SCREEN_CONFIG);
    expect(road.width / LANE_COUNT).toBe(64);
  });

  it("stacks the screen's parts down its height, every part touching the next", () => {
    const { backdrop, dogRow, roadView, topBar, zoneProgress } = screenLayout(SCREEN_CONFIG);
    expect(backdrop.y).toBe(topBar.y + topBar.height);
    expect(roadView.y).toBe(backdrop.y + backdrop.height);
    expect(dogRow.y).toBe(roadView.y + roadView.height);
    expect(zoneProgress.y).toBe(dogRow.y + dogRow.height);
    expect(zoneProgress.y + zoneProgress.height).toBe(SCREEN_CONFIG.height);
  });

  // The road draws from the row under the backdrops' cross street, so it meets the street.
  it("draws the road from the cross street down: the junction, the approach, then the road", () => {
    const { approach, backdrop, junction, rasterView, roadView } = screenLayout(SCREEN_CONFIG);
    expect(junction.y).toBe(backdrop.y + CROSS_STREET.nearLane + 1);
    expect(approach.y).toBe(junction.y + junction.height);
    expect(roadView.y).toBe(approach.y + approach.height);
    expect(rasterView.y).toBe(junction.y);
    expect(rasterView.y + rasterView.height).toBe(roadView.y + roadView.height);
  });
});
