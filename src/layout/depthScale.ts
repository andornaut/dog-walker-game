import { itemAt } from "../arrays";

// How a road sprite is sized for its depth. Every road sprite, flat ones included, is a
// billboard scaled uniformly with the projection, never stretched on one axis, so its drawn
// size grows smoothly as it approaches. The scale is capped at 1, so art past the walker's
// feet is never upscaled. It is drawn from the smallest of its art steps (1x and the depth
// step variants it has) that is at least the projected size on both axes, downscaled with
// nearest-neighbour by a factor of at most 1, so it stays crisp. That factor also covers the
// next smaller step's frame: the steps' frame sides round to whole pixels on their own, so
// without it a switch to the larger step could draw its shorter side up to a pixel smaller.
// Each step stands on its own feet line.

// One art step of a road sprite: its frame and feet line in its own pixels.
export interface DepthArt {
  readonly feetY: number;
  readonly height: number;
  readonly key: string;
  readonly width: number;
}

// The art to draw, its scale and vertical origin, and depth: the projected scale, capped at
// 1, which shadows and anything drawn with the sprite follow.
export interface DepthDraw {
  readonly depth: number;
  readonly key: string;
  readonly originY: number;
  readonly scale: number;
}

// The scale that draws art at least the size of art other on both axes.
function cover(art: DepthArt, other: DepthArt): number {
  return Math.max(other.width / art.width, other.height / art.height);
}

// arts holds the 1x art first, then any smaller steps.
export function depthDraw(arts: readonly DepthArt[], projected: number): DepthDraw {
  const full = itemAt(arts, 0);
  const depth = Math.min(1, projected);
  const scaleOf = (art: DepthArt) => depth * cover(art, full);
  let art = full;
  for (const step of arts) {
    if (scaleOf(step) <= 1 && step.width * step.height < art.width * art.height) {
      art = step;
    }
  }
  let scale = scaleOf(art);
  for (const step of arts) {
    if (step.width <= art.width && step.height <= art.height && step !== art) {
      scale = Math.max(scale, cover(art, step));
    }
  }
  return { depth, key: art.key, originY: art.feetY / art.height, scale: Math.min(1, scale) };
}
