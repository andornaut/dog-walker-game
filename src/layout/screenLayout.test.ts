import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "./screenLayout";

const config = {
  backdropHeight: 110,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 24,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
};

describe("screenLayout", () => {
  it("spans the top bar across the full width", () => {
    expect(screenLayout(config).topBar).toEqual({ height: 40, width: 360, x: 0, y: 0 });
  });

  it("puts the backdrop band under the top bar, across the full width", () => {
    expect(screenLayout(config).backdrop).toEqual({ height: 110, width: 360, x: 0, y: 40 });
  });

  it("draws the road across the full width from the band down to the doghouses", () => {
    expect(screenLayout(config).roadView).toEqual({ height: 320, width: 360, x: 0, y: 150 });
  });

  it("runs the road's approach up the band's bottom 24 rows, band rows 86 to 109", () => {
    const { approach, rasterView } = screenLayout(config);
    expect(approach).toEqual({ height: 24, width: 360, x: 0, y: 126 });
    expect(rasterView).toEqual({ height: 344, width: 360, x: 0, y: 126 });
  });

  it("centres the road's lanes in the drawn road", () => {
    expect(screenLayout(config).road).toEqual({ height: 320, width: 280, x: 40, y: 150 });
  });

  it("puts a row of 120x90 doghouse slots along the bottom", () => {
    const { dogRow, dogSlots } = screenLayout(config);
    expect(dogRow).toEqual({ height: 90, width: 360, x: 0, y: 470 });
    expect(dogSlots).toEqual([
      { height: 90, width: 120, x: 0, y: 470 },
      { height: 90, width: 120, x: 120, y: 470 },
      { height: 90, width: 120, x: 240, y: 470 },
    ]);
  });

  it("splits the game's road into 56px lanes", () => {
    const { road } = screenLayout(SCREEN_CONFIG);
    expect(road.width / LANE_COUNT).toBe(56);
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
