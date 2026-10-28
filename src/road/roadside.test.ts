import { describe, expect, it } from "vitest";

import { paletteColour } from "../assets/housePalette";
import { SCREEN_CONFIG } from "../data/screen";
import { itemAt } from "../lib/arrays";
import { PAVED_VERGE } from "../testing/verges";
import {
  curbBand,
  curbFits,
  isLawn,
  POOL_STEP,
  poolAlong,
  poolHalfWidth,
  sidewalkTo,
  vergeBase,
  vergeFrom,
  VERGES_BY_ART,
  type VergeSide,
  walkFrom,
} from "./roadside";

const ROAD_HALF = SCREEN_CONFIG.roadWidth / 2;
const VERGE_ARTS = Object.entries(VERGES_BY_ART);

const PAVED = PAVED_VERGE;
const POOL = itemAt(PAVED.pools, 0);
const poolEntry = (change: Partial<typeof POOL>) => ({ ...PAVED, pools: [{ ...POOL, ...change }] });

describe("vergeFrom", () => {
  it("reads colours by palette name and a null walkTo as paving out to the screen's edges", () => {
    const verge = vergeFrom(PAVED);
    expect(verge.walkTo).toBe(Number.POSITIVE_INFINITY);
    expect(verge.walkDots[0]?.colours).toEqual([verge.seamColour]);
  });

  it("reads a verge's pools with their colours by palette name, and none where it lists none", () => {
    const { pools, ...plain } = PAVED;
    expect(vergeFrom(PAVED).pools).toEqual(
      pools.map((pool) => ({
        ...pool,
        coreColour: paletteColour(pool.coreColour),
        edgeColour: paletteColour(pool.edgeColour),
      })),
    );
    expect(vergeFrom(plain).pools).toEqual([]);
  });

  // A pool per lamp: a long period, one pool ending where its period does, beside another.
  it.each([
    ["a period of many joints", [{ ...POOL, every: 3360 }]],
    ["a pool ending at its period's end", [{ ...POOL, offset: { left: 80, right: 0 } }]],
    ["several pools", [POOL, { ...POOL, every: 1120, offset: { left: 1072, right: 0 } }]],
  ])("reads %s", (_, pools) => {
    expect(vergeFrom({ ...PAVED, pools }).pools).toHaveLength(pools.length);
  });

  it.each([
    ["a colour name not on the palette", { ...PAVED, curbColour: "no-such-colour" }],
    ["a lawn kind it does not know", { ...PAVED, lawn: "meadow" }],
    ["a lawn with no colours", { ...PAVED, lawn: "mown", walkTo: 208 }],
    ["lawn colours with no lawn", { ...PAVED, lawnColours: ["grey", "grey", "grey"] }],
    ["a pool colour not on the palette", poolEntry({ coreColour: "no-such-colour" })],
    ["a pool shape it does not know", poolEntry({ shape: "star" })],
    ["a pool period not a multiple of 32", poolEntry({ every: 112 })],
    ["a pool longer than its period", poolEntry({ every: 32, offset: { left: 0, right: 0 } })],
    ["a pool offset past its period", poolEntry({ offset: { left: 0, right: 128 } })],
    ["a pool size off the 2 px steps", poolEntry({ length: 47 })],
    ["a pool reaching onto the road", poolEntry({ from: 158 })],
    ["a pool ending where it starts", poolEntry({ from: 200 })],
    ["a pool reaching past the sidewalk", { ...poolEntry({ to: 220 }), walkTo: 208 }],
    ["a pool whose edge leaves no core", poolEntry({ edgeWidth: 16 })],
  ])("throws on %s", (_, entry) => {
    expect(() => vergeFrom(entry)).toThrow();
  });
});

