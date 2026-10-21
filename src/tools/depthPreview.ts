import { blankImage, type RgbaImage } from "../assets/atlas/atlasPixels";
import { type DepthArt, type DepthDraw, depthDraw } from "../layout/depthScale";
import { project, type RoadProjection } from "../layout/projection";
import type { Rect } from "../lib/rect";
import { GLYPH_HEIGHT, glyphAdvance, normalizePixelText, PIXEL_GLYPHS } from "../ui/pixelFont";

// npm run art:depth-preview: a road sprite drawn as the game draws it at a sweep of
// distances, through the walk's projection and depthDraw. These are the pure parts; the
// script reads the art and writes the PNGs.

// One art step of the sprite: its frame 0 and feet line.
export interface PreviewArt extends DepthArt {
  readonly image: RgbaImage;
}

// Where the game draws the sprite at a distance ahead of the walker's feet: the projected
// scale, what depthDraw picks there, and the drawn rect on screen.
interface SweepRow {
  readonly distance: number;
  readonly drawn: DepthDraw;
  // The screen row the sprite's feet stand on.
  readonly feetY: number;
  readonly projected: number;
  readonly rect: Rect;
}

type Lens = Pick<RoadProjection, "centerX" | "focal" | "footY" | "horizonY">;

export function sweepRow(arts: readonly PreviewArt[], lens: Lens, x: number, distance: number) {
  const placed = project(lens, { distance, x });
  const drawn = depthDraw(arts, placed.scale);
  const art = arts.find(({ key }) => key === drawn.key) ?? arts[0];
  const width = Math.round((art?.width ?? 0) * drawn.scale);
  const height = Math.round((art?.height ?? 0) * drawn.scale);
  const sx = Math.round(placed.x);
  const sy = Math.round(placed.y);
  return {
    distance,
    drawn,
    feetY: sy,
    projected: placed.scale,
    rect: {
      height,
      width,
      x: Math.round(sx - width / 2),
      y: Math.round(sy - drawn.originY * height),
    },
  } satisfies SweepRow;
}

// count distances evenly from the walker's feet to the far edge of the road in view, and each
// whole distance where depthDraw changes art step, so every step shows at its nearest.
export function sweepDistances(
  arts: readonly PreviewArt[],
  lens: Lens & Pick<RoadProjection, "visibleDistance">,
  count: number,
): number[] {
  const far = Math.floor(lens.visibleDistance);
  const even = Array.from({ length: count }, (_, i) => Math.round((far * i) / (count - 1)));
  const changes: number[] = [];
  let key = depthDraw(arts, project(lens, { distance: 0, x: lens.centerX }).scale).key;
  for (let distance = 1; distance <= far; distance++) {
    const next = depthDraw(arts, project(lens, { distance, x: lens.centerX }).scale).key;
    if (next !== key) {
      changes.push(distance);
      key = next;
    }
  }
  return [...new Set([...even, ...changes])].sort((a, b) => a - b);
}

// A copy of the image.
export function cloneImage(image: RgbaImage): RgbaImage {
  return { ...image, data: new Uint8Array(image.data) };
}

// Draws art into target at rect, scaled to the rect's size with nearest-neighbour sampling,
// skipping transparent pixels and anything off the target.
export function drawScaled(art: RgbaImage, rect: Rect, target: RgbaImage): void {
  for (let dy = 0; dy < rect.height; dy++) {
    const ty = rect.y + dy;
    if (ty < 0 || ty >= target.height) {
      continue;
    }
    const sy = Math.min(art.height - 1, Math.floor(((dy + 0.5) * art.height) / rect.height));
    for (let dx = 0; dx < rect.width; dx++) {
      const tx = rect.x + dx;
      const sx = Math.min(art.width - 1, Math.floor(((dx + 0.5) * art.width) / rect.width));
      const from = (sy * art.width + sx) * 4;
      if (tx >= 0 && tx < target.width && (art.data[from + 3] ?? 0) > 0) {
        target.data.set(art.data.subarray(from, from + 4), (ty * target.width + tx) * 4);
      }
    }
  }
}

// The rect of source, with anything outside it transparent.
export function crop(source: RgbaImage, rect: Rect): RgbaImage {
  const out = blankImage(rect.width, rect.height);
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const sx = rect.x + x;
      const sy = rect.y + y;
      if (sx >= 0 && sy >= 0 && sx < source.width && sy < source.height) {
        const from = (sy * source.width + sx) * 4;
        out.data.set(source.data.subarray(from, from + 4), (y * rect.width + x) * 4);
      }
    }
  }
  return out;
}

export function fill(rgba: readonly number[], rect: Rect, target: RgbaImage): void {
  for (let y = Math.max(0, rect.y); y < Math.min(target.height, rect.y + rect.height); y++) {
    for (let x = Math.max(0, rect.x); x < Math.min(target.width, rect.x + rect.width); x++) {
      target.data.set(rgba, (y * target.width + x) * 4);
    }
  }
}

export function paste(source: RgbaImage, x: number, y: number, target: RgbaImage): void {
  drawScaled(source, { height: source.height, width: source.width, x, y }, target);
}

// Text in the game's 3x5 pixel font, in capitals, with its top-left at x, y.
export function drawText(
  rgba: readonly number[],
  text: string,
  at: { x: number; y: number },
  target: RgbaImage,
): void {
  let { x } = at;
  for (const char of normalizePixelText(text)) {
    const glyph = PIXEL_GLYPHS.find((candidate) => candidate.char === char);
    if (glyph !== undefined) {
      [...glyph.bits].forEach((bit, i) => {
        if (bit === "1") {
          const px = x + (i % glyph.width);
          const py = at.y + Math.floor(i / glyph.width);
          fill(rgba, { height: 1, width: 1, x: px, y: py }, target);
        }
      });
    }
    x += glyphAdvance(char);
  }
}

export const TEXT_HEIGHT = GLYPH_HEIGHT;

// The image scaled up factor times, each pixel a factor-square block.
export function upscale(factor: number, image: RgbaImage): RgbaImage {
  const out = blankImage(image.width * factor, image.height * factor);
  drawScaled(image, { height: out.height, width: out.width, x: 0, y: 0 }, out);
  return out;
}
