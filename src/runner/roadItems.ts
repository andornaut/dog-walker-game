// Something on the road, in a lane. y is its top edge in screen pixels; id ties it to a sprite.
export interface RoadItem<Kind extends string = string> {
  height: number;
  id: number;
  kind: Kind;
  lane: number;
  y: number;
}

// Moves every item down the screen by the distance the road scrolled.
export function scrollRoadItems<Item extends RoadItem>(
  distance: number,
  items: readonly Item[],
): Item[] {
  return items.map((item) => ({ ...item, y: item.y + distance }));
}

// Drops the items that have scrolled wholly past the bottom of the road.
export function itemsOnRoad<Item extends RoadItem>(
  roadBottom: number,
  items: readonly Item[],
): Item[] {
  return items.filter((item) => item.y < roadBottom);
}
