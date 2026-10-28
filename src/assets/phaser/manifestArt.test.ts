import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Scene, Textures } from "phaser";
import { describe, expect, it } from "vitest";

import { keysOf } from "../../lib/records";
import { sheetFromRows } from "../../testing/sheetImage";
import { compactFrames, drawPage } from "../atlas/atlasBuild";
import { layoutAtlases } from "../atlas/atlasLayout";
import type { RgbaImage } from "../atlas/atlasPixels";
import type { AssetManifest } from "../manifest";
import { addAtlasFrame, smoothDepthArt } from "./manifestArt";

// Phaser's frame and its image render nodes, which place a sprite's quad and pick its texels,
// loaded from its sources: the package's bundle needs a browser.
const require = createRequire(import.meta.url);
const phaserSource = <T>(path: string): T =>
  require(join(dirname(require.resolve("phaser/package.json")), "src", path)) as T;

interface Crop {
  ch: number;
  cw: number;
  cx: number;
  cy: number;
  height: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  width: number;
  x: number;
  y: number;
}
interface Texturer {
  run(context: object, gameObject: object): void;
  uvSource: { u0: number; u1: number; v0: number; v1: number };
}
interface Transformer {
  quad: Float32Array;
  run(context: object, gameObject: object, texturer: Texturer): void;
}
type FrameClass = new (
  texture: object,
  name: string,
  sourceIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
) => Textures.Frame;

const Frame = phaserSource<FrameClass>("textures/Frame.js");
const TexturerImage = phaserSource<new (manager: object) => Texturer>(
  "renderer/webgl/renderNodes/texturer/TexturerImage.js",
);
const TransformerImage = phaserSource<new (manager: object) => Transformer>(
  "renderer/webgl/renderNodes/transformer/TransformerImage.js",
);
const TransformMatrix = phaserSource<new () => object>("gameobjects/components/TransformMatrix.js");

// 12x10 frames: off centre so a flip moves them, and one touching the frame's right edge.
const FRAMES = {
  edge: [
    "............",
    "............",
    "..........ab",
    ".........cde",
    "..........f.",
    "...........g",
    "............",
    "............",
    "............",
    "............",
  ],
  offCentre: [
    "............",
    "............",
    "...ab.......",
    "...cde......",
    "....f.......",
    "....gh......",
    "....i.......",
    "............",
    "............",
    "............",
  ],
};

// The sprite's frame, as a build with trimming or without it packs it and the runtime adds
// it, and its atlas page.
function packedFrame(rows: readonly string[], trim: boolean) {
  const { image, texture } = sheetFromRows("dog-kilo", [rows]);
  const layout = layoutAtlases([compactFrames(image, trim, texture)]);
  const page = layout.pages[0];
  const atlased = layout.textures[0]?.frames[0];
  if (page === undefined || atlased === undefined) {
    throw new Error("The sprite was not packed");
  }
  const added: Textures.Frame[] = [];
  const atlasTexture = {
    add(name: string, sourceIndex: number, x: number, y: number, w: number, h: number) {
      added.push(new Frame(atlasTexture, name, sourceIndex, x, y, w, h));
      return added.at(-1);
    },
    source: [{ height: page.height, resolution: 1, width: page.width }],
  };
  addAtlasFrame(atlasTexture as unknown as Textures.Texture, atlased.name, atlased);
  const frame = added[0];
  if (frame === undefined) {
    throw new Error("No frame was added");
  }
  return { frame, page: drawPage(new Map([[texture.png, image]]), page) };
}

interface Draw {
  // Rows clipped off the top, as a road sprite above the juncture is.
  clipRows: number;
  flipX: boolean;
  flipY: boolean;
  origin: [number, number];
  scale: number;
}

// Where Phaser draws each opaque texel of the frame, as its centre on screen, with its colour.
function drawnTexels({ frame, page }: { frame: Textures.Frame; page: RgbaImage }, draw: Draw) {
  const { clipRows, flipX, flipY, origin, scale } = draw;
  const crop: Crop = {
    ch: 0,
    cw: 0,
    cx: 0,
    cy: 0,
    height: 0,
    u0: 0,
    u1: 0,
    v0: 0,
    v1: 0,
    width: 0,
    x: 0,
    y: 0,
  };
  const { realHeight, realWidth } = frame;
  if (clipRows > 0) {
    frame.setCropUVs(crop, 0, clipRows, realWidth, realHeight - clipRows, flipX, flipY);
  }
  const gameObject = {
    _crop: crop,
    displayOriginX: origin[0] * realWidth,
    displayOriginY: origin[1] * realHeight,
    flipX,
    flipY,
    frame,
    isCropped: clipRows > 0,
    rotation: 0,
    scaleX: scale,
    scaleY: scale,
    scrollFactorX: 1,
    scrollFactorY: 1,
    // Phaser's default, safeAuto, under a camera that rounds pixels as pixelArt sets.
    willRoundVertices: (_camera: unknown, onlyTranslate: boolean) => onlyTranslate,
    x: 100.4,
    y: 50.6,
  };
  const camera = { getViewMatrix: () => new TransformMatrix(), scrollX: 0, scrollY: 0 };
  const context = { camera, useCanvas: false };
  const texturer = new TexturerImage({});
  const transformer = new TransformerImage({});
  texturer.run(context, gameObject);
  transformer.run(context, gameObject, texturer);
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, , , x3 = 0, y3 = 0] = transformer.quad;
  const { u0, u1, v0, v1 } = texturer.uvSource;
  if ((x3 - x0) * (y1 - y0) - (y3 - y0) * (x1 - x0) === 0) {
    return [];
  }
  if (u0 === u1 || v0 === v1) {
    return ["one texel stretched over the quad"];
  }
  const texels: string[] = [];
  for (let py = 0; py < page.height; py++) {
    for (let px = 0; px < page.width; px++) {
      const across = ((px + 0.5) / page.width - u0) / (u1 - u0);
      const down = (1 - (py + 0.5) / page.height - v0) / (v1 - v0);
      const offset = (py * page.width + px) * 4;
      if (across < 0 || across > 1 || down < 0 || down > 1 || page.data[offset + 3] === 0) {
        continue;
      }
      const x = x0 + across * (x3 - x0) + down * (x1 - x0);
      const y = y0 + across * (y3 - y0) + down * (y1 - y0);
      texels.push(
        `${x.toFixed(4)},${y.toFixed(4)} ${page.data.subarray(offset, offset + 4).join(".")}`,
      );
    }
  }
  return texels.sort();
}

