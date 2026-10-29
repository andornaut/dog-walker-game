import { clampInto, containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

// Where a press that lands on the page beside the game's canvas (the margins the canvas leaves,
// as it scales by whole pixels) acts in the walk: at the nearest point of the game's screen, so
// the page below the dog cards and beside the road steers as the screen's edge there does.
// undefined: it lands beside or above the walk bar, whose presses are its own. Such a press
// counts as a tap outside an open overlay too (src/scenes/pagePresses.ts).
export function walkPagePoint(
  layout: { readonly screen: Rect; readonly topBar: Rect },
  point: Point,
): Point | undefined {
  const landed = clampInto(layout.screen, point);
  return containsPoint(layout.topBar, landed.x, landed.y) ? undefined : landed;
}
