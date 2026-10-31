import { readFile } from "node:fs/promises";

import { decodePng } from "@andornaut/game-kit/art/png";
import type { RgbaImage } from "@andornaut/game-kit/art/rgbaImage";
import { webpDecodesTo } from "@andornaut/game-kit/art/webp";
import { beforeAll, describe, expect, it } from "vitest";

import shippedManifest from "../../../public/art/manifest.json";
import { BASE_FRAME, parseAtlasManifest } from "../../assets/atlasManifest";
import { remapToGrey } from "../../assets/greyRamp";
import { parseManifest } from "../../assets/manifest";
import { sheetFromRows } from "../../testing/sheetImage";
import { disabledArtKey, greysOnTile } from "../../ui/disabledArt";
import { NEUTRAL_RAMP } from "../../ui/palette";
import { GREYED } from "../../ui/selection";
import {
  type AtlasBuild,
  buildAtlases,
  compactFrames,
  encodePng,
  trimsFrames,
  WEBP_PAGES,
} from "./atlasBuild";
import { ATLAS_MAX_SIZE } from "./atlasLayout";

const ART_DIR = new URL("../../../public/art/", import.meta.url);
const readArt = async (path: string) => new Uint8Array(await readFile(new URL(path, ART_DIR)));

const manifest = parseManifest(shippedManifest);

interface Sheet {
  frames: Record<
    string,
    { duration: number; frame: { h: number; w: number; x: number; y: number } }
  >;
  meta: { frameTags?: unknown[] };
}

// Whether every pixel of the width x height rect at (x, y) in image is clear, except those in
// the rect keep.
function clearOutside(
  image: RgbaImage,
  { h, w, x, y }: { h: number; w: number; x: number; y: number },
  keep: { h: number; w: number; x: number; y: number },
): boolean {
  for (let row = y; row < y + h; row++) {
    for (let column = x; column < x + w; column++) {
      const kept =
        column >= keep.x && column < keep.x + keep.w && row >= keep.y && row < keep.y + keep.h;
      if (!kept && image.data[(row * image.width + column) * 4 + 3] !== 0) {
        return false;
      }
    }
  }
  return true;
}

// Whether the width x height rect at (ax, ay) in a holds the same bytes as the one at (bx, by)
// in b. Byte compares keep the check over every frame cheap; a deep equal of pixel arrays does not.
function sameRect(
  a: RgbaImage,
  ax: number,
  ay: number,
  b: RgbaImage,
  bx: number,
  by: number,
  width: number,
  height: number,
): boolean {
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) {
    const aStart = ((ay + row) * a.width + ax) * 4;
    const bStart = ((by + row) * b.width + bx) * 4;
    const aRow = a.data.subarray(aStart, aStart + rowBytes);
    const bRow = b.data.subarray(bStart, bStart + rowBytes);
    if (aRow.length !== rowBytes || Buffer.compare(aRow, bRow) !== 0) {
      return false;
    }
  }
  return true;
}

