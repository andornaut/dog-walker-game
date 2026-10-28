import type { WalkItem } from "../runner/walkItems";

// An item kept on the road as scenery: the item as the walk last had it, and the zone and how
// far into it the walk was then. Scenery is drawn only: the walk never sees it, so it collides
// with nothing and changes nothing in play.
export interface KeptScenery {
  readonly item: WalkItem;
  readonly zoneDistance: number;
  readonly zoneIndex: number;
}

// Which zone the walk is in, and how far into it.
export interface RoadPlace {
  readonly zoneDistance: number;
  readonly zoneIndex: number;
}

// The obstacles a step's plain hits, dodged ones included, and contacts took out of play, kept
// as scenery as the hit left them.
export function struckBy(step: {
  readonly bumps: readonly { readonly item: WalkItem }[];
  readonly contacts: readonly { readonly item: WalkItem }[];
  readonly walk: { readonly run: RoadPlace };
}): KeptScenery[] {
  const { zoneDistance, zoneIndex } = step.walk.run;
  return [...step.bumps, ...step.contacts].map(({ item }) => ({ item, zoneDistance, zoneIndex }));
}

// The struck item as it stands now, scrolled down the road as far as the walk has gone since
// the hit (a mover stopped where it was hit), or null once it lies wholly past roadBottom or
// the walk is in another zone.
export function struckNow(
  roadBottom: number,
  run: RoadPlace,
  struck: KeptScenery,
): WalkItem | null {
  if (run.zoneIndex !== struck.zoneIndex) {
    return null;
  }
  const y = struck.item.y + run.zoneDistance - struck.zoneDistance;
  return y < roadBottom ? { ...struck.item, y } : null;
}
