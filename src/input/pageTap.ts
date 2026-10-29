import type { Point } from "../lib/rect";

// A press on the page beside the game's canvas (the margins of a wide screen, below a short
// one) counts as a tap outside an open overlay too, by the same tap rule. Only the bare page
// counts: its root, its body and the game's container around the canvas. The canvas has its
// own rule, and page UI such as the site nav or the dev panel keeps its presses.
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