describe("the shipped art's atlases", () => {
  let build: AtlasBuild;
  let pages: RgbaImage[];
  // Each page's pixels as they went to the encoder, in page order.
  const drawn: RgbaImage[] = [];
  // Each key's source PNG, decoded, and each sprite's Aseprite sheet. A disabled tile's grey
  // copy has its key's sheet, and its PNG remapped as the game greyed it at runtime.
  const sources = new Map<string, RgbaImage>();
  const sheets = new Map<string, Sheet>();
  // Packing every page is the slow part, so it runs once, with room to spare on a loaded machine.
  beforeAll(async () => {
    build = await buildAtlases(readArt, {
      pages: {
        encode: (page) => {
          drawn.push(page);
          return encodePng(page);
        },
        extension: "png",
      },
    });
    pages = build.manifest.pages.map(({ file }) =>
      decodePng(build.files.get(file) ?? new Uint8Array()),
    );
    const decoder = new TextDecoder();
    await Promise.all([
      ...[...manifest.fonts, ...manifest.images, ...manifest.sprites].map(async ({ key, png }) => {
        sources.set(key, decodePng(await readArt(png)));
      }),
      ...manifest.sprites.map(async ({ json, key }) => {
        sheets.set(key, JSON.parse(decoder.decode(await readArt(json))) as Sheet);
      }),
    ]);
    for (const [key, source] of [...sources].filter(([key]) => greysOnTile(key))) {
      const pixels = new Uint8ClampedArray(source.data);
      remapToGrey(NEUTRAL_RAMP, GREYED.copyDarker, pixels);
      sources.set(disabledArtKey(key), { ...source, data: new Uint8Array(pixels.buffer) });
      const sheet = sheets.get(key);
      if (sheet !== undefined) {
        sheets.set(disabledArtKey(key), sheet);
      }
    }
  }, 60_000);

  it("packs every image, font and sprite with no warnings, on pages that fit a phone GPU", () => {
    expect(build.warnings).toEqual([]);
    expect(build.manifest.pages.length).toBeLessThanOrEqual(8);
    for (const { height, width } of build.manifest.pages) {
      expect(Math.max(width, height)).toBeLessThanOrEqual(ATLAS_MAX_SIZE);
    }
  });

  // A build ships the pages as WebPs, so each must decode to exactly the pixels its PNG holds.
  it("encodes every page as a lossless WebP that decodes to its PNG's pixels", async () => {
    const differing = await Promise.all(
      drawn.map(async (page, index) => {
        const png = pages[index];
        const same = png !== undefined && (await webpDecodesTo(png, await WEBP_PAGES.encode(page)));
        return same ? [] : [build.manifest.pages[index]?.file ?? `page ${index}`];
      }),
    );
    expect(drawn.length).toBe(build.manifest.pages.length);
    expect(differing.flat()).toEqual([]);
  });

  it("writes a manifest the runtime parses", () => {
    const json: unknown = JSON.parse(JSON.stringify(build.manifest));
    expect(parseAtlasManifest(json)).toEqual(build.manifest);
  });

  it("maps every manifest key, and every frame of each sprite in export order", () => {
    const textures = new Map(build.manifest.textures.map((texture) => [texture.key, texture]));
    for (const { key } of [...manifest.fonts, ...manifest.images]) {
      expect(textures.get(key)?.frames.map(({ name }) => name)).toEqual([BASE_FRAME]);
    }
    for (const [key, { frames, meta }] of sheets) {
      const texture = textures.get(key);
      expect(texture?.frames.map(({ duration, name }) => [name, duration])).toEqual(
        Object.entries(frames).map(([name, { duration }]) => [name, duration]),
      );
      expect(texture?.tags).toEqual(meta.frameTags ?? []);
    }
    const keys = [...manifest.fonts, ...manifest.images, ...manifest.sprites].map(({ key }) => key);
    expect(textures.size).toBe(keys.length + keys.filter(greysOnTile).length);
  });

  // The game draws a disabled tile's picture from its grey copy, which the page beside its
  // art holds, with every frame of the art.
  it("packs a grey copy of each picture a disabled tile greys, on its art's page", () => {
    const textures = new Map(build.manifest.textures.map((texture) => [texture.key, texture]));
    const greyed = [...manifest.images, ...manifest.sprites].flatMap(({ key }) => {
      const texture = textures.get(key);
      return texture !== undefined && greysOnTile(key) ? [texture] : [];
    });
    expect(greyed.length).toBeGreaterThan(0);
    const misfits = greyed.filter(({ frames, key, page }) => {
      const copy = textures.get(disabledArtKey(key));
      return (
        copy?.page !== page ||
        copy.frames.map(({ name }) => name).join() !== frames.map(({ name }) => name).join()
      );
    });
    expect(misfits.map(({ key }) => key)).toEqual([]);
  });

  // A trimmed frame's rect holds its pixels at its trim offset, and the rest of the whole frame
  // is clear.
  it("copies each image and frame pixel for pixel", () => {
    const differing: string[] = [];
    for (const { frames, key, page } of build.manifest.textures) {
      const source = sources.get(key);
      const atlas = pages[page];
      for (const { h, name, trim, w, x, y } of frames) {
        const whole = sheets.get(key)?.frames[name]?.frame ?? { h, w, x: 0, y: 0 };
        const kept = { h, w, x: whole.x + (trim?.x ?? 0), y: whole.y + (trim?.y ?? 0) };
        const same =
          source !== undefined &&
          atlas !== undefined &&
          sameRect(atlas, x, y, source, kept.x, kept.y, w, h) &&
          clearOutside(source, whole, kept);
        if (!same) {
          differing.push(`${key} ${name}`);
        }
      }
    }
    expect(differing).toEqual([]);
  });

  it("trims only road sprites' frames, to their whole frame's size", () => {
    const misfits = build.manifest.textures.flatMap(({ frames, key }) =>
      frames
        .filter(({ name, trim }) => {
          const whole = sheets.get(key)?.frames[name]?.frame;
          return (
            trim !== undefined && (!trimsFrames(key) || trim.w !== whole?.w || trim.h !== whole.h)
          );
        })
        .map(({ name }) => `${key} ${name}`),
    );
    expect(misfits).toEqual([]);
  });
});

