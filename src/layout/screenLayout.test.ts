import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "./screenLayout";

describe("screenLayout", () => {
  it("splits the game's road into 64px lanes", () => {
    const { road } = screenLayout(SCREEN_CONFIG);
    expect(road.width / LANE_COUNT).toBe(64);
  });

  it("stacks the screen's parts down its height, every part touching the next", () => {
    const { backdrop, dogRow, roadView, topBar } = screenLayout(SCREEN_CONFIG);
    expect(backdrop.y).toBe(topBar.y + topBar.height);
    expect(roadView.y).toBe(backdrop.y + backdrop.height);
    expect(dogRow.y).toBe(roadView.y + roadView.height);
    expect(dogRow.y + dogRow.height).toBe(SCREEN_CONFIG.height);
  });
});
