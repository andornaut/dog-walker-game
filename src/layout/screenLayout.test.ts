import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "./screenLayout";

const config = {
  backdropHeight: 110,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 24,
  roadWidth: 320,
  topBarHeight: 40,
  width: 360,
};

describe("screenLayout", () => {
  const layout = screenLayout(config);
  it.each([
    ["the top bar across the full width", layout.topBar, { height: 40, width: 360, x: 0, y: 0 }],
    [
      "the backdrop band under the top bar, across the full width",
      layout.backdrop,
      { height: 110, width: 360, x: 0, y: 40 },
    ],
    [
      "the drawn road across the full width from the band down to the doghouses",
      layout.roadView,
      { height: 320, width: 360, x: 0, y: 150 },
    ],
    [
      "the road's approach up the band's bottom 24 rows, band rows 86 to 109",
      layout.approach,
      { height: 24, width: 360, x: 0, y: 126 },
    ],
    [
      "the raster view from the approach down",
      layout.rasterView,
      { height: 344, width: 360, x: 0, y: 126 },
    ],
    [
      "the road's lanes centred in the drawn road",
      layout.road,
      { height: 320, width: 320, x: 20, y: 150 },
    ],
    [
      "the walk view from the band down to the doghouses",
      layout.walkView,
      { height: 430, width: 360, x: 0, y: 40 },
    ],
    ["the doghouse row along the bottom", layout.dogRow, { height: 90, width: 360, x: 0, y: 470 }],
    [
      "three 120x90 doghouse slots in the row",
      layout.dogSlots,
      [
        { height: 90, width: 120, x: 0, y: 470 },
        { height: 90, width: 120, x: 120, y: 470 },
        { height: 90, width: 120, x: 240, y: 470 },
      ],
    ],
  ])("places %s", (_, actual, expected) => {
    expect(actual).toEqual(expected);
  });

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
