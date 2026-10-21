import { describe, expect, it } from "vitest";

import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import { tallestPackLength } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { walkerFootY, walkGeometry, walkProjection } from "./walkGeometry";

const gameRoad = screenLayout(SCREEN_CONFIG).road;
const projection = walkProjection(ROAD_CAMERA, gameRoad);
const PACKS = [
  { dogs: ["koda"], walker: "ada" },
  { dogs: ["zippy", "penny"], walker: "ben" },
  { dogs: ["snowball", "duchess", "pierre"], walker: "trista" },
] as const;

describe("walkGeometry", () => {
  it("spans the road from the far edge in view to the bottom, the walker just above it", () => {
    const geometry = walkGeometry(5, PACKS[1], projection, gameRoad);
    expect(geometry.roadBottom).toBe(gameRoad.y + gameRoad.height);
    expect(walkerFootY(gameRoad)).toBeLessThan(geometry.roadBottom);
    expect(walkerFootY(gameRoad)).toBeGreaterThan(geometry.roadBottom - 10);
  });

  // A 1-lane hit box is ROAD_HIT_SIZE wide whatever size the art is drawn, and each lane more
  // adds a lane's width.
  const { cell } = walkGeometry(LANE_COUNT, PACKS[0], projection, gameRoad);
  it.each([1, 2, 3])("hits a %d-lane obstacle at the hit size, not the sprite size", (lanes) => {
    const hit = lanes * cell.length - 2 * cell.inset;
    expect(hit).toBe(ROAD_HIT_SIZE + (lanes - 1) * cell.length);
    expect(hit).toBeLessThan(ROAD_SPRITE_SIZE + (lanes - 1) * cell.length);
  });

  it("brings spawns into view at the projected road's far edge, the look-ahead ahead", () => {
    const geometry = walkGeometry(5, PACKS[2], projection, gameRoad);
    const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;
    expect(walkerFootY(gameRoad) - geometry.roadTop).toBeCloseTo(lookAhead, 6);
    expect(geometry.sightLength).toBeGreaterThan(500);
  });

  // The band is the outline's rows, from the walker's feet up to the pack's top, and every
  // part's hit rectangle lies inside the outline.
  it.each(PACKS)("puts the pack's band and parts on the road for $walker", (pack) => {
    const { packBand, packParts, tallestPackBand } = walkGeometry(5, pack, projection, gameRoad);
    const { outline } = packParts;
    expect(packBand).toEqual({ bottom: walkerFootY(gameRoad), top: outline.top });
    expect(outline.bottom - outline.top).toBeLessThanOrEqual(tallestPackBand);
    expect(tallestPackBand).toBe(tallestPackLength(projection));
    expect(packParts.dogs).toHaveLength(pack.dogs.length);
    for (const part of [packParts.walker, ...packParts.dogs]) {
      expect(part.top).toBeGreaterThan(outline.top);
      expect(part.bottom).toBeLessThan(outline.bottom);
      expect(part.left).toBeGreaterThan(outline.left);
      expect(part.right).toBeLessThan(outline.right);
    }
  });

  // A row's hit box and the longest pack fit between rows, or the planner cannot place them.
  it("spaces rows of spawns far enough apart for a row and the longest pack", () => {
    const { cell, tallestPackBand } = walkGeometry(5, PACKS[0], projection, gameRoad);
    const row = cell.length - 2 * cell.inset;
    expect(TUNING.pixels.spawnRowSpacing).toBeGreaterThanOrEqual(row + tallestPackBand);
  });
});
