import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import {
  dotColour,
  dottedBands,
  LEAF_PIXELS,
  markFits,
  markFrom,
  markLimit,
  marksOnRow,
  noise,
  ROUGH_PATCH_BLOCK,
  ROUGH_PATCH_REACH,
  type RoughPatch,
  roughPatches,
  type RowMarks,
  seamRow,
  type Verge,
  vergeBase,
  VERGES,
  walkFrom,
} from "../road/roadside";
import { distanceAtY, type RoadProjection, roadXAt, rowScale } from "./projection";

// The projected road drawn a screen row at a time into a pixel buffer: every row samples one
// row of the zone's road strip, stretched across by the row's scale, with the verge either
// side. Pixels are 32-bit words in the byte order of canvas ImageData (r, g, b, a in memory),
// so a strip read from a canvas copies straight through.

export interface PixelImage {
  readonly height: number;
  readonly pixels: Uint32Array;
  readonly width: number;
}

// A road strip and its copies shrunk 2x and 4x along the road, for rows that cover more road
// than the strip has rows to show.
type StripLevels = readonly [PixelImage, PixelImage, PixelImage];

// The road x of each screen column, floored, and how far its centre is from the centre line,
// or -1 on the strip, which covers columns roadStart to roadEnd (excluded). roadXFrom to
// roadXTo are the road pixels whose left edges fall in each column, so the columns share the
// road's pixels out between them, none missed and none twice (none on a row wider than the
// road, where a pixel covers more than a column). The row covers the road from near to far
// ahead of the feet and samples it at distance; the row below samples it at below. dotLevel
// sizes the cells the verge's dots are seeded on, 2^dotLevel road pixels long, at least as long
// as the row's span, so every cell shows on some row and the dots move down with the road
// rather than reshuffle. splits caches
// verge edges by across, and lineColumns the columns whose share of the road holds a strip
// line, by the strip's lines.
interface RasterRow {
  readonly across: Float32Array;
  readonly below: number;
  readonly distance: number;
  readonly dotLevel: number;
  readonly far: number;
  // The keep below which each kind of verge mark shows on the row (markLimit).
  readonly leafLimit: number;
  readonly level: 0 | 1 | 2;
  readonly lineColumns: Map<StripLines, Int16Array>;
  readonly near: number;
  // The farthest across the row shows, at its outer columns.
  readonly reach: number;
  readonly roadEnd: number;
  readonly roadStart: number;
  readonly roadX: Int16Array;
  readonly roadXFrom: Int16Array;
  readonly roadXTo: Int16Array;
  readonly scale: number;
  readonly span: number;
  readonly splits: Map<number, readonly [number, number]>;
  readonly tuftLimit: number;
}

// verges holds each zone's verge before seams, patches and marks, drawn once; marks and
// patches cache what the road rows and blocks in view hold. The first approachRows rows lie
// past the far edge of the road in view, on the backdrop's approach to its cross street:
// they draw the road surface, and the verge only where the backdrop shows the verge as the
// raster draws it (its ground, seams, dots and marks), leaving its corners, fences and the rest
// as they are. The first junctionRows of them, between the near corners up to the cross street,
// draw the road surface alone.
export interface RoadRaster {
  readonly approachRows: number;
  readonly junctionRows: number;
  readonly centreX: number;
  readonly marks: Map<number, RowMarks>;
  readonly patches: Map<number, readonly RoughPatch[]>;
  readonly rows: readonly RasterRow[];
  readonly verges: Map<ZoneId, Uint32Array>;
  // Scratch space drawRoad reuses frame to frame: marks carried to the next row, the
  // columns a mark has drawn on in this row, and the strip rows a row's lines are looked for on.
  readonly scratch: { carried: [Carried, Carried]; lineRows: Int32Array; marked: Uint8Array };
  readonly view: Rect;
  readonly visibleDistance: number;
}

// A zone's look: its strip and the zone whose verge goes beside it, the strip's lines along the
// road, which every row that covers them keeps (stripLines), and its seams across the road,
// which every pass of the road through the view shows (stripSeams).
export interface RoadLook {
  readonly lines?: StripLines;
  readonly seams?: StripSeams;
  readonly strip: StripLevels;
  readonly zone: ZoneId;
}

// A strip's look, with its lines and seams.
export function roadLook(zone: ZoneId, strip: PixelImage): RoadLook {
  const seams = stripSeams(strip);
  return { lines: stripLines(strip), seams, strip: stripLevels(strip, seams), zone };
}

