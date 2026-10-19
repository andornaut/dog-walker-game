import type { ZoneId } from "../data/types";
import { distanceAtY, type RoadProjection, roadXAt, rowScale } from "./projection";
import type { Rect } from "./rect";
import {
  darkerGreen,
  LEAF_PIXELS,
  markFits,
  markFrom,
  markLimit,
  marksOnRow,
  ROUGH_PATCH_BLOCK,
  ROUGH_PATCH_REACH,
  type RoughPatch,
  roughPatches,
  type RowMarks,
  SEAM_COLOR,
  seamRow,
  type Verge,
  vergeBase,
  type VergeMark,
  VERGES,
} from "./roadside";

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
export type StripLevels = readonly [PixelImage, PixelImage, PixelImage];

// The road x of each screen column, floored, and how far its centre is from the centre line,
// or -1 on the strip, which covers columns roadStart to roadEnd (excluded). splits caches
// verge edges by across.
export interface RasterRow {
  readonly across: Float32Array;
  readonly distance: number;
  readonly level: 0 | 1 | 2;
  // The farthest across the row shows, at its outer columns.
  readonly reach: number;
  readonly roadEnd: number;
  readonly roadStart: number;
  readonly roadX: Int16Array;
  readonly scale: number;
  readonly span: number;
  readonly splits: Map<number, readonly [number, number]>;
}

// verges holds each zone's verge before seams, patches and marks, drawn once; marks and
// patches cache what the road rows and blocks in view hold. The first approachRows rows lie
// past the far edge of the road in view, on the backdrop's approach to its cross street:
// they draw only the road surface, leaving the backdrop's verge beside it.
export interface RoadRaster {
  readonly approachRows: number;
  readonly centerX: number;
  readonly marks: Map<number, RowMarks>;
  readonly patches: Map<number, readonly RoughPatch[]>;
  readonly rows: readonly RasterRow[];
  readonly verges: Map<ZoneId, Uint32Array>;
  // Scratch space drawRoad reuses frame to frame: marks carried to the next row, and the
  // columns a mark has drawn on in this row.
  readonly scratch: { carried: [Carried, Carried]; marked: Uint8Array };
  readonly view: Rect;
  readonly visibleDistance: number;
}

// A zone's look: its strip and the zone whose verge goes beside it.
export interface RoadLook {
  readonly strip: StripLevels;
  readonly zone: ZoneId;
}

// zoneStart is the scroll at which the current zone began. While its start strip rolls in, it
// lies just past the far edge of the road in view at zoneStart, with the previous zone's road
// on the near side of it. fade, when set, is the backdrop's bottom row across the view, which
// the far rows dissolve into.
export interface RoadFrame {
  readonly current: RoadLook;
  readonly fade: Uint32Array | null;
  readonly scroll: number;
  readonly transition: { readonly previous: RoadLook; readonly start: RoadLook } | null;
  readonly zoneStart: number;
}