describe("pools", () => {
  const pool = itemAt(vergeFrom(PAVED).pools, 0);
  const band = { ...pool, shape: "band" as const };

  // The left side's pools start at 0 and the right's at 64, each 48 long, every 128.
  it.each<[VergeSide, number, number]>([
    ["left", 0, 0],
    ["left", 47.5, 47.5],
    ["left", 48, -1],
    ["left", 127, -1],
    ["left", 130, 2],
    ["left", -10, -1],
    ["right", 0, -1],
    ["right", 64, 0],
    ["right", 100, 36],
    ["right", 112, -1],
    ["right", 200, 8],
  ])("lies %s at z %d, %d along its pool", (side, z, along) => {
    expect(poolAlong(pool, side, z)).toBe(along);
  });

  // The outline at each along, as half its width: the ellipse's widest in the middle and
  // narrowing to its ends, the band's the same all along; the core the same inset by the edge.
  it.each([
    ["ellipse", pool, 0, 0, 4],
    ["ellipse", pool, 23, 0, 16],
    ["ellipse", pool, 24, 0, 16],
    ["ellipse", pool, 47, 0, 4],
    ["ellipse", pool, 48, 0, 0],
    ["ellipse", pool, 3, 4, 0],
    ["ellipse", pool, 4, 4, 4],
    ["ellipse", pool, 24, 4, 12],
    ["ellipse", pool, 44, 4, 0],
    ["band", band, 0, 0, 16],
    ["band", band, 47, 0, 16],
    ["band", band, 3, 4, 0],
    ["band", band, 4, 4, 12],
    ["band", band, 44, 4, 0],
  ])("gives the %s %d along, inset %d, a half width of %d", (_, shape, along, inset, half) => {
    expect(poolHalfWidth(shape, along, inset)).toBe(half);
  });

  it.each([
    ["edge", 0],
    ["core", pool.edgeWidth],
  ])("steps the ellipse's %s 2 px at a time, along and across", (_, inset) => {
    const halves = Array.from({ length: pool.length * 4 }, (__, i) =>
      poolHalfWidth(pool, i / 4, inset),
    );
    halves.forEach((half, i) => {
      expect(half % POOL_STEP).toBe(0);
      expect(half).toBe(halves[Math.floor(i / (4 * POOL_STEP)) * 4 * POOL_STEP]);
    });
  });
});

describe("curbBand", () => {
  // Every whole across from the road's edge out past the widest sidewalk.
  const ACROSS = Array.from({ length: 120 }, (_, i) => ROAD_HALF + i);

  it.each(VERGE_ARTS)("lies on %s's sidewalk or paving, or is null with none", (_, verge) => {
    const band = curbBand(verge);
    const walk = ACROSS.filter(
      (across) =>
        across >= walkFrom(verge) &&
        !isLawn(verge, across) &&
        vergeBase(verge, across, 1) === verge.walkColour,
    );
    expect(band === null).toBe(walk.length === 0);
    if (band !== null) {
      expect(band.from).toBeGreaterThan(walkFrom(verge));
      expect(band.to).toBeLessThan(sidewalkTo(verge));
      const inBand = ACROSS.filter((across) => across >= band.from && across < band.to);
      expect(inBand.every((across) => walk.includes(across))).toBe(true);
    }
  });
});

describe("curbFits", () => {
  const WIDTH = 20;
  // Props placed against a verge's band, and anywhere beside a verge with none: curbFits reads
  // only the band, so one verge of each covers every verge.
  const SAMPLE = [
    VERGE_ARTS.find(([, verge]) => curbBand(verge) !== null),
    VERGE_ARTS.find(([, verge]) => curbBand(verge) === null),
  ].flatMap((entry) => (entry === undefined ? [] : [entry]));
  const CASES = SAMPLE.flatMap(([art, verge]) => {
    const band = curbBand(verge);
    if (band === null) {
      const across = walkFrom(verge) + WIDTH;
      return [{ across, art, fits: false, verge, what: "beside", width: WIDTH }];
    }
    const { from, to } = band;
    const middle = (from + to) / 2;
    return [
      { across: middle, fits: true, what: "in the middle of", width: WIDTH },
      { across: middle, fits: true, what: "filling", width: to - from },
      { across: middle, fits: false, what: "wider than", width: to - from + 1 },
      { across: from + WIDTH / 2, fits: true, what: "against the inner edge of", width: WIDTH },
      { across: to - WIDTH / 2, fits: true, what: "against the outer edge of", width: WIDTH },
      { across: from + WIDTH / 2 - 1, fits: false, what: "over the inner edge of", width: WIDTH },
      { across: to - WIDTH / 2 + 1, fits: false, what: "over the outer edge of", width: WIDTH },
      { across: ROAD_HALF / 2, fits: false, what: "on the road beside", width: WIDTH },
    ].map((each) => ({ ...each, art, verge }));
  });

  it.each(CASES)("fits a prop $what $art's band: $fits", ({ across, fits, verge, width }) => {
    expect(curbFits(verge, { across, width })).toBe(fits);
  });
});