// The pixels of a strip that lie on its lines along the road, such as lane marks: runs at
// least LINE_RUN rows long, down one column, of a colour other than the strip's commonest.
// columns marks each column holding any.
interface StripLines {
  readonly columns: Uint8Array;
  readonly mask: Uint8Array;
}

// approach, when set, is the backdrop's pixels on the approach rows across the view.
// zoneStart is the scroll at which the current zone began. While its start strip rolls in, it
// lies just past the far edge of the road in view at zoneStart, with the previous zone's road
// on the near side of it.
export interface RoadFrame {
  readonly approach?: Uint32Array | null;
  readonly current: RoadLook;
  readonly scroll: number;
  readonly transition: { readonly previous: RoadLook; readonly start: RoadLook } | null;
  readonly zoneStart: number;
}

export const STRIP = { height: 64, width: SCREEN_CONFIG.roadWidth } as const;
// A start strip's far rows are its zone's road; the rest, a cross street, then the previous
// zone's road below it.
export const START_STRIP_ZONE_ROWS = 20;
// Rows covering more than this much road per strip row step down a level.
const LEVEL_SPAN = 2;
// A run down a strip column at least this long is a line along the road.
export const LINE_RUN = 8;

// A palette colour as a pixel word: opaque, in ImageData byte order on any platform.
export function pixelWord(rgb: number): number {
  const bytes = new Uint8Array([(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 0xff]);
  return new Uint32Array(bytes.buffer)[0] ?? 0;
}

function mostCommon(pixels: Uint32Array): number {
  const counts = new Map<number, number>();
  let best = pixels[0] ?? 0;
  let bestCount = 0;
  for (const pixel of pixels) {
    const count = (counts.get(pixel) ?? 0) + 1;
    counts.set(pixel, count);
    if (count > bestCount) {
      best = pixel;
      bestCount = count;
    }
  }
  return best;
}

// The image shrunk factor times along its height. Each pixel takes the colour most of the
// rows it stands for have; a tie goes to the image's commonest colour if it is one of the
// tied, else to the nearest of them to the top. Colours are never mixed, so it stays on the
// palette, and a far row shows the road's base rather than a speckle that blinks. The pixels
// set in skip, such as seams, which drawRoad draws itself, have no say; a pixel with none
// takes the base.
export function shrinkRows(factor: number, image: PixelImage, skip?: Uint8Array): PixelImage {
  const { width } = image;
  const height = Math.floor(image.height / factor);
  const base = mostCommon(image.pixels);
  const pixels = new Uint32Array(width * height);
  const seen: number[] = [];
  const counts: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let x = 0; x < width; x++) {
      seen.length = 0;
      counts.length = 0;
      for (let k = 0; k < factor; k++) {
        const index = (row * factor + k) * width + x;
        if (skip?.[index] === 1) {
          continue;
        }
        const pixel = image.pixels[index] ?? 0;
        const at = seen.indexOf(pixel);
        if (at < 0) {
          seen.push(pixel);
          counts.push(1);
        } else {
          counts[at] = (counts[at] ?? 0) + 1;
        }
      }
      const most = Math.max(...counts);
      const tied = seen.filter((_, i) => counts[i] === most);
      pixels[row * width + x] = tied.includes(base) ? base : (tied[0] ?? base);
    }
  }
  return { height, pixels, width };
}

// The strip and its shrunk copies, which leave out seams, so a seam shows only on the rows
// drawRoad draws it on.
export function stripLevels(strip: PixelImage, seams?: StripSeams): StripLevels {
  return [strip, shrinkRows(2, strip, seams?.mask), shrinkRows(4, strip, seams?.mask)];
}

// The strip's lines along the road, wrapping from its last row to its first as it tiles.
export function stripLines(strip: PixelImage): StripLines {
  const { height, pixels, width } = strip;
  const base = mostCommon(pixels);
  const mask = new Uint8Array(width * height);
  const columns = new Uint8Array(width);
  const at = (x: number, y: number) => pixels[(((y % height) + height) % height) * width + x];
  for (let x = 0; x < width; x++) {
    // A column of one colour has no run start: it is one line all the way down.
    const uniform = Array.from({ length: height }, (_, y) => at(x, y)).every(
      (pixel) => pixel === at(x, 0),
    );
    if (uniform && at(x, 0) !== base && height >= LINE_RUN) {
      for (let y = 0; y < height; y++) {
        mask[y * width + x] = 1;
      }
      columns[x] = 1;
      continue;
    }
    for (let y = 0; y < height; y++) {
      const pixel = at(x, y);
      if (pixel === base || at(x, y - 1) === pixel) {
        continue;
      }
      let run = 1;
      while (run < height && at(x, y + run) === pixel) {
        run += 1;
      }
      if (run >= LINE_RUN) {
        for (let k = 0; k < run; k++) {
          mask[((y + k) % height) * width + x] = 1;
        }
        columns[x] = 1;
      }
    }
  }
  return { columns, mask };
}

