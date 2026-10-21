import { itemAt } from "../arrays";
import { stepSize } from "../assets/depthSteps";
import { snapScale } from "./projection";

// How a road sprite is sized for its depth. Every road sprite, flat ones included, is a
// billboard scaled uniformly with the projection, never stretched on one axis. It is drawn
// only at the depth step nearest its projected scale (snapScale, with the scale capped at 1
// so art past the walker's feet is never upscaled), so it keeps one size between fixed
// distances and grows a step at a time as it approaches. A step is drawn from its own art at
// scale 1 when it has one; otherwise from the smallest larger art at the one fixed scale that
// gives the step's size, so no frame resamples the art at a size of its own. Each step stands
// on its own feet line.

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
  const size = Math.max(1, stepSize(side(full), snapScale(Math.min(1, projected))));
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
