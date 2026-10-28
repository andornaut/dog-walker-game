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
  START_STRIP_ZONE_ROWS,
  STRIP,
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

// Another zone's verge, with no pools and none of their colours.
const OTHER: ZoneId = "shops";
const lookOf = (zone: ZoneId) => ({ strip: stripLevels(solidStrip(0x123456)), zone });
const frameAt = (scroll: number, overrides: Partial<RoadFrame> = {}): RoadFrame => ({
  approach: null,
  current: lookOf(ZONE),
  scroll,
  transition: null,
  zoneStart: 0,
  ...overrides,
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

// Every verge pixel of the rows below the approach in a frame, with its side and across, the
// zone whose verge lies beside the row, whether the row is one of its seams, and the row's z
// along that zone's road from its start strip, as roadside props count it. While a start strip
// rolls in, the previous zone's verge lies beside its road and the start strip's cross street.
const vergePixels = (frame: RoadFrame) =>
  raster.rows.slice(raster.approachRows).flatMap((row, k) => {
    const y = raster.approachRows + k;
    const z = frame.scroll + row.distance;
    const along = Math.floor(z - frame.zoneStart - raster.visibleDistance);
    const { transition } = frame;
    const previous = transition !== null && along < STRIP.height - START_STRIP_ZONE_ROWS;
    const zone = previous ? transition.previous.zone : frame.current.zone;
    const start = previous ? transition.previousStart : frame.zoneStart;
    return Array.from(row.across, (across, i) => ({
      across,
      i,
      seam: seamRow(VERGES[zone], z, row.span),
      side: (i < row.roadStart ? "left" : "right") as VergeSide,
      y,
      zone,
      zoneZ: z - start - raster.visibleDistance,
    })).filter(({ across }) => across >= 0);
  });

// Checks every verge pixel off a seam: the pool's word where a pool lies on the pooled zone's
// verge, and neither pool colour elsewhere. Returns how many pool pixels it saw.
const expectPools = (frame: RoadFrame): number => {
  const out = draw(frame);
  let drawn = 0;
  for (const { across, i, seam, side, y, zone, zoneZ } of vergePixels(frame)) {
    if (seam) {
      continue;
    }
    const word = out[y * view.width + i];
    const want = zone === ZONE ? poolWordAt(side, zoneZ, across) : null;
    if (want === null) {
      expect(word === EDGE || word === CORE, `row ${y} column ${i}`).toBe(false);
    } else {
      expect(word, `row ${y} column ${i}`).toBe(want);
      drawn += 1;
    }
  }
  return drawn;
};

describe("pools of light on the verge", () => {
  it.each([0, 3.7, 40, 100, 333.5])(
    "draws each side's pools at scroll %d, core inside edge over the paving and its dots",
    (scroll) => {
      expect(expectPools(frameAt(scroll))).toBeGreaterThan(0);
    },
  );

  // A walk started mid-route, or a zone reached after another walk length, puts the zone's start
  // at another scroll: its pools stay where they lie along its own road.
  it.each([1667, 12345.5, -777])("counts pools from the zone's start at %d", (zoneStart) => {
    for (const into of [0, 40, 333.5]) {
      expect(expectPools(frameAt(zoneStart + into, { zoneStart }))).toBeGreaterThan(0);
    }
  });

  // The previous zone's start is not a whole number of pools before the current one's, so each
  // zone's pools only line up with its own start.
  it.each([
    { current: OTHER, name: "leaving", previous: ZONE },
    { current: ZONE, name: "entering", previous: OTHER },
  ])("counts each zone's pools from its own start while $name the pooled zone", (zones) => {
    const zoneStart = 5000;
    let drawn = 0;
    for (const into of [10, 40, 90, 200]) {
      drawn += expectPools(
        frameAt(zoneStart + into, {
          current: lookOf(zones.current),
          transition: {
            previous: lookOf(zones.previous),
            previousStart: zoneStart - 3333,
            start: lookOf(zones.current),
          },
          zoneStart,
        }),
      );
    }
    expect(drawn).toBeGreaterThan(0);
  });

  it("draws the seams across the pools", () => {
    let covered = 0;
    for (const scroll of [0, 8, 16, 24, 40, 64, 100]) {
      const frame = frameAt(scroll);
      const out = draw(frame);
      for (const { across, i, seam, side, y, zoneZ } of vergePixels(frame)) {
        if (seam && across >= walkFrom(verge) && poolWordAt(side, zoneZ, across) !== null) {
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
      const out = draw(frameAt(7, { approach: band }));
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
