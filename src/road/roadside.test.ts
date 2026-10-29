import { itemAt } from "@andornaut/game-kit/arrays";
import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { WORLD } from "../data/world";
import { PAVED_VERGE } from "../testing/verges";
import {
  curbBand,
  curbFits,
  isLawn,
  sidewalkTo,
  vergeBase,
  vergeFrom,
  VERGES_BY_ART,
  walkFrom,
} from "./roadside";

const ROAD_HALF = SCREEN_CONFIG.roadWidth / 2;
const VERGE_ARTS = Object.entries(VERGES_BY_ART);

const PAVED = PAVED_VERGE;
const POOL = itemAt(PAVED.pools, 0);
const poolEntry = (change: Record<string, unknown>) => ({
  ...PAVED,
  pools: [{ ...POOL, ...change }],
});

describe("vergeFrom", () => {
  it("reads colours by palette name and a null walkTo as paving out to the screen's edges", () => {
    const verge = vergeFrom(PAVED);
    expect(verge.walkTo).toBe(Number.POSITIVE_INFINITY);
    expect(verge.walkDots[0]?.colours).toEqual([verge.seamColour]);
  });

  it("reads a verge's lights, by zone where it names zones, and none where it lists none", () => {
    const { pools, ...plain } = PAVED;
    const zone = itemAt(WORLD.zones, 0).id;
    expect(vergeFrom({ ...PAVED, pools: [{ ...POOL, zones: [zone] }] }).pools).toEqual(
      pools.map((pool) => ({ ...pool, zones: [zone] })),
    );
    expect(vergeFrom(PAVED).pools).toEqual(pools.map((pool) => ({ ...pool, zones: null })));
    expect(vergeFrom(plain).pools).toEqual([]);
  });

  // A light per lamp: a long period, one light at its period's end, beside another.
  it.each([
    ["a long period", [{ ...POOL, every: 3360 }]],
    ["a light at its period's end", [{ ...POOL, offset: { left: 127, right: 0 } }]],
    ["several lights", [POOL, { ...POOL, every: 1120, offset: { left: 1072, right: 0 } }]],
  ])("reads %s", (_, pools) => {
    expect(vergeFrom({ ...PAVED, pools }).pools).toHaveLength(pools.length);
  });

  it.each([
    ["a colour name not on the palette", { ...PAVED, curbColour: "no-such-colour" }],
    ["a lawn kind it does not know", { ...PAVED, lawn: "meadow" }],
    ["a lawn with no colours", { ...PAVED, lawn: "mown", walkTo: 208 }],
    ["lawn colours with no lawn", { ...PAVED, lawnColours: ["grey", "grey", "grey"] }],
    ["a pool naming no light", poolEntry({ light: "no-such-light" })],
    ["a pool with a field it does not know", poolEntry({ colour: "cream" })],
    ["a pool naming no zone", poolEntry({ zones: ["no-such-zone"] })],
    ["a pool with no zones listed", poolEntry({ zones: [] })],
    ["a pool offset past its period", poolEntry({ offset: { left: 0, right: 128 } })],
    ["a pool on the road", poolEntry({ across: ROAD_HALF - 1 })],
    ["a pool past the sidewalk", { ...poolEntry({ across: 210 }), walkTo: 208 }],
    ["a pool at a fraction of a px", poolEntry({ across: 184.5 })],
  ])("throws on %s", (_, entry) => {
    expect(() => vergeFrom(entry)).toThrow();
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
      { across: middle, fits: true, what: "filling", width: to - from },
      { across: middle, fits: false, what: "wider than", width: to - from + 1 },
      { across: from + WIDTH / 2, fits: true, what: "against the inner edge of", width: WIDTH },
      { across: to - WIDTH / 2, fits: true, what: "against the outer edge of", width: WIDTH },
      { across: from + WIDTH / 2 - 1, fits: false, what: "over the inner edge of", width: WIDTH },
      { across: to - WIDTH / 2 + 1, fits: false, what: "over the outer edge of", width: WIDTH },
    ].map((each) => ({ ...each, art, verge }));
  });

  it.each(CASES)("fits a prop $what $art's band: $fits", ({ across, fits, verge, width }) => {
    expect(curbFits(verge, { across, width })).toBe(fits);
  });
});
