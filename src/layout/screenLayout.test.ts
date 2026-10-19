import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "./screenLayout";

const config = {
  backdropHeight: 150,
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
  topBarHeight: 40,
  width: 360,
};

describe("screenLayout", () => {
  it("spans the top bar across the full width", () => {
    expect(screenLayout(config).topBar).toEqual({ height: 40, width: 360, x: 0, y: 0 });
  });

  it("puts the backdrop band under the top bar, across the full width", () => {
    expect(screenLayout(config).backdrop).toEqual({ height: 150, width: 360, x: 0, y: 40 });
  });

  it("puts the dog column and the road side by side under the backdrop", () => {
    const { dogColumn, road } = screenLayout(config);
    expect(dogColumn).toEqual({ height: 450, width: 80, x: 0, y: 190 });
    expect(road).toEqual({ height: 450, width: 280, x: 80, y: 190 });
  });

  it("places a 72x146 doghouse slot every 150px, 4px in, the last meeting the bottom", () => {
    expect(screenLayout(config).dogSlots).toEqual([
      { height: 146, width: 72, x: 4, y: 194 },
      { height: 146, width: 72, x: 4, y: 344 },
      { height: 146, width: 72, x: 4, y: 494 },
    ]);
  });

  it("keeps the road width when there are fewer slots", () => {
    expect(screenLayout({ ...config, dogSlotCount: 1 }).road.width).toBe(280);
  });

  it("splits the game's road into 56px lanes", () => {
    expect(screenLayout(SCREEN_CONFIG).road.width / 5).toBe(56);
  });
});
