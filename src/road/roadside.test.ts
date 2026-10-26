import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { WORLD } from "../data/world";
import {
  curbBand,
  curbFits,
  isLawn,
  sidewalkTo,
  vergeBase,
  vergeFrom,
  VERGES,
  VERGES_BY_ART,
  walkFrom,
} from "./roadside";

const ROAD_HALF = SCREEN_CONFIG.roadWidth / 2;
const VERGE_ARTS = Object.entries(VERGES_BY_ART);

// A paved verge as art writes it, with colours by palette name.
const PAVED = {
  curbColor: "stone",
  curbTo: 164,
  lawn: "none",
  lawnColors: null,
  leaves: false,
  seamColor: "grey",
  seamEvery: 32,
  strips: [],
  walkColor: "lgrey",
  walkDots: [{ colors: ["grey"], share: 0.1 }],
  walkTo: null,
};

describe("vergeFrom", () => {
  it("reads colours by palette name and a null walkTo as paving out to the screen's edges", () => {
    const verge = vergeFrom(PAVED);
    expect(verge.walkTo).toBe(Number.POSITIVE_INFINITY);
    expect(verge.walkDots[0]?.colors).toEqual([verge.seamColor]);
  });

  it.each([
    ["a colour name not on the palette", { ...PAVED, curbColor: "no-such-colour" }],
    ["a lawn kind it does not know", { ...PAVED, lawn: "meadow" }],
    ["a lawn with no colours", { ...PAVED, lawn: "mown", walkTo: 208 }],
    ["lawn colours with no lawn", { ...PAVED, lawnColors: ["grey", "grey", "grey"] }],
  ])("throws on %s", (_, entry) => {
    expect(() => vergeFrom(entry)).toThrow();
  });
});

describe("VERGES", () => {
  it.each(WORLD.zones)("gives $id the verge drawn for its art, $art", (zone) => {
    expect(VERGES[zone.id as keyof typeof VERGES]).toBe(VERGES_BY_ART[zone.art]);
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
        vergeBase(verge, across, 1) === verge.walkColor,
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
  // Props placed against each verge's band, or anywhere beside a verge with none.
  const CASES = VERGE_ARTS.flatMap(([art, verge]) => {
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
