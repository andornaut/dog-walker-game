import { describe, expect, it, vi } from "vitest";

import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import { itemAt } from "../lib/arrays";
import {
  poolAlong,
  poolHalfWidth,
  seamRow,
  vergeBase,
  VERGES,
  type VergeSide,
  walkFrom,
} from "../road/roadside";
import { roadProjection } from "./projection";
import {
  drawRoad,
  pixelWord,
  type RoadFrame,
  roadRaster,
  solidStrip,
  stripLevels,
} from "./roadRaster";
import { screenLayout, walkerFootY } from "./screenLayout";

// Yonge Street's verge made over as the test verge, paved with pools of light.
vi.mock("../../shared/verges.json", async (importOriginal) => {
  const { default: table } = await importOriginal<{ default: Record<string, unknown> }>();
  const { PAVED_VERGE } = await import("../testing/verges");
  return { default: { ...table, "yonge-street": PAVED_VERGE } };
});

const ZONE: ZoneId = "homeStretch";
const verge = VERGES[ZONE];
const pool = itemAt(verge.pools, 0);
const middle = (pool.from + pool.to) / 2;
const EDGE = pixelWord(pool.edgeColour);
const CORE = pixelWord(pool.coreColour);
const SEAM = pixelWord(verge.seamColour);

const { approach, rasterView: view, road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
const raster = roadRaster(projection, approach.y, view);

const frameAt = (scroll: number, band: Uint32Array | null = null): RoadFrame => ({
  approach: band,
  current: { strip: stripLevels(solidStrip(0x123456)), zone: ZONE },
  scroll,
  transition: null,
  zoneStart: 0,
});
const draw = (frame: RoadFrame) => {
  const out = new Uint32Array(view.width * view.height);
  drawRoad(raster, frame, out);
  return out;
};

// The word a pool puts at across on a row at z on a side: its core inside its edge, or null
// outside its outline.
const poolWordAt = (side: VergeSide, z: number, across: number): number | null => {
  const along = poolAlong(pool, side, z);
  if (along < 0) {
    return null;
  }
  const within = (inset: number) => {
    const half = poolHalfWidth(pool, along, inset);
    return half > 0 && across >= middle - half && across < middle + half;
  };
  if (within(pool.edgeWidth)) {
    return CORE;
  }
  return within(0) ? EDGE : null;
};

// Every verge pixel of the rows below the approach at a scroll, with its side, across and z.
const vergePixels = (scroll: number) =>
  raster.rows.slice(raster.approachRows).flatMap((row, k) => {
    const y = raster.approachRows + k;
    const z = scroll + row.distance;
    return Array.from(row.across, (across, i) => ({
      across,
      i,
      seam: seamRow(verge, z, row.span),
      side: (i < row.roadStart ? "left" : "right") as VergeSide,
      y,
      z,
    })).filter(({ across }) => across >= 0);
  });

describe("pools of light on the verge", () => {
  it.each([0, 3.7, 40, 100, 333.5])(
    "draws each side's pools at scroll %d, core inside edge over the paving and its dots",
    (scroll) => {
      const out = draw(frameAt(scroll));
      const pixels = vergePixels(scroll).filter(({ seam }) => !seam);
      const drawn = { left: 0, right: 0 };
      for (const { across, i, side, y, z } of pixels) {
        const word = out[y * view.width + i];
        const want = poolWordAt(side, z, across);
        if (want === null) {
          expect(word === EDGE || word === CORE, `row ${y} column ${i}`).toBe(false);
        } else {
          expect(word, `row ${y} column ${i}`).toBe(want);
          drawn[side] += 1;
        }
      }
      // The sides' pools are staggered, so a scroll may show either side's alone.
      expect(drawn.left + drawn.right).toBeGreaterThan(0);
    },
  );

  it("draws the seams across the pools", () => {
    let covered = 0;
    for (const scroll of [0, 8, 16, 24, 40, 64, 100]) {
      const out = draw(frameAt(scroll));
      for (const { across, i, seam, side, y, z } of vergePixels(scroll)) {
        if (seam && across >= walkFrom(verge) && poolWordAt(side, z, across) !== null) {
          expect(out[y * view.width + i]).toBe(SEAM);
          covered += 1;
        }
      }
    }
    expect(covered).toBeGreaterThan(0);
  });

  // The backdrop paints its pools standing still on its approach verge; the raster draws its
  // own there, moving with the road, over them.
  it("covers the pools the backdrop paints on the approach with the verge", () => {
    const shown = (colour: number) => {
      const band = new Uint32Array(view.width * raster.approachRows);
      const picks = (across: number) => across >= pool.from && across < pool.to;
      raster.rows.slice(raster.junctionRows, raster.approachRows).forEach((row, k) => {
        row.across.forEach((across, i) => {
          const rgb = picks(across) ? colour : vergeBase(verge, across, row.scale);
          band[(raster.junctionRows + k) * view.width + i] = across < 0 ? 0 : pixelWord(rgb);
        });
      });
      const out = draw(frameAt(7, band));
      return raster.rows
        .slice(raster.junctionRows, raster.approachRows)
        .flatMap((row, k) =>
          Array.from(row.across, (across, i) =>
            picks(across) ? out[(raster.junctionRows + k) * view.width + i] !== 0 : null,
          ).filter((kept) => kept !== null),
        );
    };
    for (const colour of [pool.edgeColour, pool.coreColour]) {
      const kept = shown(colour);
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.every(Boolean)).toBe(true);
    }
    expect(shown(0x010203).some(Boolean)).toBe(false);
  });
});