// The pixels of a strip that lie on its seams across the road, such as paving joints: runs at
// least LINE_RUN columns long, along one row, of a colour other than the strip's commonest, and
// fewer than LINE_RUN rows of that colour down each column, wrapping as the strip tiles. Each
// column's run of seam rows is one seam: starts holds its row count at its nearest pixel (its
// last row in the strip, the first along the road), and 0 elsewhere. rows flags the strip rows
// holding a seam pixel (SEAM_PIXEL) and a seam's nearest pixel (SEAM_START).
interface StripSeams {
  readonly mask: Uint8Array;
  readonly rows: Uint8Array;
  readonly starts: Uint8Array;
}

const SEAM_PIXEL = 1;
const SEAM_START = 2;

export function stripSeams(strip: PixelImage): StripSeams {
  const { height, pixels, width } = strip;
  const base = mostCommon(pixels);
  const across = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const pixel = pixels[y * width + x];
      let run = 1;
      while (x + run < width && pixels[y * width + x + run] === pixel) {
        run += 1;
      }
      if (pixel !== base && run >= LINE_RUN) {
        across.fill(1, y * width + x, y * width + x + run);
      }
      x += run;
    }
  }
  const mask = new Uint8Array(width * height);
  const starts = new Uint8Array(width * height);
  const rows = new Uint8Array(height);
  const at = (x: number, y: number) => (((y % height) + height) % height) * width + x;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pixel = pixels[at(x, y)];
      // A seam starts on a row whose pixel above is not the same seam; a column all one seam
      // colour has no start, and is a line along the road.
      if (
        across[at(x, y)] !== 1 ||
        (across[at(x, y - 1)] === 1 && pixels[at(x, y - 1)] === pixel)
      ) {
        continue;
      }
      let run = 1;
      while (run < height && across[at(x, y + run)] === 1 && pixels[at(x, y + run)] === pixel) {
        run += 1;
      }
      if (run >= LINE_RUN) {
        continue;
      }
      for (let k = 0; k < run; k++) {
        mask[at(x, y + k)] = 1;
        rows[(y + k) % height] = (rows[(y + k) % height] ?? 0) | SEAM_PIXEL;
      }
      const nearest = (y + run - 1) % height;
      starts[nearest * width + x] = run;
      rows[nearest] = (rows[nearest] ?? 0) | SEAM_START;
    }
  }
  return { mask, rows, starts };
}

// A strip of one colour, for a zone whose art is missing.
export function solidStrip(rgb: number): PixelImage {
  const pixels = new Uint32Array(STRIP.width * STRIP.height).fill(pixelWord(rgb));
  return { ...STRIP, pixels };
}

function levelFor(span: number): 0 | 1 | 2 {
  if (span <= LEVEL_SPAN) {
    return 0;
  }
  return span <= 2 * LEVEL_SPAN ? 1 : 2;
}

