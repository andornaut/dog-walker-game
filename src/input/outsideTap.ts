import type { OutsideArea } from "@andornaut/game-kit/input/outsideTap";
import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN_LAYOUT } from "../data/screen";

// The area around covered on the whole screen, where a tap outside an overlay's panel counts
// (the kit's outsideTap). A full-screen page covers the screen itself, so no point on the canvas
// is outside it.
export function screenArea(covered: readonly Rect[]): OutsideArea {
  return { bounds: SCREEN_LAYOUT.screen, covered };
}