export const STRIP = { height: 64, width: 280 } as const;
// A start strip's far rows are its zone's road; the rest, a cross street, then the previous
// zone's road below it.
export const START_STRIP_ZONE_ROWS = 20;
// Rough patches are drawn in the lawn's darker green, from blocks of road PATCH_BLOCK long
// whose patches reach PATCH_REACH either side.
const PATCH_BLOCK = ROUGH_PATCH_BLOCK;
const PATCH_REACH = ROUGH_PATCH_REACH;
const PATCH_COLOR = 0x3e8948;
// Rows covering more than this much road per strip row step down a level.
const LEVEL_SPAN = 2;
// The far rows dithered into the band when the fade is on.
export const FADE_ROWS = 12;
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

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
// palette, and a far row shows the road's base rather than a speckle that blinks.
export function shrinkRows(factor: number, image: PixelImage): PixelImage {
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
        const pixel = image.pixels[(row * factor + k) * width + x] ?? 0;
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

export function stripLevels(strip: PixelImage): StripLevels {
  return [strip, shrinkRows(2, strip), shrinkRows(4, strip)];
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

// The per-row tables for drawing the road into view, which must lie below the horizon.
export function roadRaster(
  projection: Pick<
    RoadProjection,
    "centerX" | "farY" | "focal" | "footY" | "horizonY" | "visibleDistance"
  >,
  view: Rect,
): RoadRaster {
  const rows: RasterRow[] = [];
  const { centerX } = projection;
  const left = centerX - STRIP.width / 2;
  for (let y = view.y; y < view.y + view.height; y++) {
    const scale = rowScale(projection, y);
    const distance = distanceAtY(projection, y + 0.5);
    const span = distance - distanceAtY(projection, y + 1.5);
    const roadX = new Int16Array(view.width);
    const across = new Float32Array(view.width);
    for (let i = 0; i < view.width; i++) {
      const x = roadXAt(projection, scale, view.x + i + 0.5);
      roadX[i] = Math.floor(x);
      const onStrip = x >= left && x < left + STRIP.width;
      across[i] = onStrip ? -1 : Math.abs(x - centerX);
    }
    const roadStart = across.findIndex((value) => value < 0);
    // The strip's columns are one run, as the projection keeps order across a row.
    const roadEnd = Math.max(0, roadStart) + across.filter((value) => value < 0).length;
    rows.push({
      across,
      distance,
      level: levelFor(span),
      reach: Math.max(0, across[0] ?? 0, across[view.width - 1] ?? 0),
      roadEnd,
      roadStart: Math.max(0, roadStart),
      roadX,
      scale,
      span,
      splits: new Map(),
    });
  }
  return {
    approachRows: Math.min(view.height, Math.max(0, projection.farY - view.y)),
    centerX,
    marks: new Map(),
    patches: new Map(),
    rows,
    scratch: { carried: [carriedBuffer(), carriedBuffer()], marked: new Uint8Array(view.width) },
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

// The lawn's greens as pixel words, each to the next darker one.
const GREENS = [0x63c74d, 0x3e8948];
const darkerWords = new Map(GREENS.map((rgb) => [wordOf(rgb), wordOf(darkerGreen(rgb))]));

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
  const verge = VERGES[zone];
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

// The raster's caches grow with the road; past this many entries they start again.
const CACHE_LIMIT = 4096;

function cached<T>(cache: Map<number, T>, key: number, make: (key: number) => T): T {
  let value = cache.get(key);
  if (value === undefined) {
    if (cache.size >= CACHE_LIMIT) {
      cache.clear();
    }
    value = make(key);
    cache.set(key, value);
  }
  return value;
}

// The pixels of marks' lower rows, drawn on the row below the one they start on: each one's
// column and the colour word to draw, or TUFT to darken the lawn.
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
// tuft darkens the lawn once. word is TUFT, or a leaf's colour word.
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
  const darker = darkerWords.get(out[at] ?? 0);
  if (darker !== undefined) {
    out[at] = darker;
  }
}

// Draws one frame of the road into out, view.width by view.height, row by row: the strip's
// columns copied from the row's strip row, the verge copied from the zone's, then the seams,
// rough patches and 2-row marks that scroll with the road.
export function drawRoad(raster: RoadRaster, frame: RoadFrame, out: Uint32Array): void {
  const { centerX, view } = raster;
  const stripLeft = centerX - STRIP.width / 2;
  const { width } = view;
  let [carried, next] = raster.scratch.carried;
  carried.count = 0;
  const { marked } = raster.scratch;
  raster.rows.forEach((row, y) => {
    const z = frame.scroll + row.distance;
    // Strip rows count down the road from the start strip's far end.
    const along = Math.floor(z - frame.zoneStart - raster.visibleDistance);
    const look =
      frame.transition === null || along >= STRIP.height
        ? frame.current
        : along >= 0
          ? frame.transition.start
          : frame.transition.previous;
    const stripRow = (((STRIP.height - 1 - along) % STRIP.height) + STRIP.height) % STRIP.height;
    // Below its own zone's rows, the start strip is a cross street that follows the previous
    // zone: the verge beside it is the previous zone's.
    const vergeZone =
      look === frame.transition?.start && stripRow >= START_STRIP_ZONE_ROWS
        ? frame.transition.previous.zone
        : look.zone;
    const verge = VERGES[vergeZone];
    const offset = y * width;
    const approach = y < raster.approachRows;
    if (approach) {
      out.fill(0, offset, offset + width);
    } else {
      out.set(vergeOf(raster, vergeZone).subarray(offset, offset + width), offset);
    }

    const image = look.strip[row.level];
    const pixels = image.pixels;
    const rowStart = (stripRow >> row.level) * image.width - stripLeft;
    const { roadEnd, roadStart, roadX } = row;
    for (let i = roadStart; i < roadEnd; i++) {
      out[offset + i] = pixels[rowStart + (roadX[i] ?? 0)] ?? 0;
    }
    if (approach) {
      fadeRow(frame.fade, view.x, y, offset, out);
      return;
    }

    if (verge.walkTo > verge.curbTo && seamRow(z, row.span)) {
      const [curbLeft, curbRight] = splitAt(row, verge.curbTo);
      const [walkLeft, walkRight] = splitAt(row, verge.walkTo);
      out.fill(wordOf(SEAM_COLOR), offset + walkLeft, offset + curbLeft);
      out.fill(wordOf(SEAM_COLOR), offset + curbRight, offset + walkRight);
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
    const limit = (kind: VergeMark["kind"]) =>
      row.reach >= markFrom(verge, kind) ? markLimit(kind, row.scale, row.span) : 0;
    const tuftLimit = limit("tuft");
    const leafLimit = limit("leaf");
    const lastK = tuftLimit > 0 || leafLimit > 0 ? Math.floor(z) : Number.NEGATIVE_INFINITY;
    for (let k = Math.floor(z - row.span) + 1; k <= lastK; k++) {
      const marks = cached(raster.marks, k, marksOnRow);
      for (const mark of marks.tuft) {
        if (mark.keep >= tuftLimit) {
          break;
        }
        const column = Math.floor(centerX + mark.x * row.scale) - view.x;
        markPixel(out, marked, row, verge, offset, column, TUFT);
        carry(next, column, TUFT);
      }
      for (const mark of marks.leaf) {
        if (mark.keep >= leafLimit) {
          break;
        }
        const column = Math.floor(centerX + mark.x * row.scale) - view.x;
        const [upper = [], lower = []] = LEAF_PIXELS[mark.shape] ?? [];
        for (const { color, dx } of upper) {
          markPixel(out, marked, row, verge, offset, column + dx, wordOf(color));
        }
        for (const { color, dx } of lower) {
          carry(next, column + dx, wordOf(color));
        }
      }
    }
    [carried, next] = [next, carried];
    fadeRow(frame.fade, view.x, y, offset, out);
  });
}

// The far rows' drawn pixels dithered into the band's bottom row, when the fade is on.
function fadeRow(
  fade: Uint32Array | null,
  x: number,
  y: number,
  offset: number,
  out: Uint32Array,
): void {
  if (fade === null || y >= FADE_ROWS) {
    return;
  }
  for (let i = 0; i < fade.length; i++) {
    if (out[offset + i] !== 0 && fadeCovers(x + i, y)) {
      out[offset + i] = fade[i] ?? 0;
    }
  }
}

// The rough patches on an unmown lawn: each one's chord across this row, in the darker green.
function drawPatches(
  raster: RoadRaster,
  row: RasterRow,
  verge: Verge,
  z: number,
  offset: number,
  out: Uint32Array,
): void {
  const { centerX, view } = raster;
  const first = Math.floor((z - PATCH_REACH) / PATCH_BLOCK);
  const last = Math.floor((z + PATCH_REACH) / PATCH_BLOCK);
  for (let block = first; block <= last; block++) {
    for (const patch of cached(raster.patches, block, roughPatches)) {
      const along = (z - patch.z) / patch.rz;
      if (Math.abs(along) >= 1) {
        continue;
      }
      const half = patch.rx * Math.sqrt(1 - along * along);
      const from = Math.ceil(centerX + (patch.x - half) * row.scale - 0.5) - view.x;
      const to = Math.ceil(centerX + (patch.x + half) * row.scale - 0.5) - view.x;
      for (let i = Math.max(0, from); i < Math.min(view.width, to); i++) {
        if (markFits(verge, "tuft", row.across[i] ?? -1)) {
          out[offset + i] = wordOf(PATCH_COLOR);
        }
      }
    }
  }
}

// Ordered dither: the share of a far row given over to the band grows toward the band.
export function fadeCovers(x: number, row: number): boolean {
  const share = (FADE_ROWS - row - 0.5) / FADE_ROWS;
  const threshold = ((BAYER_4[(row & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
  return threshold < share;
}
