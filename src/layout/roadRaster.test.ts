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
import { crossesLine, darkerGreen, isLawn, mownAt, vergeBase, VERGES } from "./roadside";
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
  // Band row 149 is screen row 189: the backdrop's bottom row, which the verge continues.
  const bandRow = itemAt(roadRaster(projection, { ...road, height: 1, y: 189 }).rows, 0);
  const [GREEN, DARK_GREEN, FOREST] = [0x63c74d, 0x3e8948, 0x265c42];
  const [GREY, LIGHT_GREY] = [0x8b9bb4, 0xc0cbdc];
  const STRIP_MARK = -1;
  const runsOf = (colors: number[]) => {
    const result: [number, number, number][] = [];
    colors.forEach((color, i) => {
      const last = result.at(-1);
      if (last !== undefined && last[2] === color) {
        last[1] = road.x + i;
      } else {
        result.push([road.x + i, road.x + i, color]);
      }
    });
    return result;
  };
  const baseRuns = (zone: ZoneId) =>
    runsOf(
      Array.from(bandRow.across, (across) =>
        across < 0 ? STRIP_MARK : vergeBase(VERGES[zone], across, bandRow.scale),
      ),
    );

  // The runs of each backdrop's row 149 beside the road, without its tufts.
  it("continues Woof Way's and The Long Way Home's mown lawn, sidewalk and curb", () => {
    for (const zone of ["street", "homeStretch"] as const) {
      expect(baseRuns(zone)).toEqual([
        [80, 102, DARK_GREEN],
        [103, 124, GREEN],
        [125, 147, LIGHT_GREY],
        [148, 149, GREY],
        [150, 289, STRIP_MARK],
        [290, 291, GREY],
        [292, 314, LIGHT_GREY],
        [315, 336, GREEN],
        [337, 359, DARK_GREEN],
      ]);
    }
  });

  it("runs Bark Park's unmown grass up to the path", () => {
    expect(baseRuns("park")).toEqual([
      [80, 149, GREEN],
      [150, 289, STRIP_MARK],
      [290, 359, GREEN],
    ]);
  });

  it("paves Sniff Street Shops up to a curb", () => {
    expect(baseRuns("shops")).toEqual([
      [80, 147, LIGHT_GREY],
      [148, 149, GREY],
      [150, 289, STRIP_MARK],
      [290, 291, GREY],
      [292, 359, LIGHT_GREY],
    ]);
  });

  it("ends a dark mown stripe where it would draw under 4px wide", () => {
    // The second stripe, 62 wide, from 232 across.
    expect(mownAt(250, 0.5)).toBe(true);
    expect(mownAt(250, 0.06)).toBe(false);
    expect(mownAt(200, 1)).toBe(false);
  });

  it("darkens the lawn only with tufts, and only the lawn", () => {
    const out = draw(frameOf({ current: look("street", 0x123456), scroll: 300 }));
    const words = new Map(
      [GREEN, DARK_GREEN, FOREST, GREY, LIGHT_GREY].map((rgb) => [pixelWord(rgb), rgb]),
    );
    let tufts = 0;
    raster.rows.forEach((row, y) => {
      row.across.forEach((across, i) => {
        if (across < 0) {
          return;
        }
        const color = words.get(out[y * road.width + i] ?? 0);
        const base = vergeBase(VERGES.street, across, row.scale);
        if (color !== base) {
          tufts += 1;
          expect(isLawn(VERGES.street, across) || color === GREY).toBe(true);
          expect([darkerGreen(base), GREY]).toContain(color);
        }
      });
    });
    expect(tufts).toBeGreaterThan(20);
  });

  it("thins tufts with distance", () => {
    const tuftShare = (from: number, to: number) => {
      let lawn = 0;
      let marked = 0;
      for (const scroll of [0, 150, 300]) {
        const out = draw(frameOf({ current: look("street", 0x123456), scroll }));
        raster.rows.slice(from, to).forEach((row, j) => {
          row.across.forEach((across, i) => {
            if (isLawn(VERGES.street, across)) {
              lawn += 1;
              const color = out[(from + j) * road.width + i];
              marked +=
                color === pixelWord(darkerGreen(vergeBase(VERGES.street, across, row.scale)))
                  ? 1
                  : 0;
            }
          });
        });
      }
      return marked / Math.max(1, lawn);
    };
    expect(tuftShare(0, 40)).toBeLessThan(tuftShare(200, 300));
  });

  it("lays rough patches on Bark Park's lawn and no stripes", () => {
    const darkened = [0, 400, 800, 1200].some((scroll) =>
      draw(frameOf({ current: look("park", 0x123456), scroll })).includes(pixelWord(DARK_GREEN)),
    );
    expect(darkened).toBe(true);
  });

  it("scatters leaves on The Long Way Home only", () => {
    const tones = [0xd77643, 0xbe4a2f, 0x733e39].map(pixelWord);
    const leaves = (zone: ZoneId) =>
      [0, 100, 200].some((scroll) =>
        draw(frameOf({ current: look(zone, 0x123456), scroll })).some((p) => tones.includes(p)),
      );
    expect(leaves("homeStretch")).toBe(true);
    expect(leaves("street")).toBe(false);
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