// The per-row tables for drawing the road into view, which must lie below the horizon. The
// view's rows above approachY are the junction's.
export function roadRaster(
  projection: Pick<
    RoadProjection,
    "centreX" | "farY" | "focal" | "footY" | "horizonY" | "visibleDistance"
  >,
  approachY: number,
  view: Rect,
): RoadRaster {
  const rows: RasterRow[] = [];
  const { centreX } = projection;
  const left = centreX - STRIP.width / 2;
  for (let y = view.y; y < view.y + view.height; y++) {
    const scale = rowScale(projection, y);
    const distance = distanceAtY(projection, y + 0.5);
    const span = distance - distanceAtY(projection, y + 1.5);
    const roadX = new Int16Array(view.width);
    const roadXFrom = new Int16Array(view.width);
    const roadXTo = new Int16Array(view.width);
    const across = new Float32Array(view.width);
    for (let i = 0; i < view.width; i++) {
      const x = roadXAt(projection, scale, view.x + i + 0.5);
      roadX[i] = Math.floor(x);
      roadXFrom[i] = Math.ceil(roadXAt(projection, scale, view.x + i));
      roadXTo[i] = Math.ceil(roadXAt(projection, scale, view.x + i + 1)) - 1;
      const onStrip = x >= left && x < left + STRIP.width;
      across[i] = onStrip ? -1 : Math.abs(x - centreX);
    }
    const roadStart = across.findIndex((value) => value < 0);
    // The strip's columns are one run, as the projection keeps order across a row.
    const roadEnd = Math.max(0, roadStart) + across.filter((value) => value < 0).length;
    rows.push({
      across,
      below: distanceAtY(projection, y + 1.5),
      distance,
      dotLevel: Math.max(0, Math.ceil(Math.log2(span))),
      far: distanceAtY(projection, y),
      leafLimit: markLimit("leaf", scale, span),
      level: levelFor(span),
      lineColumns: new Map(),
      near: distanceAtY(projection, y + 1),
      reach: Math.max(0, across[0] ?? 0, across[view.width - 1] ?? 0),
      roadEnd,
      roadStart: Math.max(0, roadStart),
      roadX,
      roadXFrom,
      roadXTo,
      scale,
      span,
      splits: new Map(),
      tuftLimit: markLimit("tuft", scale, span),
    });
  }
  return {
    approachRows: Math.min(view.height, Math.max(0, projection.farY - view.y)),
    centreX,
    junctionRows: Math.min(view.height, Math.max(0, approachY - view.y)),
    marks: new Map(),
    patches: new Map(),
    rows,
    scratch: {
      carried: [carriedBuffer(), carriedBuffer()],
      lineRows: new Int32Array(STRIP.height),
      marked: new Uint8Array(view.width),
    },
    verges: new Map(),
    view,
    visibleDistance: projection.visibleDistance,
  };
}

const words = new Map<number, number>();
function wordOf(rgb: number): number {
  let word = words.get(rgb);
  if (word === undefined) {
    word = pixelWord(rgb);
    words.set(rgb, word);
  }
  return word;
}

const LEAF_WORDS = LEAF_PIXELS.map((rows) =>
  rows.map((cells) => cells.map(({ colour, dx }) => ({ dx, word: wordOf(colour) }))),
);
const NO_LEAF: readonly { dx: number; word: number }[] = [];

// The colour words the verge draws over its base from across from to to (excluded): seams,
// dots, a rough lawn's patches, tufts and leaves.
interface VergeDetail {
  readonly from: number;
  readonly to: number;
  readonly words: ReadonlySet<number>;
}

// What each zone's verge draws per frame, looked up once a row: where its sidewalk or paving
// starts, its seam word, and its dotted bands, each with the colour word every noise byte
// picks (0 for none).
interface VergePlan {
  readonly details: readonly VergeDetail[];
  readonly dots: readonly {
    readonly from: number;
    readonly to: number;
    readonly words: Uint32Array;
  }[];
  // The least across each kind of mark may lie at (markFrom).
  readonly leafFrom: number;
  // The lawn's patch word, and its tuft word by each lawn word it falls on; none with no lawn.
  readonly patchWord: number;
  readonly seamWord: number;
  readonly tuftFrom: number;
  readonly tuftWords: ReadonlyMap<number, number>;
  readonly walkFrom: number;
}

const NOISE_STEPS = 256;

function vergePlan(verge: Verge): VergePlan {
  const lawn = verge.lawnColours;
  const dots = dottedBands(verge).map(({ dots: bandDots, from, to }) => ({
    from,
    to,
    words: Uint32Array.from({ length: NOISE_STEPS }, (_, n) => {
      const rgb = dotColour(bandDots, (n + 0.5) / NOISE_STEPS);
      return rgb === null ? 0 : wordOf(rgb);
    }),
  }));
  const leafFrom = markFrom(verge, "leaf");
  const patchWord = lawn === null ? 0 : wordOf(lawn[1]);
  const seamWord = wordOf(verge.seamColour);
  const tuftFrom = markFrom(verge, "tuft");
  const tuftWords = new Map(
    lawn === null ? [] : [lawn[0], lawn[1]].map((rgb) => [wordOf(rgb), wordOf(lawn[2])]),
  );
  const from = walkFrom(verge);
  const details: VergeDetail[] = [
    { from, to: verge.walkTo, words: new Set([seamWord]) },
    ...dots.map((band) => ({ ...band, words: new Set([...band.words].filter((w) => w !== 0)) })),
    { from: tuftFrom, to: Infinity, words: new Set([...tuftWords.values()]) },
    { from: leafFrom, to: Infinity, words: new Set(LEAF_WORDS.flat(2).map(({ word }) => word)) },
  ];
  if (verge.lawn === "rough") {
    details.push({ from: verge.walkTo, to: Infinity, words: new Set([patchWord]) });
  }
  return {
    details: details.filter((detail) => detail.to > detail.from && detail.words.size > 0),
    dots,
    leafFrom,
    patchWord,
    seamWord,
    tuftFrom,
    tuftWords,
    walkFrom: from,
  };
}

