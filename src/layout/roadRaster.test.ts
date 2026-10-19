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
  START_STRIP_ZONE_ROWS,
  STRIP,
  stripLevels,
} from "./roadRaster";
import {
  crossesLine,
  darkerGreen,
  dotColor,
  dottedBands,
  isLawn,
  mownAt,
  seamRow,
  vergeBase,
  VERGES,
  walkFrom,
} from "./roadside";
import { screenLayout } from "./screenLayout";

const { approach, rasterView: view, road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
const raster = roadRaster(projection, view);

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
  out[(y - view.y) * view.width + (x - view.x)];

describe("the verge beside the road", () => {
  // Band row 109 is screen row 149: the backdrop's bottom row, which the verge continues.
  const bandRow = itemAt(roadRaster(projection, { ...view, height: 1, y: 149 }).rows, 0);
  const [GREEN, DARK_GREEN, FOREST] = [0x63c74d, 0x3e8948, 0x265c42];
  const [GREY, LIGHT_GREY] = [0x8b9bb4, 0xc0cbdc];
  const [BROWN, CREAM, TAN, WHITE] = [0xb86f50, 0xead4aa, 0xe4a672, 0xffffff];
  const FLOWERS = [0xe43b44, 0xfee761, 0xffffff, 0xf77622];
  const STRIP_MARK = -1;
  const runsOf = (colors: number[]) => {
    const result: [number, number, number][] = [];
    colors.forEach((color, i) => {
      const last = result.at(-1);
      if (last !== undefined && last[2] === color) {
        last[1] = view.x + i;
      } else {
        result.push([view.x + i, view.x + i, color]);
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

  const MOWN_LAWN: [number, number, number][] = [
    [0, 14, DARK_GREEN],
    [15, 32, GREEN],
    [33, 63, DARK_GREEN],
    [64, 85, GREEN],
    [86, 107, LIGHT_GREY],
    [108, 109, GREY],
    [110, 249, STRIP_MARK],
    [250, 251, GREY],
    [252, 273, LIGHT_GREY],
    [274, 295, GREEN],
    [296, 326, DARK_GREEN],
    [327, 344, GREEN],
    [345, 359, DARK_GREEN],
  ];

  // The runs of each backdrop's row 109 beside the road, without its tufts.
  it.each<{ name: string; runs: [number, number, number][]; zone: ZoneId }>([
    { name: "street's mown lawn, sidewalk and curb", runs: MOWN_LAWN, zone: "street" },
    {
      name: "homeStretch's mown lawn, sidewalk and curb",
      runs: MOWN_LAWN,
      zone: "homeStretch",
    },
    {
      name: "park's unmown grass up to the path",
      runs: [
        [0, 109, GREEN],
        [110, 249, STRIP_MARK],
        [250, 359, GREEN],
      ],
      zone: "park",
    },
    {
      name: "shops' paving, edging, planter and white curb",
      runs: [
        [0, 98, CREAM],
        [99, 99, TAN],
        [100, 100, BROWN],
        [101, 106, GREEN],
        [107, 107, BROWN],
        [108, 109, WHITE],
        [110, 249, STRIP_MARK],
        [250, 251, WHITE],
        [252, 252, BROWN],
        [253, 258, GREEN],
        [259, 259, BROWN],
        [260, 260, TAN],
        [261, 359, CREAM],
      ],
      zone: "shops",
    },
  ])("continues $name", ({ runs, zone }) => {
    expect(baseRuns(zone)).toEqual(runs);
  });

  // The second stripe, 62 wide, from 232 across.
  it.each([
    [250, 0.5, true],
    [250, 0.06, false],
    [200, 1, false],
  ])(
    "mownAt(%d, %d) is %s: a dark stripe ends where it would draw under 4px wide",
    (across, scale, mown) => {
      expect(mownAt(across, scale)).toBe(mown);
    },
  );

  it("darkens the lawn only with tufts, and only the lawn", () => {
    const out = draw(frameOf({ current: look("street", 0x123456), scroll: 300 }));
    const words = new Map(
      [GREEN, DARK_GREEN, FOREST, GREY, LIGHT_GREY].map((rgb) => [pixelWord(rgb), rgb]),
    );
    let tufts = 0;
    raster.rows.forEach((row, y) => {
      row.across.forEach((across, i) => {
        if (across < 0 || y < raster.approachRows) {
          return;
        }
        const color = words.get(out[y * view.width + i] ?? 0);
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
              const color = out[(from + j) * view.width + i];
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
    const far = raster.approachRows;
    expect(tuftShare(far, far + 40)).toBeLessThan(tuftShare(200, 300));
  });

  it("lays rough patches on park's lawn and no stripes", () => {
    const darkened = [0, 400, 800, 1200].some((scroll) =>
      draw(frameOf({ current: look("park", 0x123456), scroll })).includes(pixelWord(DARK_GREEN)),
    );
    expect(darkened).toBe(true);
  });

  it("scatters leaves on homeStretch only", () => {
    const tones = [0xd77643, 0xbe4a2f, 0x733e39].map(pixelWord);
    const leaves = (zone: ZoneId) =>
      [0, 100, 200].some((scroll) =>
        draw(frameOf({ current: look(zone, 0x123456), scroll })).some((p) => tones.includes(p)),
      );
    expect(leaves("homeStretch")).toBe(true);
    expect(leaves("street")).toBe(false);
  });

  const PLANTER_DOTS = itemAt(VERGES.shops.strips, 1).dots;
  it.each<[number, number | null]>([
    [0, DARK_GREEN],
    [0.349, DARK_GREEN],
    [0.35, 0xe43b44],
    [0.38, 0xfee761],
    [0.41, 0xffffff],
    [0.449, 0xf77622],
    [0.45, null],
    [0.99, null],
  ])("dotColor picks %d's dot in the planter: %d", (value, color) => {
    expect(dotColor(PLANTER_DOTS, value)).toBe(color);
  });

  it.each<[ZoneId, number, [number, number][]]>([
    [
      "shops",
      162,
      [
        [146, 158],
        [162, Number.POSITIVE_INFINITY],
      ],
    ],
    ["street", 144, []],
  ])("lays %s's paving from %d across, with dots on its bands %j", (zone, from, bands) => {
    expect(walkFrom(VERGES[zone])).toBe(from);
    expect(dottedBands(VERGES[zone]).map((band) => [band.from, band.to])).toEqual(bands);
  });

  // The shops verge's dots over the rows below the approach, at a few scrolls: the share of a
  // band's pixels in the given colours, leaving out the paving's seam rows.
  const shopsFrames = [0, 150, 300].map((scroll) => ({
    out: draw(frameOf({ current: look("shops", 0x123456), scroll })),
    scroll,
  }));
  it.each([
    { colors: [DARK_GREEN], from: 146, name: "dark green", share: 0.35, to: 158 },
    { colors: FLOWERS, from: 146, name: "flowers", share: 0.1, to: 158 },
    { colors: [TAN], from: 162, name: "tan specks", share: 0.02, to: Number.POSITIVE_INFINITY },
  ])("dots the shops verge with $name on about $share of a band", (dot) => {
    const words = dot.colors.map(pixelWord);
    const seen = new Set<number>();
    let band = 0;
    let dotted = 0;
    for (const { out, scroll } of shopsFrames) {
      raster.rows.forEach((row, y) => {
        if (y < raster.approachRows || seamRow(scroll + row.distance, row.span)) {
          return;
        }
        row.across.forEach((across, i) => {
          if (across >= dot.from && across < dot.to) {
            band += 1;
            const word = out[y * view.width + i] ?? 0;
            if (words.includes(word)) {
              dotted += 1;
              seen.add(word);
            }
          }
        });
      });
    }
    expect(Math.abs(dotted / band - dot.share)).toBeLessThan(dot.share / 4);
    expect(seen.size).toBe(words.length);
  });

  it("ties each dot to its road pixel, so the dots scroll with the road", () => {
    const colors = new Map<string, number>();
    let repeats = 0;
    let conflicts = 0;
    for (const scroll of [0, 0.4, 3, 17, 40]) {
      const out = draw(frameOf({ current: look("shops", 0x123456), scroll }));
      raster.rows.forEach((row, y) => {
        if (y < raster.approachRows) {
          return;
        }
        const seed = Math.floor(scroll + row.distance) >> row.level;
        row.across.forEach((across, i) => {
          if (across >= 146 && across < 158) {
            const key = `${row.level}:${row.roadX[i] ?? 0}:${seed}`;
            const word = out[y * view.width + i] ?? 0;
            const before = colors.get(key);
            repeats += before === undefined ? 0 : 1;
            conflicts += before === undefined || before === word ? 0 : 1;
            colors.set(key, word);
          }
        });
      });
    }
    expect(conflicts).toBe(0);
    expect(repeats).toBeGreaterThan(1000);
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
      [200, 469],
      [111, 150],
      [300, 400],
      [180, 126],
    ] as const) {
      const label = pixelAt(out, x, y) ?? 0;
      expect((label - 1) % STRIP.width).toBe(
        Math.floor(140 + (x + 0.5 - 180) / rowScale(projection, y)),
      );
    }
    expect(itemAt(raster.rows, raster.rows.length - 1).level).toBe(0);
  });

  it("moves the road toward the pack as the walk scrolls", () => {
    const strips = { strip: stripLevels(labelled), zone: "park" as const };
    const row = (scroll: number) =>
      Math.floor(((pixelAt(draw(frameOf({ current: strips, scroll })), 180, 400) ?? 1) - 1) / 280);
    expect((row(0) - row(10) + STRIP.height) % STRIP.height).toBe(10);
  });

  it("samples the shrunk strips on the far rows, where a row covers more than 2 strip rows", () => {
    for (const row of raster.rows) {
      expect(row.level).toBe(row.span <= 2 ? 0 : row.span <= 4 ? 1 : 2);
    }
    expect(itemAt(raster.rows, 0).level).toBe(2);
    expect(itemAt(raster.rows, raster.rows.length - 1).level).toBe(0);
  });

  // The backdrop paints the road's approach to its cross street in the band's bottom rows.
  // Left to the backdrop, the top of the road would stand still while the rest scrolled.
  it("draws the moving road surface up the band's approach, leaving the verge beside it", () => {
    expect(raster.approachRows).toBe(approach.height);
    const strips = { strip: stripLevels(labelled), zone: "street" as const };
    const stripRow = (out: Uint32Array, y: number) =>
      Math.floor(((pixelAt(out, 180, y) ?? 1) - 1) / STRIP.width);
    const [before, after] = [0, 24].map((scroll) => draw(frameOf({ current: strips, scroll })));
    for (const y of [approach.y, approach.y + approach.height - 1, road.y]) {
      expect(stripRow(before ?? new Uint32Array(), y)).not.toBe(
        stripRow(after ?? new Uint32Array(), y),
      );
    }
    const out = draw(frameOf({}));
    for (const x of [0, 100, 260, 359]) {
      expect(pixelAt(out, x, approach.y)).toBe(0);
      expect(pixelAt(out, x, road.y)).not.toBe(0);
    }
    expect(pixelAt(out, 180, approach.y)).toBe(pixelWord(0x3a4466));
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
    expect(at(0, 150)).toBe(pixelWord(0x111111));
    expect(at(30, 150)).toBe(pixelWord(0x222222));
    expect(at(30, 469)).toBe(pixelWord(0x111111));
    expect(at(200, 150)).toBe(pixelWord(0x333333));
    expect(at(900, 469)).toBe(pixelWord(0x333333));
  });

  it("puts the previous zone's verge beside the start strip's cross street", () => {
    // street's curb runs to 144 across; park has none, so its lawn starts at the road.
    const y = 400;
    const row = itemAt(raster.rows, y - view.y);
    const curbX = Array.from(row.across).findIndex((across) => across >= 140 && across < 144);
    expect(curbX).toBeGreaterThanOrEqual(0);
    const previous = look("street", 0x111111);
    const start = look("park", 0x222222);
    // A strip row counts down from the start strip's far end, so along = 63 - stripRow.
    const vergeAt = (stripRow: number) => {
      const zoneStart = 5000;
      const along = STRIP.height - 1 - stripRow;
      const scroll = zoneStart + raster.visibleDistance + along + 0.5 - row.distance;
      const frame = frameOf({ current: start, scroll, transition: { previous, start }, zoneStart });
      return draw(frame)[(y - view.y) * view.width + curbX];
    };
    expect(vergeAt(START_STRIP_ZONE_ROWS - 1)).not.toBe(pixelWord(0x8b9bb4));
    expect(vergeAt(START_STRIP_ZONE_ROWS)).toBe(pixelWord(0x8b9bb4));
  });

  it("dithers the far rows into the band only when the fade is on", () => {
    const band = new Uint32Array(view.width).fill(pixelWord(0xffffff));
    const white = pixelWord(0xffffff);
    const count = (out: Uint32Array, y: number) =>
      out
        .subarray((y - view.y) * view.width, (y - view.y + 1) * view.width)
        .filter((p) => p === white).length;
    const faded = draw(frameOf({ fade: band }));
    expect(count(faded, view.y)).toBeGreaterThan(count(faded, view.y + FADE_ROWS - 1));
    expect(count(faded, view.y + FADE_ROWS)).toBe(0);
    expect(count(draw(frameOf({})), view.y)).toBe(0);
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
