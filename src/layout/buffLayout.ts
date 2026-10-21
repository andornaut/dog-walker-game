import type { Point, Rect } from "../lib/rect";
import type { FontMetrics } from "../ui/fontMetrics";

// The buff charm: the walk bar's ui-effect-well, size square, holding the buff's 20x20 icon at
// icon,icon, the same on a card, the road and the bar. Lit, it wears a ring-wide amber ring
// around the well. fx-sparkle plays centred at sparkle from its top-left. Under a card option,
// small or enlarged, the lit charms sit in a row centred on the card, their rings under rows
// below it and gap apart, drawn at the card's scale (2 on the enlarged card); a second charm
// stacks gap left of the first over the road.
export const CHARM = {
  gap: 2,
  icon: 1,
  ring: 1,
  size: 22,
  sparkle: { x: 19, y: 3 },
  under: 8,
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

// A lit charm's side at scale: the well and its ring each side.
export function charmRingSize(scale: number): number {
  return (CHARM.size + 2 * CHARM.ring) * scale;
}

// The rows a card's charm row takes under the card at scale: the gap, then a lit charm.
export function charmRowHeight(scale: number): number {
  return CHARM.under + charmRingSize(scale);
}

// The wells' top-lefts for count charms under card, drawn at scale: their rings under rows
// below the card, gap apart, centred on the card as a row, the odd pixel to the right.
export function cardCharmsAt(card: Rect, scale: number, count: number): Point[] {
  const ring = charmRingSize(scale);
  const step = ring + CHARM.gap * scale;
  const total = count * ring + (count - 1) * CHARM.gap * scale;
  const left = card.x + Math.floor((card.width - total) / 2) + CHARM.ring * scale;
  const top = card.y + card.height + CHARM.under + CHARM.ring * scale;
  return Array.from({ length: count }, (_, i) => ({ x: left + i * step, y: top }));
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
