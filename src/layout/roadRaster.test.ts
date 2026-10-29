import { readFileSync } from "node:fs";

import { itemAt } from "@andornaut/game-kit/arrays";
import { decodePng } from "@andornaut/game-kit/art/png";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { roadTileKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { ZoneId } from "../data/types";
import {
  crossesLine,
  dotColour,
  dottedBands,
  isLawn,
  mownAt,
  seamRow,
  type Verge,
  vergeBase,
  VERGES,
  walkFrom,
} from "../road/roadside";
import { roadProjection, rowScale } from "./projection";
import {
  drawRoad,
  LINE_RUN,
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
  stripLines,
  stripSeams,
} from "./roadRaster";
import { walkerFootY } from "./screenLayout";

const { approach, junction, rasterView: view, road } = SCREEN_LAYOUT;
// The road's far row, nearest row and middle row, and the backdrop's bottom row above the far
// row.
const FAR_Y = road.y;
const NEAR_Y = road.y + road.height - 1;
const BAND_BOTTOM_Y = road.y - 1;
const MID_Y = Math.round((FAR_Y + NEAR_Y) / 2);
// Verge distances, across, count out from the road's edge.
const ROAD_HALF = SCREEN_CONFIG.roadWidth / 2;
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
const raster = roadRaster(projection, approach.y, view);

const look = (zone: ZoneId, rgb: number): RoadLook => ({
  strip: stripLevels(solidStrip(rgb)),
  zone,
});
const frameOf = (overrides: Partial<RoadFrame>): RoadFrame => ({
  current: look("distilleryDistrict", 0x3a4466),
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
  // The backdrop's bottom row, which the verge continues.
  const bandRow = itemAt(
    roadRaster(projection, approach.y, { ...view, height: 1, y: BAND_BOTTOM_Y }).rows,
    0,
  );
  const ZONES = keysOf(VERGES);
  const zoneWhere = (test: (verge: Verge) => boolean): ZoneId => {
    const zone = ZONES.find((id) => test(VERGES[id]));
    if (zone === undefined) {
      throw new Error("No zone's verge fits");
    }
    return zone;
  };
  const MOWN = zoneWhere((verge) => verge.lawn === "mown");
  const ROUGH = zoneWhere((verge) => verge.lawn === "rough");
  const DOTTED = zoneWhere((verge) => dottedBands(verge).length > 0);
  const lawnOf = (zone: ZoneId) => {
    const colours = VERGES[zone].lawnColours;
    if (colours === null) {
      throw new Error(`${zone} has no lawn`);
    }
    const [base, marks, tufts] = colours;
    return { base, marks, tufts };
  };
  // The colours outward from the road's edge on the right of the band's bottom row, each run
  // once, without its tufts.
  const runColours = (zone: ZoneId) =>
    Array.from(bandRow.across, (across) =>
      across < 0 ? null : vergeBase(VERGES[zone], across, bandRow.scale),
    )
      .slice(bandRow.roadEnd)
      .filter((colour, i, colours) => colour !== colours[i - 1]);
  // The curb, the strips and the sidewalk or paving, as the verge lists them, leaving out any
  // that end where they start.
  const bandColours = (verge: Verge) =>
    [
      { colour: verge.curbColour, from: ROAD_HALF, to: verge.curbTo },
      ...verge.strips.map((strip, i) => ({
        colour: strip.colour,
        from: verge.strips[i - 1]?.to ?? verge.curbTo,
        to: strip.to,
      })),
      { colour: verge.walkColour, from: walkFrom(verge), to: verge.walkTo },
    ]
      .filter(({ from, to }) => to > from)
      .map(({ colour }) => colour)
      .filter((colour, i, colours) => colour !== colours[i - 1]);

  it.each(ZONES)("continues %s's curb, strips and paving, then its lawn", (zone) => {
    const verge = VERGES[zone];
    const bands = bandColours(verge);
    const runs = runColours(zone);
    expect(runs.slice(0, bands.length)).toEqual(bands);
    const lawn = verge.lawnColours === null ? [] : [verge.lawnColours[0], verge.lawnColours[1]];
    expect(runs.slice(bands.length).filter((colour) => !lawn.includes(colour ?? -1))).toEqual([]);
    expect(runs.length > bands.length).toBe(verge.lawn !== "none");
  });

  // The second stripe, 62 wide, from 44 past the sidewalk.
  it.each([
    [62, 0.5, true],
    [62, 0.06, false],
    [12, 1, false],
  ])(
    "mownAt %d past the sidewalk at scale %d is %s: a dark stripe ends where it would draw under 4px wide",
    (past, scale, mown) => {
      const { walkTo } = VERGES[MOWN];
      expect(mownAt(walkTo, walkTo + past, scale)).toBe(mown);
    },
  );

  it("tufts only the lawn, in its tuft colour", () => {
    const verge = VERGES[MOWN];
    const { tufts } = lawnOf(MOWN);
    const out = draw(frameOf({ current: look(MOWN, 0x123456), scroll: 300 }));
    let tufted = 0;
    raster.rows.forEach((row, y) => {
      row.across.forEach((across, i) => {
        if (across < 0 || y < raster.approachRows) {
          return;
        }
        const word = out[y * view.width + i] ?? 0;
        if (word !== pixelWord(vergeBase(verge, across, row.scale))) {
          tufted += 1;
          expect(word).toBe(pixelWord(isLawn(verge, across) ? tufts : verge.seamColour));
        }
      });
    });
    expect(tufted).toBeGreaterThan(20);
  });

  it("thins tufts with distance", () => {
    const verge = VERGES[MOWN];
    const tuftWord = pixelWord(lawnOf(MOWN).tufts);
    const tuftShare = (from: number, to: number) => {
      let lawn = 0;
      let marked = 0;
      for (const scroll of [0, 150, 300]) {
        const out = draw(frameOf({ current: look(MOWN, 0x123456), scroll }));
        raster.rows.slice(from, to).forEach((row, j) => {
          row.across.forEach((across, i) => {
            if (isLawn(verge, across)) {
              lawn += 1;
              marked += out[(from + j) * view.width + i] === tuftWord ? 1 : 0;
            }
          });
        });
      }
      return marked / Math.max(1, lawn);
    };
    const far = raster.approachRows;
    const near = raster.rows.length;
    expect(tuftShare(far, far + 40)).toBeLessThan(tuftShare(near - 100, near));
  });

  it("lays rough patches in the lawn's mark colour on an unmown lawn", () => {
    const patched = [0, 400, 800, 1200].some((scroll) =>
      draw(frameOf({ current: look(ROUGH, 0x123456), scroll })).includes(
        pixelWord(lawnOf(ROUGH).marks),
      ),
    );
    expect(patched).toBe(true);
  });

  // A leaf's tones the verge does not draw in otherwise.
  const ownColours = (verge: Verge) => [
    verge.curbColour,
    verge.seamColour,
    verge.walkColour,
    ...(verge.lawnColours ?? []),
    ...[...verge.strips, { colour: verge.walkColour, dots: verge.walkDots }].flatMap(
      ({ colour, dots }) => [colour, ...dots.flatMap((dot) => dot.colours)],
    ),
  ];
  // A zone whose verge has leaves and one whose verge has none.
  const leafZones = [
    ZONES.find((zone) => VERGES[zone].leaves),
    ZONES.find((zone) => !VERGES[zone].leaves),
  ].flatMap((zone) => (zone === undefined ? [] : [zone]));
  it.each(leafZones)("scatters leaves on %s only if its verge has them", (zone) => {
    const own = ownColours(VERGES[zone]);
    const tones = [0xd77643, 0xbe4a2f, 0x733e39]
      .filter((tone) => !own.includes(tone))
      .map(pixelWord);
    const leaves = [0, 100, 200].some((scroll) =>
      draw(frameOf({ current: look(zone, 0x123456), scroll })).some((p) => tones.includes(p)),
    );
    expect(leaves).toBe(VERGES[zone].leaves);
  });

  const DOTS = [
    { colours: [0x3e8948], share: 0.35 },
    { colours: [0xe43b44, 0xfee761, 0xffffff, 0xf77622], share: 0.1 },
  ];
  it.each<[number, number | null]>([
    [0, 0x3e8948],
    [0.349, 0x3e8948],
    [0.35, 0xe43b44],
    [0.38, 0xfee761],
    [0.41, 0xffffff],
    [0.449, 0xf77622],
    [0.45, null],
  ])("dotColour picks %d's dot: %d", (value, colour) => {
    expect(dotColour(DOTS, value)).toBe(colour);
  });

  // Every dotted band's dots over the rows below the approach, at a few scrolls: the share of
  // a band's pixels in each dot's colours, leaving out the paving's seam rows.
  const dotted = ZONES.flatMap((zone) =>
    dottedBands(VERGES[zone]).flatMap((band) =>
      band.dots.map((dot) => ({ ...dot, from: band.from, to: Math.min(band.to, 1e6), zone })),
    ),
  );
  it.each(dotted)("dots $zone from $from across with $colours on about $share of it", (dot) => {
    const verge = VERGES[dot.zone];
    const words = dot.colours.map(pixelWord);
    const seen = new Set<number>();
    let band = 0;
    let hits = 0;
    for (const scroll of [0, 150, 300]) {
      const out = draw(frameOf({ current: look(dot.zone, 0x123456), scroll }));
      raster.rows.forEach((row, y) => {
        if (y < raster.approachRows || seamRow(verge, scroll + row.distance, row.span)) {
          return;
        }
        row.across.forEach((across, i) => {
          if (across >= dot.from && across < dot.to) {
            band += 1;
            const word = out[y * view.width + i] ?? 0;
            if (words.includes(word)) {
              hits += 1;
              seen.add(word);
            }
          }
        });
      });
    }
    expect(Math.abs(hits / band - dot.share)).toBeLessThan(dot.share / 4);
    expect(seen.size).toBe(words.length);
  });

  it("ties each dot to its road pixel, so the dots scroll with the road", () => {
    const band = itemAt(dottedBands(VERGES[DOTTED]), 0);
    const colours = new Map<string, number>();
    let repeats = 0;
    let conflicts = 0;
    for (const scroll of [0, 0.4, 3, 17, 40]) {
      const out = draw(frameOf({ current: look(DOTTED, 0x123456), scroll }));
      raster.rows.forEach((row, y) => {
        if (y < raster.approachRows || seamRow(VERGES[DOTTED], scroll + row.distance, row.span)) {
          return;
        }
        const seed = Math.floor(scroll + row.distance) >> row.dotLevel;
        row.across.forEach((across, i) => {
          if (across >= band.from && across < Math.min(band.to, band.from + 40)) {
            const key = `${row.dotLevel}:${row.roadX[i] ?? 0}:${seed}`;
            const word = out[y * view.width + i] ?? 0;
            const before = colours.get(key);
            repeats += before === undefined ? 0 : 1;
            conflicts += before === undefined || before === word ? 0 : 1;
            colours.set(key, word);
          }
        });
      });
    }
    expect(conflicts).toBe(0);
    expect(repeats).toBeGreaterThan(1000);
  });

  // A row's dot cell is the same as or one past the cell of the row below it, so no cell is
  // skipped between rows: each dot shows on some row and moves down with the road. At no scroll,
  // a part pixel and many pixels.
  it.each([0, 0.4, 17])("seeds every cell of road on some row at scroll %d", (scroll) => {
    const cells = raster.rows.map((row) => ({
      cell: Math.floor(scroll + row.distance) >> row.dotLevel,
      level: row.dotLevel,
    }));
    cells.slice(1).forEach(({ cell, level }, i) => {
      const above = itemAt(cells, i);
      if (above.level === level) {
        expect(above.cell - cell).toBeLessThanOrEqual(1);
      }
    });
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
    const out = draw(
      frameOf({ current: { strip: [labelled, labelled, labelled], zone: "highPark" } }),
    );
    for (const [x, y] of [
      [200, NEAR_Y],
      [111, FAR_Y],
      [300, MID_Y],
      [180, approach.y],
    ] as const) {
      const label = pixelAt(out, x, y) ?? 0;
      expect((label - 1) % STRIP.width).toBe(
        Math.floor(STRIP.width / 2 + (x + 0.5 - projection.centreX) / rowScale(projection, y)),
      );
    }
    expect(itemAt(raster.rows, raster.rows.length - 1).level).toBe(0);
  });

  it("moves the road toward the pack as the walk scrolls", () => {
    const strips = { strip: stripLevels(labelled), zone: "highPark" as const };
    const row = (scroll: number) =>
      Math.floor(
        ((pixelAt(draw(frameOf({ current: strips, scroll })), 180, MID_Y) ?? 1) - 1) / STRIP.width,
      );
    expect((row(0) - row(10) + STRIP.height) % STRIP.height).toBe(10);
  });

  it("samples the shrunk strips on the far rows, where a row covers more than 2 strip rows", () => {
    for (const row of raster.rows) {
      expect(row.level).toBe(row.span <= 2 ? 0 : row.span <= 4 ? 1 : 2);
    }
    expect(itemAt(raster.rows, 0).level).toBe(2);
  });

  // The backdrop paints the road's junction and approach to its cross street in the band's
  // bottom rows. Left to the backdrop, the top of the road would stand still while the rest
  // scrolled, short of the cross street.
  it("draws the moving road surface up to the cross street, leaving the verge beside it", () => {
    expect(raster.junctionRows).toBe(junction.height);
    expect(raster.approachRows).toBe(junction.height + approach.height);
    const strips = { strip: stripLevels(labelled), zone: "distilleryDistrict" as const };
    const stripRow = (out: Uint32Array, y: number) =>
      Math.floor(((pixelAt(out, 180, y) ?? 1) - 1) / STRIP.width);
    const [before, after] = [0, 24].map((scroll) => draw(frameOf({ current: strips, scroll })));
    for (const y of [junction.y, approach.y, approach.y + approach.height - 1, road.y]) {
      expect(stripRow(before ?? new Uint32Array(), y)).not.toBe(
        stripRow(after ?? new Uint32Array(), y),
      );
    }
    const out = draw(frameOf({}));
    for (const x of [0, 100, 260, 359]) {
      expect(pixelAt(out, x, junction.y)).toBe(0);
      expect(pixelAt(out, x, approach.y)).toBe(0);
      expect(pixelAt(out, x, road.y)).not.toBe(0);
    }
    expect(pixelAt(out, 180, junction.y)).toBe(pixelWord(0x3a4466));
    expect(pixelAt(out, 180, approach.y)).toBe(pixelWord(0x3a4466));
  });

  it("rolls the start strip in at the far edge over the previous zone's road", () => {
    const previous = look("distilleryDistrict", 0x111111);
    const start = look("highPark", 0x222222);
    const current = look("highPark", 0x333333);
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
    expect(at(0, FAR_Y)).toBe(pixelWord(0x111111));
    expect(at(30, FAR_Y)).toBe(pixelWord(0x222222));
    expect(at(30, NEAR_Y)).toBe(pixelWord(0x111111));
    expect(at(200, FAR_Y)).toBe(pixelWord(0x333333));
    // The strip has rolled past the nearest row once its far end has travelled the whole way.
    const passed =
      raster.visibleDistance + STRIP.height - itemAt(raster.rows, NEAR_Y - view.y).distance;
    expect(at(passed + 1, NEAR_Y)).toBe(pixelWord(0x333333));
  });

  it("puts the previous zone's verge beside the start strip's cross street", () => {
    // distilleryDistrict's curb runs 4 past the road's edge; highPark has none, so its lawn starts
    // at the road.
    const y = MID_Y;
    const row = itemAt(raster.rows, y - view.y);
    const curbX = Array.from(row.across).findIndex(
      (across) => across >= ROAD_HALF && across < ROAD_HALF + 4,
    );
    expect(curbX).toBeGreaterThanOrEqual(0);
    const previous = look("distilleryDistrict", 0x111111);
    const start = look("highPark", 0x222222);
    // A strip row counts down from the start strip's far end, so along = 63 - stripRow.
    const vergeAt = (stripRow: number) => {
      const zoneStart = 5000;
      const along = STRIP.height - 1 - stripRow;
      const scroll = zoneStart + raster.visibleDistance + along + 0.5 - row.distance;
      const frame = frameOf({ current: start, scroll, transition: { previous, start }, zoneStart });
      return draw(frame)[(y - view.y) * view.width + curbX];
    };
    expect(vergeAt(START_STRIP_ZONE_ROWS - 1)).not.toBe(
      pixelWord(VERGES.distilleryDistrict.curbColour),
    );
    expect(vergeAt(START_STRIP_ZONE_ROWS)).toBe(pixelWord(VERGES.distilleryDistrict.curbColour));
  });

  // A strip of one colour with a line down one column over its first rows.
  const BASE = pixelWord(0x3a4466);
  const LINE = pixelWord(0xffffff);
  const lineLook = (column: number, rows: number): RoadLook => {
    const pixels = new Uint32Array(STRIP.width * STRIP.height).fill(BASE);
    for (let y = 0; y < rows; y++) {
      pixels[y * STRIP.width + column] = LINE;
    }
    const strip = { ...STRIP, pixels };
    return { lines: stripLines(strip), strip: stripLevels(strip), zone: "distilleryDistrict" };
  };
  const showsLine = (out: Uint32Array, y: number) =>
    out.subarray(y * view.width, (y + 1) * view.width).includes(LINE);

  // A column covers more than a road pixel on the far rows, and a row several strip rows.
  it.each([1, 37, 100, 161, 250, 318])(
    "keeps a one-pixel lane line along strip column %d on every row, approach included",
    (column) => {
      for (const scroll of [0, 0.4, 3.7, 17]) {
        const out = draw(frameOf({ current: lineLook(column, STRIP.height), scroll }));
        const missing = raster.rows.filter((_, y) => !showsLine(out, y)).length;
        expect(missing, `scroll ${scroll}`).toBe(0);
      }
    },
  );

  // At no scroll, a part pixel and many pixels.
  it.each([0, 0.4, 17])(
    "shows a dash on every row whose stretch of road it lies on, at scroll %d",
    (scroll) => {
      const dash = LINE_RUN + 4;
      const out = draw(frameOf({ current: lineLook(100, dash), scroll }));
      const start = scroll - raster.visibleDistance;
      raster.rows.forEach((row, y) => {
        const first = Math.floor(start + row.near);
        const last = Math.max(first, Math.ceil(start + row.far) - 1);
        const onDash = Array.from({ length: last - first + 1 }, (_, k) => first + k).some(
          (along) =>
            STRIP.height - 1 - (((along % STRIP.height) + STRIP.height) % STRIP.height) < dash,
        );
        if (onDash) {
          expect(showsLine(out, y), `row ${view.y + y}`).toBe(true);
        }
      });
    },
  );

  // The backdrop's own pixels beside the road on rows first to last (excluded): by default its
  // verge on the approach rows, as the raster draws its base, and 0 elsewhere.
  const backdropOf = (
    zone: ZoneId,
    colourAt = (across: number, scale: number) => vergeBase(VERGES[zone], across, scale),
    first = raster.junctionRows,
    last = raster.approachRows,
  ) => {
    const band = new Uint32Array(view.width * raster.approachRows);
    raster.rows.slice(first, last).forEach((row, k) => {
      row.across.forEach((across, i) => {
        band[(first + k) * view.width + i] =
          across < 0 ? 0 : pixelWord(colourAt(across, row.scale));
      });
    });
    return band;
  };
  const approachVerge = (out: Uint32Array, band: Uint32Array) =>
    Array.from(band, (word, i) => (word === 0 ? 0 : (out[i] ?? 0)));

  it.each<ZoneId>(["kensingtonMarket", "distilleryDistrict"])(
    "moves %s's verge detail up the approach where the backdrop shows its verge",
    (zone) => {
      const band = backdropOf(zone);
      const frames = [0, 5, 11, 19, 30].map((scroll) =>
        approachVerge(
          draw(frameOf({ approach: band, current: look(zone, 0x3a4466), scroll })),
          band,
        ),
      );
      const detailed = frames.filter((verge) => verge.some((word, i) => word !== band[i]));
      expect(detailed.length).toBeGreaterThan(0);
      expect(new Set(frames.map((verge) => verge.join())).size).toBeGreaterThan(1);
    },
  );

  it("leaves the backdrop's own pixels on the approach where it does not show the verge", () => {
    const band = backdropOf("distilleryDistrict", () => 0x010203);
    const out = draw(
      frameOf({ approach: band, current: look("distilleryDistrict", 0x3a4466), scroll: 7 }),
    );
    expect(approachVerge(out, band).every((word) => word === 0)).toBe(true);
  });

  it("leaves the near corners beside the junction to the backdrop, verge or not", () => {
    const band = backdropOf("kensingtonMarket", undefined, 0, raster.junctionRows);
    const out = draw(
      frameOf({ approach: band, current: look("kensingtonMarket", 0x3a4466), scroll: 7 }),
    );
    expect(approachVerge(out, band).every((word) => word === 0)).toBe(true);
  });

  // The backdrops paint seams, dots and marks on their approach verges, standing still. The
  // raster draws its own there, moving with the road, so the backdrop's never show beside them.
  const zoneWith = (test: (verge: Verge) => boolean): ZoneId => {
    const zone = keysOf(VERGES).find((id) => test(VERGES[id]));
    if (zone === undefined) {
      throw new Error("No zone's verge fits");
    }
    return zone;
  };
  const SEAMED = zoneWith((verge) => verge.walkTo - walkFrom(verge) >= 8);
  const DOTTED_ZONE = zoneWith((verge) => dottedBands(verge).length > 0);
  const DOT_BAND = itemAt(dottedBands(VERGES[DOTTED_ZONE]), 0);
  const MOWN_ZONE = zoneWith((verge) => verge.lawn === "mown");
  const ROUGH_ZONE = zoneWith((verge) => verge.lawn === "rough");
  const lawnColour = (zone: ZoneId, i: number) => itemAt(VERGES[zone].lawnColours ?? [], i);
  it.each([
    {
      colour: VERGES[SEAMED].seamColour,
      from: walkFrom(VERGES[SEAMED]),
      name: "a seam",
      zone: SEAMED,
    },
    {
      colour: itemAt(itemAt(DOT_BAND.dots, 0).colours, 0),
      from: DOT_BAND.from,
      name: "a dot",
      zone: DOTTED_ZONE,
    },
    {
      colour: lawnColour(MOWN_ZONE, 2),
      from: VERGES[MOWN_ZONE].walkTo,
      name: "a tuft",
      zone: MOWN_ZONE,
    },
    {
      colour: lawnColour(ROUGH_ZONE, 1),
      from: VERGES[ROUGH_ZONE].walkTo,
      name: "a rough lawn's patch",
      zone: ROUGH_ZONE,
    },
  ])(
    "covers $name the backdrop paints on the approach with the verge",
    ({ colour, from, zone }) => {
      const picks = (across: number) => across >= from && across < from + 8;
      const kept = (detail: number) => {
        const band = backdropOf(zone, (across, scale) =>
          picks(across) ? detail : vergeBase(VERGES[zone], across, scale),
        );
        const out = draw(frameOf({ approach: band, current: look(zone, 0x3a4466), scroll: 7 }));
        return raster.rows
          .slice(raster.junctionRows, raster.approachRows)
          .flatMap((row, k) =>
            Array.from(row.across, (across, i) =>
              picks(across) ? out[(raster.junctionRows + k) * view.width + i] !== 0 : null,
            ).filter((shown) => shown !== null),
          );
      };
      const own = kept(colour);
      expect(own.length).toBeGreaterThan(0);
      expect(own.every(Boolean)).toBe(true);
      expect(kept(0x010203).some(Boolean)).toBe(false);
    },
  );
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

  it("leaves skipped pixels out of the vote, and takes the base where all are skipped", () => {
    const source = image([[4], [9], [9], [9], [2], [2], [2], [2]]);
    const skip = Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1]);
    expect([...shrinkRows(4, source).pixels]).toEqual([9, 2]);
    expect([...shrinkRows(4, source, skip).pixels]).toEqual([4, 2]);
  });
});

