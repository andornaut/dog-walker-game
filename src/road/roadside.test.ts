import { describe, expect, it } from "vitest";

import { WORLD } from "../data/world";
import { vergeFrom, VERGES, VERGES_BY_ART } from "./roadside";

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
