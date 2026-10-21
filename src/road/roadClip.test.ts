import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { rowsAboveJuncture } from "./roadClip";

const { approach, road } = screenLayout(SCREEN_CONFIG);
const JUNCTURE = approach.y;

describe("rowsAboveJuncture", () => {
  it.each([
    { hidden: 0, name: "wholly below", scale: 1, top: JUNCTURE + 5 },
    { hidden: 10, name: "partly above", scale: 1, top: JUNCTURE - 10 },
    { hidden: 20, name: "partly above, at half scale", scale: 0.5, top: JUNCTURE - 10 },
    { hidden: 1, name: "straddling by a part of a row", scale: 1, top: JUNCTURE - 0.5 },
    { hidden: 30, name: "wholly above", scale: 1, top: JUNCTURE - 40 },
  ])("hides $hidden rows of a sprite $name", ({ hidden, scale, top }) => {
    expect(rowsAboveJuncture(JUNCTURE, { height: 30, scale, top })).toBe(hidden);
  });

  // An item comes into view with its feet on the road's far edge, at the smallest depth step,
  // which draws its own art at scale 1.
  it.each([8, approach.height, 40, 64])(
    "shows an item %d rows tall the moment its feet reach the far edge",
    (height) => {
      const hidden = rowsAboveJuncture(JUNCTURE, { height, scale: 1, top: road.y - height });
      expect(hidden).toBeLessThan(height);
      expect(hidden).toBe(Math.max(0, height - (road.y - JUNCTURE)));
    },
  );
});
