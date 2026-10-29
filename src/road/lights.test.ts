import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import depthSteps from "../../shared/depth-steps.json";
import lightTable from "../../shared/lights.json";
import { paletteColour } from "../assets/housePalette";
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
    const zone = "yongeStreet";
    const read = (attach: Record<string, unknown>) =>
      lightsFrom(tableOf(DEF, attach)).attach.get("some-sprite");
    expect(read(ATTACHED)).toEqual([
      {
        angle: 90,
        facesRoad: false,
        light: "glow",
        offsets: [{ dx: 2, dy: -3 }],
        pulse: null,
        zones: null,
      },
    ]);
    const frames = [{ dx: 0.5, dy: -10.5 }, null];
    expect(
      read({ angle: 0, facesRoad: true, frames, light: "beam", pulse: [1, 0.5], zones: [zone] }),
    ).toEqual([
      { angle: 0, facesRoad: true, light: "beam", offsets: frames, pulse: [1, 0.5], zones: [zone] },
    ]);
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
    ["a quarter px", { ...ATTACHED, dx: 0.25 }],
    ["an offset and frames both", { ...ATTACHED, frames: [{ dx: 0, dy: 0 }] }],
    ["neither an offset nor frames", { light: "glow" }],
    ["dx with no dy", { dx: 2, light: "glow" }],
    ["no frames listed", { frames: [], light: "glow" }],
    ["a frame with a field it does not know", { frames: [{ dx: 0, dy: 0, dz: 1 }], light: "glow" }],
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

  it("attaches lights only to sprites the art has", () => {
    expect(ATTACHED_KEYS.filter((key) => !SPRITES.includes(key))).toEqual([]);
  });

  // A sprite's Aseprite JSON: its frames in sheet order, as a hash or an array.
  interface SheetFrame {
    readonly frame: {
      readonly h: number;
      readonly w: number;
      readonly x: number;
      readonly y: number;
    };
    readonly sourceSize: { readonly h: number; readonly w: number };
    readonly spriteSourceSize: { readonly x: number; readonly y: number };
  }
  const framesOf = (key: string): readonly SheetFrame[] => {
    const sheet = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8")) as {
      frames: SheetFrame[] | Record<string, SheetFrame>;
    };
    return Array.isArray(sheet.frames) ? sheet.frames : Object.values(sheet.frames);
  };

  // A list by frame, a pulse or the offsets of a light that moves, has one entry for each frame
  // of its sprite's sheet, once the sheet has more than one.
  const byFrame = ATTACHED_KEYS.flatMap((key) =>
    framesOf(key).length < 2
      ? []
      : (LIGHT_ATTACHMENTS.get(key) ?? []).flatMap(({ light, offsets, pulse }) => [
          ...(pulse === null ? [] : [{ key, length: pulse.length, light, list: "pulse" }]),
          ...(offsets.length === 1 ? [] : [{ key, length: offsets.length, light, list: "frames" }]),
        ]),
  );
  it.each(byFrame.length > 0 ? byFrame : [null])(
    "lists $key's $light $list for each frame of its sheet",
    (listed) => {
      if (listed !== null) {
        expect(listed.length).toBe(framesOf(listed.key).length);
      }
    },
  );

  // A cone shines from its sprite's lamp: on every frame it shows on, from each of its sprite's
  // depth steps and on either side of the road, its apex lies on the lamp's core or the pixel
  // beside it, a depth step's lamp sitting up to a pixel from where scaling puts it. A core
  // pixel is lit, with a channel at LIT or brighter; a white one is a lamp only where its run of
  // white has a cream ring, at least RING_CREAM cream pixels touching it, as a rider's chest
  // band, helmet or reflector has not.
  const LIT = 232;
  const WHITE = "255,255,255";
  const CREAM = "234,212,170";
  const RING_CREAM = 2;
  const ANCHORS = new Map(
    manifest.sprites.flatMap(({ anchor, key }) =>
      anchor === undefined ? [] : [[key, anchor.feetY] as const],
    ),
  );
  // Each cone attachment, with every frame it shows on, from each depth step and on either side.
  const cones = ATTACHED_KEYS.flatMap((key) =>
    (LIGHT_ATTACHMENTS.get(key) ?? [])
      .filter(({ light }) => LIGHTS.get(light)?.shape === "cone")
      .map((attachment) => ({
        attachment,
        key,
        light: attachment.light,
        views: depthSteps.steps
          .filter(({ suffix }) => ANCHORS.has(`${key}${suffix}`))
          .flatMap(({ scale, suffix }) =>
            framesOf(`${key}${suffix}`).flatMap((_, frame) =>
              attachment.offsets[frame % attachment.offsets.length] === null
                ? []
                : [false, true].map((leftOfRoad) => ({
                    frame,
                    leftOfRoad,
                    scale,
                    step: `${key}${suffix}`,
                  })),
            ),
          ),
        zone: attachment.zones?.[0] ?? itemAt(WORLD.zones, 0).id,
      })),
  );

  // A frame's pixels as RGB keys, null where clear or off its rect on the sheet, which may be
  // trimmed.
  const colourAt =
    (data: Uint8Array, width: number, { frame }: SheetFrame) =>
    (x: number, y: number): string | null => {
      if (x < 0 || x >= frame.w || y < 0 || y >= frame.h) {
        return null;
      }
      const i = ((frame.y + y) * width + frame.x + x) * 4;
      return data[i + 3] === 0 ? null : [...data.subarray(i, i + 3)].join();
    };
  const isLampCore = (colour: (x: number, y: number) => string | null, x: number, y: number) => {
    const core = colour(x, y);
    if (core === null || Math.max(...core.split(",").map(Number)) < LIT) {
      return false;
    }
    if (core !== WHITE) {
      return true;
    }
    const run = new Set([`${x},${y}`]);
    const queue: (readonly [number, number])[] = [[x, y]];
    const ring = new Set<string>();
    while (queue.length > 0) {
      const [cx, cy] = queue.pop() ?? [0, 0];
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          const cell = `${cx + dx},${cy + dy}`;
          const here = colour(cx + dx, cy + dy);
          if (here === CREAM) {
            ring.add(cell);
          } else if (here === WHITE && dx * dy === 0 && !run.has(cell)) {
            run.add(cell);
            queue.push([cx + dx, cy + dy]);
          }
        }
      }
    }
    return ring.size >= RING_CREAM;
  };

  // One test per attachment, so a failure lists every view whose apex misses the lamp.
  it.each(cones.length > 0 ? cones : [null])(
    "shines $light from the lamp of $key on every frame, depth step and side",
    (cone) => {
      if (cone === null) {
        return;
      }
      const { attachment } = cone;
      // A lamp dims with its light's pulse and stays where it is, so it is looked for on the
      // frame its light shows brightest.
      const pulse = attachment.pulse ?? [1];
      const strength = (frame: number) => pulse[frame % pulse.length] ?? 1;
      const misses = cone.views.flatMap((view) => {
        // The frame, anchored as drawn: centred across its full frame, its feet on the
        // manifest's row.
        const { data, width } = decodePng(readFileSync(`public/art/sprites/${view.step}.png`));
        const frames = framesOf(view.step);
        const sheetFrame = itemAt(frames, view.frame);
        const anchor = {
          flipX: false,
          frame: view.frame,
          key: cone.key,
          leftOfRoad: view.leftOfRoad,
          scale: view.scale,
          x: sheetFrame.sourceSize.w / 2,
          y: ANCHORS.get(view.step) ?? 0,
        };
        const out = newAttachedLightPlaces();
        const places = out.slice(0, placeAttachedLights(cone.zone, [anchor], out));
        const apex = places.find(({ key: light }) => light === cone.light);
        const brightest = frames.reduce(
          (best, _, frame) => (strength(frame) > strength(best) ? frame : best),
          view.frame,
        );
        const lampFrame = itemAt(frames, brightest);
        const colour = colourAt(data, width, lampFrame);
        const x = Math.floor(apex?.x ?? 0) - lampFrame.spriteSourceSize.x;
        const y = Math.floor(apex?.y ?? 0) - lampFrame.spriteSourceSize.y;
        const near = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [x + dx, y + dy] as const));
        return apex !== undefined && near.some(([nx, ny]) => isLampCore(colour, nx, ny))
          ? []
          : [`${view.step} frame ${view.frame} ${view.leftOfRoad ? "left" : "right"} of the road`];
      });
      expect(cone.views.length).toBeGreaterThan(0);
      expect(misses).toEqual([]);
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
