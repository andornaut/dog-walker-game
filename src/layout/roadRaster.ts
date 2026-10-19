import type { ZoneId } from "../data/types";
import { distanceAtY, type RoadProjection, roadXAt, rowScale } from "./projection";
import type { Rect } from "./rect";
import { hasLeaves, leafAt, VERGE_EDGES, vergeColors } from "./roadside";

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

// The road x of each screen column, floored, and how far it is from the centre line; the
// strip covers columns roadStart to roadEnd (excluded). splits caches verge edges by across.
export interface RasterRow {
  readonly across: Int16Array;
  readonly distance: number;
  readonly level: 0 | 1 | 2;
  readonly roadEnd: number;
  readonly roadStart: number;
  readonly roadX: Int16Array;
  readonly span: number;
  readonly splits: Map<number, readonly [number, number]>;
}

export interface RoadRaster {
  readonly centerX: number;
  readonly rows: readonly RasterRow[];
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

// The per-row tables for drawing the road into view, which must lie in the road's rows.
export function roadRaster(
  projection: Pick<RoadProjection, "centerX" | "focal" | "footY" | "horizonY" | "visibleDistance">,
  view: Rect,
): RoadRaster {
  const rows: RasterRow[] = [];
  const left = projection.centerX - STRIP.width / 2;
  for (let y = view.y; y < view.y + view.height; y++) {
    const scale = rowScale(projection, y);
    const distance = distanceAtY(projection, y + 0.5);
    const span = distance - distanceAtY(projection, y + 1.5);
    const roadX = new Int16Array(view.width);
    const across = new Int16Array(view.width);
    for (let i = 0; i < view.width; i++) {
      const x = Math.floor(roadXAt(projection, scale, view.x + i + 0.5));
      roadX[i] = x;
      across[i] = x < projection.centerX ? projection.centerX - 1 - x : x - projection.centerX;
      if (x >= left && x < left + STRIP.width) {
        across[i] = -1;
      }
    }
    const roadStart = across.findIndex((value) => value < 0);
    // The strip's columns are one run, as the projection keeps order across a row.
    const roadEnd = Math.max(0, roadStart) + across.filter((value) => value < 0).length;
    rows.push({
      across,
      distance,
      level: levelFor(span),
      roadEnd,
      roadStart: Math.max(0, roadStart),
      roadX,
      span,
      splits: new Map(),
    });
  }
  return { centerX: projection.centerX, rows, view, visibleDistance: projection.visibleDistance };
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

// Draws one frame of the road into out, view.width by view.height, row by row: the strip's
// columns copied from the row's strip row, the verge filled band by band.
export function drawRoad(raster: RoadRaster, frame: RoadFrame, out: Uint32Array): void {
  const { centerX, view } = raster;
  const stripLeft = centerX - STRIP.width / 2;
  const { width } = view;
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
    // The start strip has the previous zone in its near half: the verge beside it is that
    // zone's too.
    const vergeZone =
      look === frame.transition?.start && stripRow >= STRIP.height / 2
        ? frame.transition.previous.zone
        : look.zone;
    const image = look.strip[row.level];
    const pixels = image.pixels;
    const rowStart = (stripRow >> row.level) * image.width - stripLeft;
    const offset = y * width;
    const { roadEnd, roadStart, roadX } = row;
    for (let i = roadStart; i < roadEnd; i++) {
      out[offset + i] = pixels[rowStart + (roadX[i] ?? 0)] ?? 0;
    }

    const edges = VERGE_EDGES[vergeZone];
    const colors = vergeColors(z, row.span);
    const [curbLeft, curbRight] = splitAt(row, edges.curbTo);
    const [walkLeft, walkRight] = splitAt(row, edges.walkTo);
    out.fill(wordOf(colors.lawn), offset, offset + walkLeft);
    out.fill(wordOf(colors.walk), offset + walkLeft, offset + curbLeft);
    out.fill(wordOf(colors.curb), offset + curbLeft, offset + roadStart);
    out.fill(wordOf(colors.curb), offset + roadEnd, offset + curbRight);
    out.fill(wordOf(colors.walk), offset + curbRight, offset + walkRight);
    out.fill(wordOf(colors.lawn), offset + walkRight, offset + width);
    if (hasLeaves(vergeZone, row.span)) {
      for (const [from, to] of [
        [0, curbLeft],
        [curbRight, width],
      ] as const) {
        for (let i = from; i < to; i++) {
          const leaf = leafAt(vergeZone, (roadX[i] ?? 0) - centerX, z, row.span);
          if (leaf !== null) {
            out[offset + i] = wordOf(leaf);
          }
        }
      }
    }

    const fade = y < FADE_ROWS ? frame.fade : null;
    if (fade !== null) {
      for (let i = 0; i < width; i++) {
        if (fadeCovers(view.x + i, y)) {
          out[offset + i] = fade[i] ?? 0;
        }
      }
    }
  });
}

// Ordered dither: the share of a far row given over to the band grows toward the band.
export function fadeCovers(x: number, row: number): boolean {
  const share = (FADE_ROWS - row - 0.5) / FADE_ROWS;
  const threshold = ((BAYER_4[(row & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
  return threshold < share;
}
