import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "./screenLayout";

describe("screenLayout", () => {
  it("splits the game's road into 64px lanes", () => {
    const { road } = screenLayout(SCREEN_CONFIG);
    expect(road.width / LANE_COUNT).toBe(64);
  });

  it("fits the game's screen in 360x560, every part touching the next", () => {
    const { backdrop, dogRow, roadView, topBar } = screenLayout(SCREEN_CONFIG);
    expect([SCREEN_CONFIG.width, SCREEN_CONFIG.height]).toEqual([360, 560]);
    expect(backdrop.y).toBe(topBar.y + topBar.height);
    expect(roadView.y).toBe(backdrop.y + backdrop.height);
    expect(dogRow.y).toBe(roadView.y + roadView.height);
    expect(dogRow.y + dogRow.height).toBe(SCREEN_CONFIG.height);
  });
});
