import { describe, expect, it } from "vitest";

import { WORLD } from "../data/world";
import { ballX, catReacts, catX, GAG_SIZES, ZONE_GAGS } from "./sceneryGags";

describe("ZONE_GAGS", () => {
  it("places gags for every zone, inside the 360px band", () => {
    for (const zone of WORLD.zones) {
      const gags = ZONE_GAGS[zone.id];
      for (const { x0, x1 } of gags.fences) {
        expect(x0).toBeGreaterThanOrEqual(0);
        expect(x1).toBeLessThanOrEqual(360);
      }
      for (const x of gags.sprinklers) {
        expect(x - GAG_SIZES.sprinkler.width / 2).toBeGreaterThanOrEqual(0);
        expect(x + GAG_SIZES.sprinkler.width / 2).toBeLessThanOrEqual(360);
      }
    }
  });

  it("has cats on the fences of Woof Way and The Long Way Home only", () => {
    expect(ZONE_GAGS.street.fences).toHaveLength(2);
    expect(ZONE_GAGS.homeStretch.fences).toHaveLength(2);
    expect(ZONE_GAGS.park.fences).toEqual([]);
    expect(ZONE_GAGS.shops.fences).toEqual([]);
  });
});

describe("catX", () => {
  it("keeps the whole cat on a fence for any roll", () => {
    for (const roll of [0, 0.1, 0.3, 0.5, 0.7, 0.99, 1]) {
      const x = catX(ZONE_GAGS.street, roll);
      expect(x).not.toBeNull();
      const onFence = ZONE_GAGS.street.fences.some(
        ({ x0, x1 }) => (x ?? -1) >= x0 && (x ?? 0) + GAG_SIZES.cat.width <= x1,
      );
      expect(onFence).toBe(true);
    }
  });

  it("finds no spot in a zone without fences", () => {
    expect(catX(ZONE_GAGS.park, 0.5)).toBeNull();
  });
});

describe("catReacts", () => {
  it("sits up while the pack passes near the cat, not when it is far off", () => {
    expect(catReacts(200, 212)).toBe(true);
    expect(catReacts(200, 300)).toBe(false);
  });
});

describe("ballX", () => {
  it("rolls in from the left at 40px/s and is gone between rolls", () => {
    expect(ballX(360, 0)).toBe(-14);
    expect(ballX(360, 1)).toBe(26);
    expect(ballX(360, 10)).toBeNull();
    expect(ballX(360, 31)).toBe(26);
  });
});
