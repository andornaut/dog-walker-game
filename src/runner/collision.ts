import type { RoadItem } from "./roadItems";

// The pack's vertical band in screen pixels and the lanes it occupies.
export interface PackFootprint {
  bottom: number;
  lanes: readonly number[];
  top: number;
}

// graced picks the items, such as obstacles, ignored while the window is open; other items,
// such as pickups, are always collected. startsInvulnerability is asked once for each graced
// item hit, in hit order, whether its hit opens the window: a hit that is only scenery does not.
export interface CollisionRules<Item extends RoadItem> {
  graced: (item: Item) => boolean;
  invulnerabilitySeconds: number;
  startsInvulnerability: (item: Item) => boolean;
}

// hits are removed from remaining. invulnerableSeconds is the time left in the window.
export interface CollisionResult<Item extends RoadItem> {
  hits: Item[];
  invulnerableSeconds: number;
  remaining: Item[];
}

// Touching any part of an item counts.
export function touchesPack(pack: PackFootprint, item: RoadItem): boolean {
  const inLane = pack.lanes.some((lane) => lane >= item.lane && lane < item.lane + item.laneSpan);
  return inLane && item.y < pack.bottom && item.y + item.height > pack.top;
}

// Items nearest the bottom are hit first, so of two obstacles touching at once only the
// lower one is hit; the window it opens lets the other pass.
export function collideWithPack<Item extends RoadItem>(
  rules: CollisionRules<Item>,
  pack: PackFootprint,
  invulnerableSeconds: number,
  items: readonly Item[],
): CollisionResult<Item> {
  const touching = items
    .filter((item) => touchesPack(pack, item))
    .sort((a, b) => b.y + b.height - (a.y + a.height));
  const hits: Item[] = [];
  let windowSeconds = invulnerableSeconds;
  for (const item of touching) {
    if (rules.graced(item)) {
      if (windowSeconds > 0) {
        continue;
      }
      if (rules.startsInvulnerability(item)) {
        windowSeconds = rules.invulnerabilitySeconds;
      }
    }
    hits.push(item);
  }
  return {
    hits,
    invulnerableSeconds: windowSeconds,
    remaining: items.filter((item) => !hits.includes(item)),
  };
}

export function tickInvulnerability(stepSeconds: number, invulnerableSeconds: number): number {
  return Math.max(0, invulnerableSeconds - stepSeconds);
}
