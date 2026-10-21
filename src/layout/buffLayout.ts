import type { Point, Rect } from "../lib/rect";
import type { FontMetrics } from "../ui/fontMetrics";

// The buff charm: the walk bar's ui-effect-well, size square, holding the buff's 20x20 icon at
// icon,icon, the same on a card, the road and the bar. Lit, it wears a ring-wide amber ring
// around the well. fx-sparkle plays centred at sparkle from its top-left. On a card option it
// sits at card, in card pixels (the art window's top-right, inset 1px), and on the enlarged
// card at large, drawn at large.scale; a second charm stacks gap left of the first.
export const CHARM = {
  card: { x: 58, y: 15 },
  gap: 2,
  icon: 1,
  large: { scale: 2, x: 116, y: 30 },
  ring: 1,
  size: 22,
  sparkle: { x: 19, y: 3 },
} as const;

// A pop over the road: the charm appears lit, centred on its dog's or item's column with its
// bottom gap rows over its top; a forgiven bump's charm sits left of the walker's head, its
// centre walker.dx from the walker's centre column and its top walker.dy from the walker's top
// row. At fadeAtMs the charm fades out over fadeMs, rising rise rows unless motion is reduced.
// The bar's well glints with it: its amber ring blinks blinks times, blinkMs on and blinkMs
// off. A forgiven bump's heart pop turns from loss to gain at switchMs, as its charm shows.
// Long reach draws a 1px amber dotted line from its dog to the item for reachMs.
export const BUFF_POP = {
  blinkMs: 120,
  blinks: 2,
  fadeAtMs: 450,
  fadeMs: 900,
  gap: 2,
  reachMs: 200,
  rise: 10,
  switchMs: 120,
  walker: { dx: -22, dy: -6 },
} as const;

// A struck value: a 1px red line across the old value's capitals' middle row, past rows
// beyond its ink each side, and the new value gap rows after the old value's ink. Each is a
// font pixel at the text's scale.
export const STRIKE = { gap: 4, past: 1 } as const;

// The charm's top-left at scale for a card at cardX, cardY: the enlarged card's at 2x, else
// the small card's; the index-th charm stacks left of the one before it.
export function cardCharmAt(card: Point, scale: number, index: number): Point {
  const place = scale === 1 ? CHARM.card : CHARM.large;
  return { x: card.x + place.x - index * (CHARM.size + CHARM.gap) * scale, y: card.y + place.y };
}

// The charm's rect over the road: centred on centreX with its bottom gap rows over top.
export function charmOverRect(centreX: number, top: number): Rect {
  const { size } = CHARM;
  return {
    height: size,
    width: size,
    x: Math.round(centreX - size / 2),
    y: top - BUFF_POP.gap - size,
  };
}

// The charm's rect beside the walker's head, from the walker's centre column and top row.
export function charmByWalkerRect(walkerTop: Point): Rect {
  const { size } = CHARM;
  const { dx, dy } = BUFF_POP.walker;
  return {
    height: size,
    width: size,
    x: Math.round(walkerTop.x + dx - size / 2),
    y: walkerTop.y + dy,
  };
}

// Where fx-sparkle's centre goes for a well or charm at well, drawn at scale.
export function sparkleAt(well: Point, scale = 1): Point {
  return { x: well.x + CHARM.sparkle.x * scale, y: well.y + CHARM.sparkle.y * scale };
}

// A struck value's line and where the new value starts, for the old value's ink from inkLeft
// to inkRight and its capitals' top at capTop, in a font with metrics at scale: the line on the
// capitals' middle row (the title font's row 6 and the body font's row 4 from a line's top).
export function strikeGeometry(
  metrics: Pick<FontMetrics, "capHeight">,
  scale: number,
  ink: { capTop: number; left: number; right: number },
): { afterX: number; line: Rect } {
  const middle = Math.floor((metrics.capHeight - 1) / 2);
  const past = STRIKE.past * scale;
  return {
    afterX: ink.right + STRIKE.gap * scale,
    line: {
      height: scale,
      width: ink.right - ink.left + 2 * past,
      x: ink.left - past,
      y: ink.capTop + middle * scale,
    },
  };
}
