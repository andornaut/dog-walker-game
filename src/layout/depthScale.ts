import { itemAt } from "../arrays";
import { stepSize } from "../assets/depthSteps";

// How a road sprite is sized for its depth. Every road sprite, flat ones included, is a
// billboard scaled uniformly with the projection, never stretched on one axis: its larger
// frame side is drawn stepSize(side, scale) pixels, with the scale capped at 1 so art past the
// walker's feet is never upscaled. It is drawn from the smallest of its art steps (1x and the
// depth step variants it has) at least that size, downscaled with nearest-neighbour, so as it
// approaches it only grows and it never swaps to a smaller step. Each step stands on its own
// feet line.

// One art step of a road sprite: its frame and feet line in its own pixels.
export interface DepthArt {
  readonly feetY: number;
  readonly height: number;
  readonly key: string;
  readonly width: number;
}

// The art to draw, its scale and vertical origin, and depth: its drawn size over the 1x
// art's, which shadows and anything drawn with the sprite follow.
export interface DepthDraw {
  readonly depth: number;
  readonly key: string;
  readonly originY: number;
  readonly scale: number;
}

function side(art: DepthArt): number {
  return Math.max(art.width, art.height);
}

// arts holds the 1x art first, then any smaller steps.
export function depthDraw(arts: readonly DepthArt[], projected: number): DepthDraw {
  const full = itemAt(arts, 0);
  const size = Math.max(1, stepSize(side(full), Math.min(1, projected)));
  let art = full;
  for (const step of arts) {
    if (side(step) >= size && side(step) < side(art)) {
      art = step;
    }
  }
  return {
    depth: size / side(full),
    key: art.key,
    originY: art.feetY / art.height,
    scale: size / side(art),
  };
}
