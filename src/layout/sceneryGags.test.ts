import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { WORLD } from "../data/world";
import { catX, GAG_SIZES, KITE_AT, perchRects, ZONE_GAGS } from "./sceneryGags";
import { screenLayout } from "./screenLayout";

const { approach, backdrop: BAND } = screenLayout(SCREEN_CONFIG);
// The first of the band's approach rows, counted from the band's top.
const APPROACH_ROW = approach.y - BAND.y;

describe("ZONE_GAGS", () => {
  it("places every zone's perches inside the 360px band", () => {
    for (const zone of WORLD.zones) {
      for (const { x0, x1 } of ZONE_GAGS[zone.id].perches) {
        expect(x0).toBeGreaterThanOrEqual(0);
        expect(x1).toBeLessThanOrEqual(BAND.width);
      }
    }
  });

  it("stands each perch's rail on the approach rows, its rect down to the band's bottom", () => {
    for (const zone of WORLD.zones) {
      for (const rect of perchRects(ZONE_GAGS[zone.id], BAND.height)) {
        expect(rect.y).toBeGreaterThanOrEqual(APPROACH_ROW);
        expect(rect.y + rect.height).toBe(BAND.height);
      }
    }
  });

  it("stands the kite's tree on the near-right lawn, x 284 to 359, its foot on the approach rows", () => {
    expect(KITE_AT.x).toBeGreaterThanOrEqual(284);
    expect(KITE_AT.x + GAG_SIZES.kite.width).toBeLessThanOrEqual(BAND.width);
    expect(KITE_AT.y + GAG_SIZES.kite.height).toBeLessThanOrEqual(BAND.height);
    expect(KITE_AT.y + GAG_SIZES.kite.height).toBeGreaterThan(APPROACH_ROW);
  });
});

describe("catX", () => {
  it("keeps the whole cat on a perch for any roll", () => {
    for (const roll of [0, 0.1, 0.3, 0.5, 0.7, 0.99, 1]) {
      const x = catX(ZONE_GAGS.street, roll);
      expect(x).not.toBeNull();
      const onPerch = ZONE_GAGS.street.perches.some(
        ({ x0, x1 }) => (x ?? -1) >= x0 && (x ?? 0) + GAG_SIZES.cat.width <= x1,
      );
      expect(onPerch).toBe(true);
    }
  });

  it("finds no spot in a zone without perches", () => {
    expect(catX({ perches: [] }, 0.5)).toBeNull();
  });
});