describe("stripLines", () => {
  // A one-colour strip with a run down column 5 from row from, rows long.
  const runStrip = (from: number, rows: number): PixelImage => {
    const pixels = new Uint32Array(STRIP.width * STRIP.height).fill(1);
    for (let k = 0; k < rows; k++) {
      pixels[((from + k) % STRIP.height) * STRIP.width + 5] = 2;
    }
    return { ...STRIP, pixels };
  };
  it.each([
    { from: 10, line: true, name: "a run as long as a line", rows: LINE_RUN },
    { from: 10, line: false, name: "a shorter run", rows: LINE_RUN - 1 },
    { from: STRIP.height - 3, line: true, name: "a run that wraps", rows: LINE_RUN },
    { from: 0, line: true, name: "a whole column", rows: STRIP.height },
  ])("marks $name as a line: $line", ({ from, line, rows }) => {
    const lines = stripLines(runStrip(from, rows));
    expect(lines.columns[5] === 1).toBe(line);
    expect(lines.mask[((from + rows - 1) % STRIP.height) * STRIP.width + 5] === 1).toBe(line);
    expect(lines.columns.reduce((sum, value) => sum + value, 0)).toBe(line ? 1 : 0);
  });
});

describe("stripSeams", () => {
  // A one-colour strip with a band of another colour across columns 10 on, cols wide, from row
  // from, rows thick.
  const bandStrip = (from: number, rows: number, cols: number): PixelImage => {
    const pixels = new Uint32Array(STRIP.width * STRIP.height).fill(1);
    for (let k = 0; k < rows; k++) {
      pixels.fill(
        2,
        ((from + k) % STRIP.height) * STRIP.width + 10,
        ((from + k) % STRIP.height) * STRIP.width + 10 + cols,
      );
    }
    return { ...STRIP, pixels };
  };
  it.each([
    { cols: STRIP.width - 10, from: 14, name: "a joint across the road", rows: 2, seam: true },
    { cols: LINE_RUN, from: 14, name: "a joint as long as a line", rows: 2, seam: true },
    { cols: LINE_RUN - 1, from: 14, name: "a shorter mark", rows: 2, seam: false },
    { cols: 100, from: 10, name: "a band as thick as a line", rows: LINE_RUN, seam: false },
    { cols: 100, from: 10, name: "a band just thinner", rows: LINE_RUN - 1, seam: true },
    { cols: 100, from: STRIP.height - 1, name: "a joint that wraps", rows: 2, seam: true },
  ])("marks $name as a seam: $seam", ({ cols, from, rows, seam }) => {
    const seams = stripSeams(bandStrip(from, rows, cols));
    // A seam's count sits at its nearest pixel, its last row in the strip.
    const nearest = ((from + rows - 1) % STRIP.height) * STRIP.width + 10;
    expect(seams.starts[nearest]).toBe(seam ? rows : 0);
    expect(seams.mask[(from % STRIP.height) * STRIP.width + 10]).toBe(seam ? 1 : 0);
    expect(seams.starts.filter((n) => n > 0).length).toBe(seam ? cols : 0);
  });
});