describe("a trimmed atlas frame", () => {
  // The game clips rows only off sprites it does not flip vertically: under flipY, Phaser
  // mirrors a crop about the packed rect rather than the whole frame.
  const origins: [number, number][] = [
    [0, 0],
    [0.5, 0.5],
    [0.5, 0.9],
    [0.5, 1],
    [1, 1],
    [0.3, 0.7],
  ];
  const flips: [boolean, boolean][] = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ];
  const draws = keysOf(FRAMES).flatMap((frame) =>
    origins.flatMap((origin) =>
      flips.flatMap(([flipX, flipY]) =>
        (flipY ? [0] : [0, 3, 9, 10]).flatMap((clipRows) =>
          [1, 0.75].map((scale) => ({ clipRows, flipX, flipY, frame, origin, scale })),
        ),
      ),
    ),
  );

  // Clipping 3 rows leaves some of either frame's pixels; 9 or 10 leave none.
  it("draws each frame as the whole frame does, at every origin, flip, clip and scale", () => {
    const packed = new Map(
      keysOf(FRAMES).map((frame) => [
        frame,
        { trimmed: packedFrame(FRAMES[frame], true), whole: packedFrame(FRAMES[frame], false) },
      ]),
    );
    for (const { trimmed, whole } of packed.values()) {
      expect(trimmed.frame.cutWidth).toBeLessThan(whole.frame.cutWidth);
    }
    const offenders = draws.flatMap(({ frame, ...draw }) => {
      const entry = packed.get(frame);
      if (entry === undefined) {
        return [frame];
      }
      const { trimmed, whole } = entry;
      const texels = drawnTexels(whole, draw);
      const same = JSON.stringify(drawnTexels(trimmed, draw)) === JSON.stringify(texels);
      return texels.length > 0 === draw.clipRows <= 3 && same
        ? []
        : [`${frame} ${JSON.stringify(draw)}`];
    });
    expect(offenders).toEqual([]);
  });
});

describe("smoothDepthArt", () => {
  // Phaser's FilterMode: LINEAR is 0, and pixelArt starts every texture NEAREST, 1.
  const [LINEAR, NEAREST] = [0, 1];
  const sprite = (key: string) => ({ json: `sprites/${key}.json`, key, png: `sprites/${key}.png` });
  const manifest: AssetManifest = {
    fonts: [],
    images: [{ key: "screen-home", png: "images/screen-home.png" }],
    sounds: [],
    sprites: ["cone", "cone@94", "cone@50", "dog-kilo", "dog-kilo@50", "fx-tap", "ui-heart"].map(
      sprite,
    ),
  };

  // A build's pages: road holds cone, its steps and dog-kilo@50, and other the rest, except
  // ui-heart, loaded from its own files.
  function loadedScene() {
    const road = { scaleMode: NEAREST };
    const other = { scaleMode: NEAREST };
    const sources: Record<string, { scaleMode: number }> = {
      cone: road,
      "cone@50": road,
      "cone@94": road,
      "dog-kilo": other,
      "dog-kilo@50": road,
      "fx-tap": other,
      "screen-home": other,
      "ui-heart": { scaleMode: NEAREST },
    };
    let uploads = 0;
    const textures = new Map(
      Object.entries(sources).map(([key, source]) => [
        key,
        {
          setFilter(mode: number) {
            uploads += 1;
            source.scaleMode = mode;
          },
          source: [source],
        },
      ]),
    );
    const scene = {
      textures: {
        exists: (key: string) => textures.has(key),
        get: (key: string) => textures.get(key),
      },
    } as unknown as Scene;
    return { scene, sources, uploads: () => uploads };
  }

  it.each([
    ["cone", LINEAR],
    ["cone@94", LINEAR],
    ["cone@50", LINEAR],
    ["dog-kilo@50", LINEAR],
    ["dog-kilo", NEAREST],
    ["fx-tap", NEAREST],
    ["screen-home", NEAREST],
    ["ui-heart", NEAREST],
  ])("leaves %s with filter mode %i", (key, mode) => {
    const { scene, sources } = loadedScene();
    smoothDepthArt(scene, manifest);
    expect(sources[key]?.scaleMode).toBe(mode);
  });

  it("filters a shared page once, however many of its keys load", () => {
    const { scene, uploads } = loadedScene();
    smoothDepthArt(scene, manifest);
    smoothDepthArt(scene, manifest);
    expect(uploads()).toBe(1);
  });
});
