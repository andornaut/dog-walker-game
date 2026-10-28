import { describe, expect, it } from "vitest";

import lightTable from "../../shared/lights.json";
import { paletteColour } from "../assets/housePalette";
import { bakeLight, type LightDef, LIGHTS, lightsFrom } from "./lights";

// A light as art writes it, with its colour by palette name.
const DEF = {
  colour: "cream",
  height: 9,
  rings: [
    { scale: 1, strength: 0.08 },
    { scale: 0.66, strength: 0.15 },
    { scale: 0.33, strength: 0.25 },
  ],
  shape: "ellipse",
  width: 9,
};
const tableOf = (def: Record<string, unknown>) => ({ defs: { glow: def } });

describe("lightsFrom", () => {
  it("reads every light art sets out", () => {
    expect([...LIGHTS.keys()].sort()).toEqual(Object.keys(lightTable.defs).sort());
  });

  it("reads a light's colour by palette name", () => {
    expect(lightsFrom(tableOf(DEF)).get("glow")?.colour).toBe(paletteColour("cream"));
  });

  const [outer, middle, inner] = DEF.rings;
  it.each([
    ["a field it does not know", { ...DEF, blend: "add" }],
    ["a table field it does not know", null],
    ["a colour not on the palette", { ...DEF, colour: "no-such-colour" }],
    ["a shape it does not know", { ...DEF, shape: "star" }],
    ["no rings", { ...DEF, rings: [] }],
    ["four rings", { ...DEF, rings: [outer, middle, inner, { scale: 0.1, strength: 0.3 }] }],
    ["a ring wider than the light", { ...DEF, rings: [{ scale: 1.5, strength: 0.1 }] }],
    ["a ring adding nothing", { ...DEF, rings: [{ scale: 1, strength: 0 }] }],
    ["a ring outside the last", { ...DEF, rings: [middle, outer] }],
    ["a ring no brighter than the last", { ...DEF, rings: [outer, { ...middle, strength: 0.08 }] }],
    [
      "a ring covering no pixel",
      { ...DEF, height: 8, rings: [outer, { scale: 0.05, strength: 0.5 }], width: 8 },
    ],
    ["a fraction of a px", { ...DEF, width: 8.5 }],
    ["no width", { ...DEF, width: 0 }],
  ])("throws on %s", (_, def) => {
    const table = def === null ? { ...tableOf(DEF), extra: {} } : tableOf(def);
    expect(() => lightsFrom(table)).toThrow();
  });
});

describe("bakeLight", () => {
  const def = (shape: string): LightDef => ({
    ...DEF,
    colour: paletteColour(DEF.colour),
    shape: shape as LightDef["shape"],
  });
  const ringAt = (shape: string, x: number, y: number) => {
    const baked = bakeLight(def(shape));
    return baked.rings[y * baked.width + x];
  };

  // 9 px across: the centre pixel, 1 and 2 out, the edge's middle and a corner. A cone points
  // down from its apex at the top's middle.
  it.each([
    ["ellipse", 4, 4, 2],
    ["ellipse", 5, 4, 2],
    ["ellipse", 6, 4, 1],
    ["ellipse", 8, 4, 0],
    ["ellipse", 8, 8, -1],
    ["band", 4, 4, 2],
    ["band", 6, 6, 1],
    ["band", 8, 8, 0],
    ["cone", 4, 0, 2],
    ["cone", 4, 4, 1],
    ["cone", 4, 8, 0],
    ["cone", 0, 0, -1],
    ["cone", 0, 8, 0],
  ])("puts the %s's pixel %d, %d in ring %d", (shape, x, y, ring) => {
    expect(ringAt(shape, x, y)).toBe(ring);
  });

  it.each(["band", "cone", "ellipse"])(
    "adds each %s ring's strength of the colour, opaque, and nothing outside",
    (shape) => {
      const baked = bakeLight(def(shape));
      const channels = [0xea, 0xd4, 0xaa];
      baked.rings.forEach((ring, i) => {
        const strength = DEF.rings[ring]?.strength ?? 0;
        const want =
          ring < 0 ? [0, 0, 0, 0] : [...channels.map((c) => Math.round(strength * c)), 255];
        expect([...baked.pixels.subarray(i * 4, i * 4 + 4)]).toEqual(want);
      });
    },
  );

  it.each([
    ["ellipse", 0.5],
    ["band", 0.5],
    ["cone", 0],
  ])("anchors the %s at %d of its height", (shape, originY) => {
    const baked = bakeLight(def(shape));
    expect([baked.originX, baked.originY]).toEqual([0.5, originY]);
  });
});
