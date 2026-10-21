import type { RoadItem } from "./roadItems";

// A box in road pixels: x across the road from its left edge, y down the screen.
export interface Box {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// One dog's hit box. The walker has none.
export interface DogBox<Dog extends string = string> extends Box {
  readonly dog: Dog;
}

// The pack's vertical band in screen pixels, from the lead dog's box to the last dog's.
export interface PackBand {
  readonly bottom: number;
  readonly top: number;
}

// Whether an item's hit box, y to y + height, overlaps the pack's band, where it can touch a
// dog's box: from when its near edge passes the band's top until its far edge passes the
// band's bottom.
export function levelWithPack(pack: PackBand, item: Pick<RoadItem, "height" | "y">): boolean {
  return item.y + item.height > pack.top && item.y < pack.bottom;
}

// Boxes that share any area overlap; boxes that only meet at an edge do not.
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// An item's hit box: its lanes less the inset at each side, along its height.
export function itemBox(
  cell: { readonly inset: number; readonly length: number },
  item: Pick<RoadItem, "height" | "lane" | "laneSpan" | "y">,
): Box {
  return {
    bottom: item.y + item.height,
    left: item.lane * cell.length + cell.inset,
    right: (item.lane + item.laneSpan) * cell.length - cell.inset,
    top: item.y,
  };
}

// The dogs whose boxes overlap the box, in pack order.
export function dogsTouching<Dog extends string>(dogs: readonly DogBox<Dog>[], box: Box): Dog[] {
  return dogs.flatMap((dog) => (overlaps(dog, box) ? [dog.dog] : []));
}

// graced picks the items, such as obstacles, ignored while the window is open; other items,
// such as pickups, are always collected. startsInvulnerability is asked once for each graced
// item hit, in hit order, whether its hit opens the window: a hit that is only scenery does not.
export interface CollisionRules<Item extends RoadItem> {
  graced: (item: Item) => boolean;
  invulnerabilitySeconds: number;
  startsInvulnerability: (item: Item) => boolean;
}

// An item hit, with the dogs whose boxes touch it.
export interface Hit<Item extends RoadItem, Dog extends string> {
  readonly dogs: readonly Dog[];
  readonly item: Item;
}

// hits are removed from remaining. invulnerableSeconds is the time left in the window.
export interface CollisionResult<Item extends RoadItem, Dog extends string> {
  hits: Hit<Item, Dog>[];
  invulnerableSeconds: number;
  remaining: Item[];
}

// Items nearest the bottom are hit first, so of two obstacles touching at once only the
// lower one is hit; the window it opens lets the other pass. An item is hit when any dog's
// box overlaps it, by touching.
export function collideWithPack<Item extends RoadItem, Dog extends string>(
  rules: CollisionRules<Item>,
  touching: (item: Item) => readonly Dog[],
  invulnerableSeconds: number,
  items: readonly Item[],
): CollisionResult<Item, Dog> {
  const touched = items
    .map((item) => ({ dogs: touching(item), item }))
    .filter(({ dogs }) => dogs.length > 0)
    .sort((a, b) => b.item.y + b.item.height - (a.item.y + a.item.height));
  const hits: Hit<Item, Dog>[] = [];
  let windowSeconds = invulnerableSeconds;
  for (const hit of touched) {
    if (rules.graced(hit.item)) {
      if (windowSeconds > 0) {
        continue;
      }
      if (rules.startsInvulnerability(hit.item)) {
        windowSeconds = rules.invulnerabilitySeconds;
      }
    }
    hits.push(hit);
  }
  const hitItems = new Set(hits.map(({ item }) => item));
  return {
    hits,
    invulnerableSeconds: windowSeconds,
    remaining: items.filter((item) => !hitItems.has(item)),
  };
}

export function tickInvulnerability(stepSeconds: number, invulnerableSeconds: number): number {
  return Math.max(0, invulnerableSeconds - stepSeconds);
}
