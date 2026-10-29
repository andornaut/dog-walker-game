import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

// A press on the page beside the game's canvas (the margins the canvas leaves on any side, as it
// scales by whole pixels) counts as a tap outside an open overlay too, by the same tap rule, and
// steers the walk (walkPagePoint). Only the bare page counts: its root, its body and the game's
// container around the canvas. The canvas has its own rule, and page UI such as the site nav or
// the dev panel keeps its presses.
export function onBarePage(
  bare: readonly (EventTarget | null)[],
  target: EventTarget | null,
): boolean {
  return target !== null && bare.includes(target);
}

// A point in the page's client pixels in game pixels, through the canvas's on-page box, which
// the game is scaled to fill: gameWidth game pixels across.
export function gamePoint(
  canvas: { readonly left: number; readonly top: number; readonly width: number },
  gameWidth: number,
  client: Point,
): Point {
  const scale = canvas.width / gameWidth;
  return { x: (client.x - canvas.left) / scale, y: (client.y - canvas.top) / scale };
}

// The point of rect nearest to point: its own inside rect, else on rect's edge, the last column
// or row for one past its right or bottom edge (containsPoint leaves those edges out).
export function clampInto(rect: Rect, point: Point): Point {
  const within = (value: number, start: number, size: number) =>
    Math.min(Math.max(value, start), start + size - 1);
  return { x: within(point.x, rect.x, rect.width), y: within(point.y, rect.y, rect.height) };
}

// Where a press that lands on the page beside the game acts in the walk: at the nearest point of
// the game's screen, so the page below the dog cards and beside the road steers as the screen's
// edge there does. undefined: it lands beside or above the walk bar, whose presses are its own.
export function walkPagePoint(
  layout: { readonly screen: Rect; readonly topBar: Rect },
  point: Point,
): Point | undefined {
  const landed = clampInto(layout.screen, point);
  return containsPoint(layout.topBar, landed.x, landed.y) ? undefined : landed;
}