// Whether the verge draws this word over its base at across.
function isVergeDetail(plan: VergePlan, across: number, word: number): boolean {
  for (const { from, to, words } of plan.details) {
    if (across >= from && across < to && words.has(word)) {
      return true;
    }
  }
  return false;
}

// Each zone's verge, looked up by a Map: a keyed property read by a zone id string that V8
// has not seen there deoptimizes drawRoad.
const VERGE_BY_ZONE: ReadonlyMap<string, Verge> = new Map(Object.entries(VERGES));
function vergeAt(zone: ZoneId): Verge {
  return VERGE_BY_ZONE.get(zone) ?? VERGES[zone];
}

const plans = new Map<Verge, VergePlan>();
function planOf(verge: Verge): VergePlan {
  let plan = plans.get(verge);
  if (plan === undefined) {
    plan = vergePlan(verge);
    plans.set(verge, plan);
  }
  return plan;
}

// Where the verge reaches threshold across on each side of a row's road: the first column
// nearer than it on the left, and the first as far or farther on the right.
function splitAt(row: RasterRow, threshold: number): readonly [number, number] {
  let split = row.splits.get(threshold);
  if (split === undefined) {
    let left = 0;
    while (left < row.roadStart && (row.across[left] ?? 0) >= threshold) {
      left += 1;
    }
    let right = row.roadEnd;
    while (right < row.across.length && (row.across[right] ?? 0) < threshold) {
      right += 1;
    }
    split = [left, right];
    row.splits.set(threshold, split);
  }
  return split;
}

function vergeOf(raster: RoadRaster, zone: ZoneId): Uint32Array {
  const drawn = raster.verges.get(zone);
  if (drawn !== undefined) {
    return drawn;
  }
  const verge = vergeAt(zone);
  const { width } = raster.view;
  const pixels = new Uint32Array(width * raster.rows.length);
  raster.rows.forEach((row, y) => {
    for (let i = 0; i < width; i++) {
      const across = row.across[i] ?? -1;
      pixels[y * width + i] = across < 0 ? 0 : wordOf(vergeBase(verge, across, row.scale));
    }
  });
  raster.verges.set(zone, pixels);
  return pixels;
}

// The raster's caches grow with the road; past this many entries the oldest goes, so the rows
// in view stay cached rather than all being made again in one frame.
const CACHE_LIMIT = 4096;

function cached<T>(cache: Map<number, T>, key: number, make: (key: number) => T): T {
  let value = cache.get(key);
  if (value === undefined) {
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next();
      if (oldest.done !== true) {
        cache.delete(oldest.value);
      }
    }
    value = make(key);
    cache.set(key, value);
  }
  return value;
}

// The pixels of marks' lower rows, drawn on the row below the one they start on: each one's
// column and the colour word to draw, or TUFT to tuft the lawn.
const TUFT = -1;
const CARRIED_MAX = 1024;

interface Carried {
  count: number;
  readonly columns: Int16Array;
  readonly words: Float64Array;
}

function carriedBuffer(): Carried {
  return {
    columns: new Int16Array(CARRIED_MAX),
    count: 0,
    words: new Float64Array(CARRIED_MAX),
  };
}

function carry(carried: Carried, column: number, word: number): void {
  if (carried.count < CARRIED_MAX) {
    carried.columns[carried.count] = column;
    carried.words[carried.count] = word;
    carried.count += 1;
  }
}

// Draws a mark pixel where the verge takes it and no other mark has drawn on this row, so a
// tuft marks the lawn once. word is TUFT, or a leaf's colour word.
function markPixel(
  out: Uint32Array,
  marked: Uint8Array,
  row: RasterRow,
  verge: Verge,
  offset: number,
  column: number,
  word: number,
): void {
  if (column < 0 || column >= row.across.length || marked[column] === 1) {
    return;
  }
  if (!markFits(verge, word === TUFT ? "tuft" : "leaf", row.across[column] ?? -1)) {
    return;
  }
  marked[column] = 1;
  const at = offset + column;
  if (word !== TUFT) {
    out[at] = word;
    return;
  }
  const tuft = planOf(verge).tuftWords.get(out[at] ?? 0);
  if (tuft !== undefined) {
    out[at] = tuft;
  }
}

