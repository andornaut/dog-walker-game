import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import depthSteps from "../../shared/depth-steps.json";
import lightTable from "../../shared/lights.json";
import { paletteColour } from "../assets/housePalette";
import { IDLE_TAG } from "../assets/spriteKeys";
import { WORLD } from "../data/world";
import { itemAt } from "../lib/arrays";
import { decodePng } from "../testing/png";
import { newAttachedLightPlaces, placeAttachedLights } from "./lightPlaces";
import { bakeLight, LIGHT_ATTACHMENTS, type LightDef, LIGHTS, lightsFrom } from "./lights";

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
const CONE = { ...DEF, shape: "cone" };
const tableOf = (def: Record<string, unknown>, attach?: Record<string, unknown>) => ({
  ...(attach === undefined ? {} : { attach: { "some-sprite": [attach] } }),
  defs: { beam: CONE, glow: def },
});
// A light attached to a sprite, as art writes it.
const ATTACHED = { dx: 2, dy: -3, light: "glow" };

describe("lightsFrom", () => {
  it("reads every light art sets out", () => {
    expect([...LIGHTS.keys()].sort()).toEqual(Object.keys(lightTable.defs).sort());
  });

  it("reads a light's colour by palette name", () => {
    expect(lightsFrom(tableOf(DEF)).defs.get("glow")?.colour).toBe(paletteColour("cream"));
  });

  it("reads a sprite's lights, a cone pointing down, steady, in every zone, unless set", () => {
    const zone = "homeStretch";
    const read = (attach: Record<string, unknown>) =>
      lightsFrom(tableOf(DEF, attach)).attach.get("some-sprite");
    expect(read(ATTACHED)).toEqual([{ ...ATTACHED, angle: 90, pulse: null, zones: null }]);
    const beam = { ...ATTACHED, angle: 0, light: "beam", pulse: [1, 0.5], zones: [zone] };
    expect(read(beam)).toEqual([beam]);
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

  it.each([
    ["a field it does not know", { ...ATTACHED, blend: "add" }],
    ["a light it does not know", { ...ATTACHED, light: "no-such-light" }],
    ["an angle on a light that is no cone", { ...ATTACHED, angle: 45 }],
    ["a fraction of a px", { ...ATTACHED, dx: 0.5 }],
    ["an empty pulse", { ...ATTACHED, pulse: [] }],
    ["a pulse past full strength", { ...ATTACHED, pulse: [1, 1.5] }],
    ["a zone it does not know", { ...ATTACHED, zones: ["no-such-zone"] }],
    ["no zones listed", { ...ATTACHED, zones: [] }],
  ])("throws on an attached light with %s", (_, attach) => {
    expect(() => lightsFrom(tableOf(DEF, attach))).toThrow();
  });
});

describe("LIGHT_ATTACHMENTS", () => {
  const SPRITES: readonly string[] = manifest.sprites.map(({ key }) => key);
  const ATTACHED_KEYS = [...LIGHT_ATTACHMENTS.keys()];

  it.each(ATTACHED_KEYS)("attaches lights to %s, a sprite the art has", (key) => {
    expect(SPRITES).toContain(key);
  });

  // The frames of a sprite's idle tag, by its Aseprite JSON.
  const idleFrames = (key: string): number => {
    const sheet = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8")) as {
      meta: { frameTags: { from: number; name: string; to: number }[] };
    };
    const tag = sheet.meta.frameTags.find(({ name }) => name === IDLE_TAG);
    return tag === undefined ? 1 : tag.to - tag.from + 1;
  };
  const pulsed = ATTACHED_KEYS.flatMap((key) =>
    (LIGHT_ATTACHMENTS.get(key) ?? [])
      .filter(({ pulse }) => pulse !== null && idleFrames(key) > 1)
      .map(({ light, pulse }) => ({ key, light, pulses: pulse?.length ?? 0 })),
  );
  it.each(pulsed.length > 0 ? pulsed : [null])(
    "pulses %o a strength for each frame of its sprite's idle tag",
    (attached) => {
      if (attached !== null) {
        expect(attached.pulses).toBe(idleFrames(attached.key));
      }
    },
  );

  // A cone shines from its sprite's bulb: wherever the sprite is drawn, from any of its depth
  // steps and on either side of the road, the cone's apex lies on a lit pixel, one with a
  // channel at LIT or brighter.
  const LIT = 232;
  const ANCHORS = new Map(
    manifest.sprites.flatMap(({ anchor, key }) =>
      anchor === undefined ? [] : [[key, anchor.feetY] as const],
    ),
  );
  const cones = ATTACHED_KEYS.flatMap((key) =>
    (LIGHT_ATTACHMENTS.get(key) ?? [])
      .filter(({ light }) => LIGHTS.get(light)?.shape === "cone")
      .flatMap((attachment) =>
        depthSteps.steps
          .filter(({ suffix }) => ANCHORS.has(`${key}${suffix}`))
          .flatMap(({ scale, suffix }) =>
            [false, true].map((flipX) => ({
              attachment,
              flipX,
              scale,
              step: `${key}${suffix}`,
              zone: attachment.zones?.[0] ?? itemAt(WORLD.zones, 0).id,
            })),
          ),
      ),
  );
  it.each(cones.length > 0 ? cones : [null])(
    "shines $attachment.light from a lit bulb of $step, mirrored $flipX",
    (cone) => {
      if (cone === null) {
        return;
      }
      const { data, width } = decodePng(readFileSync(`public/art/sprites/${cone.step}.png`));
      const feetY = ANCHORS.get(cone.step) ?? 0;
      const key = cone.step.replace(/@\d+$/, "");
      const anchor = {
        flipX: cone.flipX,
        frame: 0,
        key,
        scale: cone.scale,
        x: width / 2,
        y: feetY,
      };
      const out = newAttachedLightPlaces();
      const places = out.slice(0, placeAttachedLights(cone.zone, [anchor], out));
      const apex = places.find(({ key: light }) => light === cone.attachment.light);
      expect(apex).toBeDefined();
      const i = (Math.floor(apex?.y ?? 0) * width + Math.floor(apex?.x ?? 0)) * 4;
      const [r = 0, g = 0, b = 0, a = 0] = data.subarray(i, i + 4);
      expect(a).toBeGreaterThan(0);
      expect(Math.max(r, g, b)).toBeGreaterThanOrEqual(LIT);
    },
  );
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