describe("seams across the road", () => {
  const stripOf = (key: string): PixelImage => {
    const { data, height, width } = decodePng(readFileSync(`public/art/images/${key}.png`));
    return { height, pixels: new Uint32Array(data.slice().buffer), width };
  };
  const zones = gameData.world.zones.map((zone) => ({ strip: stripOf(roadTileKey(zone)), zone }));
  // Each seam, by its nearest strip row, as a run along the road from a, n rows long, and the
  // strip with its pixels labelled with that row (plus 2) and every other pixel 1, so a frame
  // shows which seams it draws. A row's seams must span at least LINE_RUN columns, as a
  // narrower fleck can fall between the columns a far row samples.
  const labelled = (strip: PixelImage) => {
    const seams = stripSeams(strip);
    const pixels = new Uint32Array(strip.pixels.length).fill(1);
    const runs = new Map<number, number>();
    for (let r = 0; r < STRIP.height; r++) {
      const row = seams.starts.subarray(r * STRIP.width, (r + 1) * STRIP.width);
      const n = Math.max(...row);
      if (row.filter((count) => count > 0).length < LINE_RUN) {
        continue;
      }
      runs.set(r, n);
      row.forEach((count, x) => {
        for (let k = 0; k < count; k++) {
          pixels[((((r - k) % STRIP.height) + STRIP.height) % STRIP.height) * STRIP.width + x] =
            r + 2;
        }
      });
    }
    const look: RoadLook = {
      seams,
      strip: stripLevels({ ...strip, pixels }, seams),
      zone: "distilleryDistrict",
    };
    return { look, runs };
  };
  const affected = zones.filter(({ strip }) => labelled(strip).runs.size > 0);

  it("finds seams on some zones' roads and none on the others'", () => {
    expect(affected.length).toBeGreaterThan(0);
    expect(affected.length).toBeLessThan(zones.length);
  });

  // Every seam wholly on the stretch of road in view shows, as one run of rows, so as the road
  // scrolls no seam blinks, and the far rows show theirs.
  it.each(affected.map(({ strip, zone }) => ({ id: zone.id, strip })))(
    "draws each of $id's seams once in every frame, far rows included",
    ({ strip }) => {
      const { look, runs } = labelled(strip);
      const { rows, visibleDistance } = raster;
      const farRows = rows.flatMap((row, y) => (row.level === 2 ? [y] : []));
      for (let frame = 0; frame < 48; frame++) {
        const scroll = 1000.3 + frame * 4.67;
        const out = draw(frameOf({ current: look, scroll }));
        const lineStart = scroll - visibleDistance;
        const alongAt = (distance: number) => Math.floor(lineStart + distance);
        // Each seam copy drawn, keyed by its nearest strip row and its copy along the road,
        // with the rows it shows on.
        const drawn = new Map<string, number[]>();
        rows.forEach((row, y) => {
          const labels = new Set(
            out.subarray(y * view.width + row.roadStart, y * view.width + row.roadEnd),
          );
          for (const label of labels) {
            const r = label - 2;
            if (runs.has(r)) {
              const copy = Math.floor(
                (alongAt(row.distance) - (STRIP.height - 1 - r)) / STRIP.height,
              );
              drawn.set(`${r}@${copy}`, [...(drawn.get(`${r}@${copy}`) ?? []), y]);
            }
          }
        });
        const from = alongAt(itemAt(rows, rows.length - 1).below) + 1;
        const to = alongAt(itemAt(rows, 0).distance);
        const wholly = [...runs].flatMap(([r, n]) => {
          const a = STRIP.height - 1 - r;
          const copies = Array.from(
            { length: Math.ceil((to - from) / STRIP.height) + 2 },
            (_, k) => Math.floor((from - a) / STRIP.height) + k,
          );
          return copies
            .filter(
              (copy) => a + copy * STRIP.height >= from && a + copy * STRIP.height + n - 1 <= to,
            )
            .map((copy) => `${r}@${copy}`);
        });
        expect(
          wholly.filter((key) => !drawn.has(key)),
          `frame ${frame}`,
        ).toEqual([]);
        for (const [key, ys] of drawn) {
          expect(ys.length, `${key} on one run of rows`).toBe((ys.at(-1) ?? 0) - (ys[0] ?? 0) + 1);
        }
        expect(farRows.some((y) => [...drawn.values()].some((ys) => ys.includes(y)))).toBe(true);
      }
    },
  );
});
