import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import { walkerFootY } from "../runner/walkGeometry";
import { roadProjection, rowScale } from "./projection";
import {
  drawRoad,
  FADE_ROWS,
  fadeCovers,
  type PixelImage,
  pixelWord,
  type RoadFrame,
  type RoadLook,
  roadRaster,
  shrinkRows,
  solidStrip,
  STRIP,
  stripLevels,
} from "./roadRaster";
import { crossesLine, leafAt } from "./roadside";
import { screenLayout } from "./screenLayout";

const { road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
const raster = roadRaster(projection, road);

const look = (zone: ZoneId, rgb: number): RoadLook => ({
  strip: stripLevels(solidStrip(rgb)),
  zone,
});
const frameOf = (overrides: Partial<RoadFrame>): RoadFrame => ({
  current: look("street", 0x3a4466),
  fade: null,
  scroll: 0,
  transition: null,
  zoneStart: 0,
  ...overrides,
});
const draw = (frame: RoadFrame, view = raster) => {
  const out = new Uint32Array(view.view.width * view.view.height);
  drawRoad(view, frame, out);
  return out;
};
const pixelAt = (out: Uint32Array, x: number, y: number) =>
  out[(y - road.y) * road.width + (x - road.x)];

describe("the verge beside the road", () => {
  // Band row 149 is screen row 189: drawn at scroll 0, it is the backdrop's bottom row.
  const bandRow = roadRaster(projection, { ...road, height: 1, y: 189 });
  const runs = (zone: ZoneId): [number, number, number][] => {
    const out = draw(frameOf({ current: look(zone, 0x123456) }), bandRow);
    const result: [number, number, number][] = [];
    out.forEach((pixel, i) => {
      const last = result.at(-1);
      if (last !== undefined && last[2] === pixel) {
        last[1] = road.x + i;
      } else {
        result.push([road.x + i, road.x + i, pixel]);
      }
    });
    return result;
  };
  const strip = pixelWord(0x123456);
  const lawn = pixelWord(0x3e8948);
  const walk = pixelWord(0xc0cbdc);
  const curb = pixelWord(0x8b9bb4);

  it("continues Woof Way's and The Long Way Home's lawn, sidewalk and curb", () => {
    for (const zone of ["street", "homeStretch"] as const) {
      const expected = [
        [80, 124, lawn],
        [125, 147, walk],
        [148, 149, curb],
        [150, 289, strip],
        [290, 291, curb],
        [292, 314, walk],
        [315, 359, lawn],
      ];
      // Fallen leaves may sit on The Long Way Home's lawn, so compare the street's verge only.
      expect(runs(zone).filter(([, , pixel]) => pixel !== lawn || zone === "street")).toEqual(
        expected.filter(([, , pixel]) => pixel !== lawn || zone === "street"),
      );
    }
  });

  it("runs Bark Park's grass up to the path", () => {
    expect(runs("park")).toEqual([
      [80, 149, lawn],
      [150, 289, strip],
      [290, 359, lawn],
    ]);
  });

  it("paves Sniff Street Shops up to a curb", () => {
    expect(runs("shops")).toEqual([
      [80, 147, walk],
      [148, 149, curb],
      [150, 289, strip],
      [290, 291, curb],
      [292, 359, walk],
    ]);
  });

  it("draws each seam across the sidewalk on one far row, however the road has scrolled", () => {
    const far = raster.rows.filter((row) => row.span >= 1);
    for (const scroll of [0, 7, 31.5]) {
      const lines = far
        .filter((row) => crossesLine(32, scroll + row.distance, row.span))
        .map((row) => Math.floor((scroll + row.distance) / 32));
      const first = lines.at(-1) ?? 0;
      expect([...lines].reverse()).toEqual(Array.from(lines, (_, i) => first + i));
    }
  });

  it("scatters leaves on The Long Way Home only", () => {
    const leaves = (zone: ZoneId) =>
      Array.from({ length: 400 }, (_, i) => leafAt(zone, i, i * 3, 1)).filter((c) => c !== null);
    expect(leaves("homeStretch").length).toBeGreaterThan(0);
    expect(leaves("street")).toEqual([]);
  });
});

describe("drawRoad", () => {
  // A strip whose every pixel names its own column and row.
  const labelled: PixelImage = {
    ...STRIP,
    pixels: Uint32Array.from({ length: STRIP.width * STRIP.height }, (_, i) => i + 1),
  };

  it("samples each road pixel from the strip column under its centre", () => {
    const out = draw(frameOf({ current: { strip: [labelled, labelled, labelled], zone: "park" } }));
    for (const [x, y] of [
      [200, 639],
      [151, 190],
      [300, 400],
    ] as const) {
      const label = pixelAt(out, x, y) ?? 0;
      expect((label - 1) % STRIP.width).toBe(
        Math.floor(140 + (x + 0.5 - 220) / rowScale(projection, y)),
      );
    }
    expect(itemAt(raster.rows, raster.rows.length - 1).level).toBe(0);
  });

  it("moves the road toward the pack as the walk scrolls", () => {
    const strips = { strip: stripLevels(labelled), zone: "park" as const };
    const row = (scroll: number) =>
      Math.floor(((pixelAt(draw(frameOf({ current: strips, scroll })), 220, 600) ?? 1) - 1) / 280);
    expect((row(0) - row(10) + STRIP.height) % STRIP.height).toBe(10);
  });

  it("samples the shrunk strips on the far rows, where a row covers more than 2 strip rows", () => {
    const far = itemAt(raster.rows, 0);
    expect(far.span).toBeGreaterThan(2);
    expect(far.level).toBe(1);
    expect(raster.rows.filter((row) => row.level === 2)).toEqual([]);
  });

  it("rolls the start strip in at the far edge over the previous zone's road", () => {
    const previous = look("street", 0x111111);
    const start = look("park", 0x222222);
    const current = look("park", 0x333333);
    const at = (zoneDistance: number, y: number) =>
      pixelAt(
        draw(
          frameOf({
            current,
            scroll: 5000 + zoneDistance,
            transition: { previous, start },
            zoneStart: 5000,
          }),
        ),
        220,
        y,
      );
    expect(at(0, 190)).toBe(pixelWord(0x111111));
    expect(at(30, 190)).toBe(pixelWord(0x222222));
    expect(at(30, 639)).toBe(pixelWord(0x111111));
    expect(at(200, 190)).toBe(pixelWord(0x333333));
    expect(at(800, 639)).toBe(pixelWord(0x333333));
  });

  it("dithers the far rows into the band only when the fade is on", () => {
    const band = new Uint32Array(road.width).fill(pixelWord(0xffffff));
    const white = pixelWord(0xffffff);
    const count = (out: Uint32Array, y: number) =>
      out
        .subarray((y - road.y) * road.width, (y - road.y + 1) * road.width)
        .filter((p) => p === white).length;
    const faded = draw(frameOf({ fade: band }));
    expect(count(faded, 190)).toBeGreaterThan(count(faded, 190 + FADE_ROWS - 1));
    expect(count(faded, 190 + FADE_ROWS)).toBe(0);
    expect(count(draw(frameOf({})), 190)).toBe(0);
  });
});

describe("fadeCovers", () => {
  it("covers most of the farthest row and little of the last faded row", () => {
    const covered = (row: number) =>
      Array.from({ length: 16 }, (_, x) => fadeCovers(x, row)).filter(Boolean).length;
    expect(covered(0)).toBeGreaterThan(12);
    expect(covered(FADE_ROWS - 1)).toBeLessThan(4);
  });
});

describe("shrinkRows", () => {
  const image = (rows: number[][]): PixelImage => ({
    height: rows.length,
    pixels: Uint32Array.from(rows.flat()),
    width: rows[0]?.length ?? 0,
  });

  it("keeps the colour most of the merged rows have", () => {
    const shrunk = shrinkRows(4, image([[1], [2], [2], [3]]));
    expect([...shrunk.pixels]).toEqual([2]);
  });

  it("breaks a tie toward the image's commonest colour, so a far speckle does not blink", () => {
    const shrunk = shrinkRows(
      2,
      image([
        [9, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ]),
    );
    expect(shrunk.height).toBe(2);
    expect([...shrunk.pixels]).toEqual([1, 1, 1, 1]);
  });

  it("uses only colours the image has", () => {
    const source = image([[5], [6], [7], [8]]);
    const shrunk = shrinkRows(2, source);
    expect([...shrunk.pixels].every((pixel) => source.pixels.includes(pixel))).toBe(true);
  });
});
