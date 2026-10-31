import { decodePng } from "@andornaut/game-kit/art/png";
import { blankImage, type RgbaImage } from "@andornaut/game-kit/art/rgbaImage";
import { describe, expect, it } from "vitest";

import { encodePng } from "./atlasBuild";
import { COLOUR_TYPE_INDEXED, MAX_PALETTE } from "./indexedPng";

const COLOUR_TYPE_RGBA = 6;

// A width x 3 image whose pixel i is rgba(i).
function imageOf(width: number, rgba: (i: number) => readonly number[]): RgbaImage {
  const image = blankImage(width, 3);
  for (let i = 0; i < width * 3; i++) {
    image.data.set(rgba(i), i * 4);
  }
  return image;
}

describe("encodePng", () => {
  it("indexes opaque, on-and-off and partial alpha, and falls back to RGBA past the palette", () => {
    const cases: { colourType: number; image: RgbaImage; name: string }[] = [
      {
        colourType: COLOUR_TYPE_INDEXED,
        image: imageOf(5, (i) => [i * 40, 255 - i, 7, 255]),
        name: "indexes opaque colours with no tRNS",
      },
      {
        colourType: COLOUR_TYPE_INDEXED,
        image: imageOf(5, (i) => (i % 3 === 0 ? [i, 0, 0, 0] : [0, 90, i % 2, 255])),
        name: "indexes on and off alpha, keeping each clear pixel's colour",
      },
      {
        colourType: COLOUR_TYPE_INDEXED,
        image: imageOf(5, (i) => [10, 20, 30, i * 17]),
        name: "indexes partial alpha",
      },
      {
        colourType: COLOUR_TYPE_RGBA,
        image: imageOf(Math.ceil((MAX_PALETTE + 1) / 3), (i) => [i & 0xff, i >> 8, 0, 255]),
        name: "falls back to RGBA past the palette's size",
      },
    ];
    for (const { colourType, image, name } of cases) {
      const png = encodePng(image);
      const decoded = decodePng(png);
      expect(png[25], name).toBe(colourType);
      expect([decoded.width, decoded.height]).toEqual([image.width, image.height]);
      expect(Buffer.compare(decoded.data, image.data)).toBe(0);
    }
  });
});
