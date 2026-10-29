import type { Point, Rect } from "@andornaut/game-kit/rect";

// The buff charm: the walk bar's ui-effect-well, size square, holding the buff's 20x20 icon at
// icon,icon, the same on the road and the bar. Lit, it wears a ring-wide amber ring around the
// well. fx-sparkle plays centred at sparkle from its top-left. A second charm stacks gap left of
// the first over the road.
//
// Under a card option, small or enlarged, the charm's well widens into a plate: the icon at its
// left, and right of the well, card.textX columns on, the item's name in the body font with its
// capitals card.nameY rows under the plate's top and, under it, what the item did in the title
// font with its capitals card.effectY rows under the top, the plate ending card.padRight
// columns past the wider line's ink. An option's charms, card.most at most (the walker's perk
// and one money item), stack gap apart, each centred on the card, the first ring under rows
// below it, at 1x under the enlarged card too, so every charm fits the card it is under.
export const CHARM = {
  card: { effectY: 13, most: 2, nameY: 3, padRight: 4, textX: 3 },
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
// Long reach pops no charm: it draws a 1px amber dotted line from its dog to the item for
// reachMs as its well glints.
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

// A lit charm's side at scale: the well and its ring each side.
export function charmRingSize(scale: number): number {
  return (CHARM.size + 2 * CHARM.ring) * scale;
}

// A card charm's plate width, in plate pixels, for text whose wider line inks inkWidth columns.
export function cardCharmWidth(inkWidth: number): number {
  const { padRight, textX } = CHARM.card;
  return CHARM.size + textX + inkWidth + padRight;
}

// The rows under a card its charms take, reserved whether or not it has any: the gap, then
// card.most lit charms stacked gap apart.
export const CARD_CHARMS_HEIGHT =
  CHARM.under + CHARM.card.most * charmRingSize(1) + (CHARM.card.most - 1) * CHARM.gap;

// The plates of a card's charms, widths wide: stacked gap apart, the first ring under rows below
// the card, each centred on the card, the odd pixel to the right.
export function cardCharmPlates(card: Rect, widths: readonly number[]): Rect[] {
  const { gap, ring, size, under } = CHARM;
  const top = card.y + card.height + under + ring;
  return widths.map((width, i) => ({
    height: size,
    width,
    x: card.x + Math.floor((card.width - (width + 2 * ring)) / 2) + ring,
    y: top + i * (charmRingSize(1) + gap),
  }));
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
export function sparkleAt(well: Point, scale: number): Point {
  return { x: well.x + CHARM.sparkle.x * scale, y: well.y + CHARM.sparkle.y * scale };
}