// Draws one frame of the road into out, view.width by view.height, row by row: the strip's
// columns copied from the row's strip row with its lines kept, the verge copied from the
// zone's, then the seams, rough patches and 2-row marks that scroll with the road. On the
// approach rows the verge shows only where the backdrop's own pixel is the verge's.
export function drawRoad(raster: RoadRaster, frame: RoadFrame, out: Uint32Array): void {
  const { centreX, rows, view } = raster;
  const stripLeft = centreX - STRIP.width / 2;
  const { width } = view;
  const scratch = raster.scratch;
  let carried = scratch.carried[0];
  let next = scratch.carried[1];
  carried.count = 0;
  const { marked } = scratch;
  // Strip rows count down the road from the start strip's far end.
  const lineStart = frame.scroll - frame.zoneStart - raster.visibleDistance;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row === undefined) {
      continue;
    }
    const z = frame.scroll + row.distance;
    const along = Math.floor(z - frame.zoneStart - raster.visibleDistance);
    const look = lookAt(frame, along);
    const stripRow = stripRowAt(along);
    // Below its own zone's rows, the start strip is a cross street that follows the previous
    // zone: the verge beside it is the previous zone's.
    const vergeZone =
      look === frame.transition?.start && stripRow >= START_STRIP_ZONE_ROWS
        ? frame.transition.previous.zone
        : look.zone;
    const verge = vergeAt(vergeZone);
    const offset = y * width;
    const vergePixels = vergeOf(raster, vergeZone);
    const { roadEnd, roadStart, roadX } = row;
    // The strip covers its columns, so only the verge's either side are copied.
    for (let i = 0; i < roadStart; i++) {
      out[offset + i] = vergePixels[offset + i] ?? 0;
    }
    for (let i = roadEnd; i < width; i++) {
      out[offset + i] = vergePixels[offset + i] ?? 0;
    }

    const image = look.strip[row.level];
    const pixels = image.pixels;
    // Whole, so the strip is indexed with integers.
    const rowStart = ((stripRow >> row.level) * image.width - stripLeft) | 0;
    for (let i = roadStart; i < roadEnd; i++) {
      out[offset + i] = pixels[rowStart + (roadX[i] ?? 0)] ?? 0;
    }
    // The shrunk strips leave seams out, so draw those on the row's strip row.
    if (row.level > 0 && look.seams !== undefined) {
      drawSeams(out, offset, row, look, stripLeft, stripRow, look.seams.mask, SEAM_PIXEL);
    }
    // The seams wholly between this row's strip row and the row below's, which no row samples.
    const below = Math.floor(frame.scroll + row.below - frame.zoneStart - raster.visibleDistance);
    for (let k = Math.max(below + 1, along - STRIP.height); k < along; k++) {
      const skipped = lookAt(frame, k);
      if (skipped.seams !== undefined) {
        drawSeams(
          out,
          offset,
          row,
          skipped,
          stripLeft,
          stripRowAt(k),
          skipped.seams.starts,
          SEAM_START,
          along - k + 1,
        );
      }
    }
    if (look.lines !== undefined) {
      const first = Math.floor(lineStart + row.near);
      const last = Math.max(first, Math.ceil(lineStart + row.far) - 1);
      drawLines(
        out,
        offset,
        row,
        look.strip[0],
        look.lines,
        stripLeft,
        first,
        last,
        scratch.lineRows,
      );
    }

    const plan = planOf(verge);
    const { dots } = plan;
    if (dots.length > 0) {
      // Each dot holds a cell of road at least as long as the row's span, so it moves down
      // with the road rather than reshuffle on rows that cover more road than they show.
      const seed = Math.floor(z) >> row.dotLevel;
      for (let d = 0; d < dots.length; d++) {
        const band = dots[d];
        if (band === undefined) {
          continue;
        }
        const from = splitAt(row, band.from);
        const to = splitAt(row, band.to);
        drawDots(out, offset, roadX, seed, band.words, to[0], from[0]);
        drawDots(out, offset, roadX, seed, band.words, from[1], to[1]);
      }
    }

    if (verge.walkTo > plan.walkFrom && seamRow(verge, z, row.span)) {
      const inner = splitAt(row, plan.walkFrom);
      const walk = splitAt(row, verge.walkTo);
      out.fill(plan.seamWord, offset + walk[0], offset + inner[0]);
      out.fill(plan.seamWord, offset + inner[1], offset + walk[1]);
    }

    if (verge.lawn === "rough") {
      drawPatches(raster, row, verge, z, offset, out);
    }

    marked.fill(0);
    for (let j = 0; j < carried.count; j++) {
      const column = carried.columns[j] ?? 0;
      markPixel(out, marked, row, verge, offset, column, carried.words[j] ?? TUFT);
    }
    next.count = 0;
    // A kind the row has no room for draws nothing, so its marks are not looked at.
    const tuftLimit = row.reach >= plan.tuftFrom ? row.tuftLimit : 0;
    const leafLimit = row.reach >= plan.leafFrom ? row.leafLimit : 0;
    const lastK = tuftLimit > 0 || leafLimit > 0 ? Math.floor(z) : Number.NEGATIVE_INFINITY;
    for (let k = Math.floor(z - row.span) + 1; k <= lastK; k++) {
      const marks = cached(raster.marks, k, marksOnRow);
      for (const mark of marks.tuft) {
        if (mark.keep >= tuftLimit) {
          break;
        }
        const column = Math.floor(centreX + mark.x * row.scale) - view.x;
        markPixel(out, marked, row, verge, offset, column, TUFT);
        carry(next, column, TUFT);
      }
      for (const mark of marks.leaf) {
        if (mark.keep >= leafLimit) {
          break;
        }
        const column = Math.floor(centreX + mark.x * row.scale) - view.x;
        const shape = LEAF_WORDS[mark.shape];
        for (const { dx, word } of shape?.[0] ?? NO_LEAF) {
          markPixel(out, marked, row, verge, offset, column + dx, word);
        }
        for (const { dx, word } of shape?.[1] ?? NO_LEAF) {
          carry(next, column + dx, word);
        }
      }
    }
    const swap = carried;
    carried = next;
    next = swap;
    if (y < raster.junctionRows) {
      out.fill(0, offset, offset + roadStart);
      out.fill(0, offset + roadEnd, offset + width);
    } else if (y < raster.approachRows) {
      keepBackdropVerge(frame.approach ?? null, row, vergePixels, plan, offset, out);
    }
  }
}