describe("compactFrames", () => {
  // 6x5 frames: two pixels in the middle, the same two a column to the right, the same two at
  // the right edge, where the extruded border repeats them, and a clear frame.
  const middle = ["......", "..ab..", "..cd..", "......", "......"];
  const shifted = ["......", "...ab.", "...cd.", "......", "......"];
  const edge = ["......", "....ab", "....cd", "......", "......"];
  const clear = ["......", "......", "......", "......", "......"];
  type Rect4 = [x: number, y: number, width: number, height: number];
  const rect = ([x, y, width, height]: Rect4) => ({ height, width, x, y });
  const whole = (frame: number): Rect4 => [frame * 6, 0, 6, 5];

  // Each frame's packed from rect, the bounds its border is read in, and its trim as
  // [x, y, whole width, whole height].
  it("keeps, trims and shares frames, each with its own bounds and offset", () => {
    const cases: {
      expected: { bounds?: Rect4; from: Rect4; trim?: Rect4 }[];
      frames: string[][];
      name: string;
      trim: boolean;
    }[] = [
      {
        expected: [{ from: whole(0) }],
        frames: [middle],
        name: "keeps a frame whole without trim",
        trim: false,
      },
      {
        expected: [{ bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] }],
        frames: [middle],
        name: "trims a frame to its opaque pixels, recording where they sit",
        trim: true,
      },
      {
        expected: [{ bounds: whole(0), from: [0, 0, 1, 1], trim: [0, 0, 6, 5] }],
        frames: [clear],
        name: "trims a clear frame to its top-left pixel",
        trim: true,
      },
      {
        expected: [
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] },
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [3, 1, 6, 5] },
        ],
        frames: [middle, shifted],
        name: "shares one rect between trimmed frames with the same pixels, each at its own offset",
        trim: true,
      },
      {
        expected: [
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] },
          { bounds: whole(1), from: [10, 1, 2, 2], trim: [4, 1, 6, 5] },
        ],
        frames: [middle, edge],
        name: "keeps apart frames whose extruded borders differ",
        trim: true,
      },
      {
        expected: [{ from: whole(0) }, { from: whole(0) }],
        frames: [middle, middle],
        name: "shares one rect between whole frames with the same pixels",
        trim: false,
      },
    ];
    for (const { expected, frames, trim } of cases) {
      const { image, texture } = sheetFromRows("dog-kilo", frames);
      const compacted = compactFrames(image, trim, texture).frames.map(
        ({ bounds, from, trim: offset }) => ({ bounds, from, trim: offset }),
      );
      expect(compacted).toEqual(
        expected.map(({ bounds, from, trim: offset }) => ({
          bounds: bounds === undefined ? undefined : rect(bounds),
          from: rect(from),
          trim:
            offset === undefined
              ? undefined
              : { h: offset[3], w: offset[2], x: offset[0], y: offset[1] },
        })),
      );
    }
  });
});
