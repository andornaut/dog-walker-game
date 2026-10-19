import { describe, expect, it } from "vitest";

import { WORLD } from "../data/world";
import { ballAt, catReacts, catX, GAG_SIZES, GAG_Y, ZONE_GAGS } from "./sceneryGags";

const BAND = { height: 110, width: 360 };

describe("ZONE_GAGS", () => {
  it("places gags for every zone, inside the 360px band", () => {
    for (const zone of WORLD.zones) {
      const gags = ZONE_GAGS[zone.id];
      for (const { x0, x1 } of gags.perches) {
        expect(x0).toBeGreaterThanOrEqual(0);
        expect(x1).toBeLessThanOrEqual(BAND.width);
      }
      for (const x of gags.sprinklers) {
        expect(x - GAG_SIZES.sprinkler.width / 2).toBeGreaterThanOrEqual(0);
        expect(x + GAG_SIZES.sprinkler.width / 2).toBeLessThanOrEqual(BAND.width);
      }
    }
  });

  it("perches a cat along every zone's near-left lawn, from x 0 to 82", () => {
    for (const zone of WORLD.zones) {
      expect(ZONE_GAGS[zone.id].perches).toEqual([{ x0: 0, x1: 82 }]);
    }
    // The cat's paws, on its frame's bottom row, rest on the rail's row 94.
    expect(GAG_Y.cat + GAG_SIZES.cat.height - 1).toBe(94);
  });

  it("stands a sprinkler on the near-right lawn, x 274 to 359, rows 86 to 109, except at the shops", () => {
    for (const zone of ["street", "park", "homeStretch"] as const) {
      for (const x of ZONE_GAGS[zone].sprinklers) {
        expect(x - GAG_SIZES.sprinkler.width / 2).toBeGreaterThanOrEqual(274);
        expect(x + GAG_SIZES.sprinkler.width / 2).toBeLessThanOrEqual(360);
      }
    }
    expect(GAG_Y.sprinkler).toBeGreaterThanOrEqual(86);
    expect(GAG_Y.sprinkler + GAG_SIZES.sprinkler.height - 1).toBeLessThanOrEqual(109);
    expect(ZONE_GAGS.shops.sprinklers).toEqual([]);
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
    expect(catX({ perches: [], sprinklers: [] }, 0.5)).toBeNull();
  });
});

describe("catReacts", () => {
  it("sits up while the pack passes near the cat, not when it is far off", () => {
    expect(catReacts(80, 108)).toBe(true);
    expect(catReacts(80, 300)).toBe(false);
  });
});

describe("ballAt", () => {
  it("rolls up the near-left sidewalk from the band's bottom edge, then the right one", () => {
    const start = ballAt(0);
    expect(start).toEqual({ x: 90, y: 96 });
    expect((ballAt(2)?.y ?? 0) < (start?.y ?? 0)).toBe(true);
    expect(ballAt(30)).toEqual({ x: 256, y: 96 });
  });

  it("stays in the band, and is gone between rolls", () => {
    for (let seconds = 0; seconds < 60; seconds += 0.25) {
      const at = ballAt(seconds);
      if (at !== null) {
        expect(at.y + GAG_SIZES.ball.height).toBeLessThanOrEqual(BAND.height);
      }
    }
    expect(ballAt(10)).toBeNull();
  });

  it("rests at the near end of the left sidewalk when still", () => {
    expect(ballAt(17, true)).toEqual({ x: 90, y: 96 });
  });
});