// The look a strip row along the road shows: while a start strip rolls in, the previous zone's
// road lies on its near side.
function lookAt(frame: RoadFrame, along: number): RoadLook {
  if (frame.transition === null || along >= STRIP.height) {
    return frame.current;
  }
  return along >= 0 ? frame.transition.start : frame.transition.previous;
}

// The strip row a row along the road shows: strip rows count down the road from the strip's far
// end.
function stripRowAt(along: number): number {
  return (((STRIP.height - 1 - along) % STRIP.height) + STRIP.height) % STRIP.height;
}

// Draws a strip row's seam pixels on a screen row, from the full-size strip: the columns whose
// road x has a mark under fits. For a strip row no row samples, marks are its seam starts and
// fits the strip rows up to the row's own, so only the seams that end before it draw; the row's
// own strip row shows the rest.
function drawSeams(
  out: Uint32Array,
  offset: number,
  row: RasterRow,
  look: RoadLook,
  stripLeft: number,
  stripRow: number,
  marks: Uint8Array,
  flag: number,
  fits = 256,
): void {
  if (((look.seams?.rows[stripRow] ?? 0) & flag) === 0) {
    return;
  }
  const { pixels, width } = look.strip[0];
  const rowStart = (stripRow * width - stripLeft) | 0;
  const { roadEnd, roadX } = row;
  for (let i = row.roadStart; i < roadEnd; i++) {
    const at = rowStart + (roadX[i] ?? 0);
    const mark = marks[at] ?? 0;
    if (mark > 0 && mark < fits) {
      out[offset + i] = pixels[at] ?? 0;
    }
  }
}

// Clears an approach row's verge, for the backdrop under it to show, wherever the backdrop's
// own pixel is not the verge's, its base or a detail it draws there: its corners and fences
// stand still, while its sidewalks and lawns carry the verge's moving detail in place of the
// backdrop's still seams, dots and marks. With no backdrop, the whole verge clears.
function keepBackdropVerge(
  approach: Uint32Array | null,
  row: RasterRow,
  verge: Uint32Array,
  plan: VergePlan,
  offset: number,
  out: Uint32Array,
): void {
  for (let i = 0; i < row.across.length; i++) {
    const at = offset + i;
    const across = row.across[i] ?? -1;
    if (across < 0) {
      continue;
    }
    const pixel = approach?.[at];
    if (pixel === undefined || (pixel !== verge[at] && !isVergeDetail(plan, across, pixel))) {
      out[at] = 0;
    }
  }
}

// Keeps the strip's lines on a row: a column whose share of the road holds a line pixel on any
// strip row from first to last (counted down the road, as along) draws it, so a line thinner
// than a column or shorter than the row's span still shows, and moves with the road.
function drawLines(
  out: Uint32Array,
  offset: number,
  row: RasterRow,
  strip: PixelImage,
  lines: StripLines,
  stripLeft: number,
  first: number,
  last: number,
  lineRows: Int32Array,
): void {
  const { height, pixels, width } = strip;
  const { mask } = lines;
  // Each strip row's start in the strip, nearest first; a block longer than the strip covers
  // all of it.
  const count = Math.min(last - first + 1, height, lineRows.length);
  for (let n = 0; n < count; n++) {
    const along = first + n;
    lineRows[n] = ((((height - 1 - along) % height) + height) % height) * width;
  }
  const columns = lineColumnsOf(row, lines, width, stripLeft);
  for (let c = 0; c < columns.length; c += 3) {
    const from = columns[c + 1] ?? 0;
    const to = columns[c + 2] ?? 0;
    let at = -1;
    for (let n = 0; n < count && at < 0; n++) {
      const start = lineRows[n] ?? 0;
      for (let x = from; x <= to; x++) {
        if (mask[start + x] === 1) {
          at = start + x;
          break;
        }
      }
    }
    if (at >= 0) {
      out[offset + (columns[c] ?? 0)] = pixels[at] ?? 0;
    }
  }
}

// The row's columns whose share of the strip holds a line column, each as its column and the
// first and last strip columns of its share, flat.
function lineColumnsOf(
  row: RasterRow,
  lines: StripLines,
  width: number,
  stripLeft: number,
): Int16Array {
  let columns = row.lineColumns.get(lines);
  if (columns === undefined) {
    const found: number[] = [];
    for (let i = row.roadStart; i < row.roadEnd; i++) {
      const centre = (row.roadX[i] ?? 0) - stripLeft;
      let from = Math.max(0, (row.roadXFrom[i] ?? 0) - stripLeft);
      let to = Math.min(width - 1, (row.roadXTo[i] ?? 0) - stripLeft);
      if (from > to) {
        from = centre;
        to = centre;
      }
      for (let x = from; x <= to; x++) {
        if (lines.columns[x] === 1) {
          found.push(i, from, to);
          break;
        }
      }
    }
    columns = Int16Array.from(found);
    row.lineColumns.set(lines, columns);
  }
  return columns;
}

// A dotted band's columns from to to (excluded) on a row: each pixel's noise, seeded on its
// road x and the row's noise row, picks its dot word, if any.
function drawDots(
  out: Uint32Array,
  offset: number,
  roadX: Int16Array,
  seed: number,
  words: Uint32Array,
  from: number,
  to: number,
): void {
  for (let i = from; i < to; i++) {
    const word = words[(noise(roadX[i] ?? 0, seed) * NOISE_STEPS) | 0] ?? 0;
    if (word !== 0) {
      out[offset + i] = word;
    }
  }
}

// The rough patches on an unmown lawn: each one's chord across this row, in its mark colour.
function drawPatches(
  raster: RoadRaster,
  row: RasterRow,
  verge: Verge,
  z: number,
  offset: number,
  out: Uint32Array,
): void {
  const { centreX, view } = raster;
  const { patchWord } = planOf(verge);
  // The blocks whose patches reach z.
  const first = Math.floor((z - ROUGH_PATCH_REACH) / ROUGH_PATCH_BLOCK);
  const last = Math.floor((z + ROUGH_PATCH_REACH) / ROUGH_PATCH_BLOCK);
  for (let block = first; block <= last; block++) {
    for (const patch of cached(raster.patches, block, roughPatches)) {
      const along = (z - patch.z) / patch.rz;
      if (Math.abs(along) >= 1) {
        continue;
      }
      const half = patch.rx * Math.sqrt(1 - along * along);
      const from = Math.ceil(centreX + (patch.x - half) * row.scale - 0.5) - view.x;
      const to = Math.ceil(centreX + (patch.x + half) * row.scale - 0.5) - view.x;
      for (let i = Math.max(0, from); i < Math.min(view.width, to); i++) {
        if (markFits(verge, "tuft", row.across[i] ?? -1)) {
          out[offset + i] = patchWord;
        }
      }
    }
  }
}
