import { screenXAt } from "../layout/projection";
import type { RoadItem } from "./roadItems";

// A box in road pixels: x across the road from its left edge, y down the screen.
export interface Box {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// A point in road pixels, as a box's corners are.
export interface RoadPoint {
  readonly x: number;
  readonly y: number;
}

// A box drawn on a row of the road at scale: its columns are road pixels on that row, so it is
// drawn from centreX + (left - centreX) * scale to centreX + (right - centreX) * scale across the
// screen, centreX being the road's centre, which the projection leaves in place.
export interface ScaledBox extends Box {
  readonly scale: number;
}

// One dog's hit rectangle: inside its drawn sprite, on the road.
export interface DogBox<Dog extends string = string> extends ScaledBox {
  readonly dog: Dog;
}

// The pack on the road: its outline, the bounding box of everything drawn for it (the walker,
// the dogs and the leashes between them), which pickups touch; and its parts' hit rectangles,
// each dog's in pack order and the walker's, which obstacles touch. A leash is not hit. centreX
// is the road's centre, where the parts' scales meet.
export interface PackBoxes<Dog extends string = string> {
  readonly centreX: number;
  readonly dogs: readonly DogBox<Dog>[];
  readonly outline: Box;
  readonly walker: ScaledBox;
}

// Boxes that share any area overlap; boxes that only meet at an edge do not.
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// A solid item's hit box as drawn, and the road columns of the lanes it stands in, left to right.
export interface LanedBox extends ScaledBox {
  readonly lanes: { readonly left: number; readonly right: number };
}

// Whether an item's box touches a part's as drawn: along the road, and across the screen, each
// at its scale. The item's box is cut to its lanes as the road is drawn on the part's row, so it
// never reaches a part settled in another lane however wide the projection draws it; a box its
// lanes cut away entirely touches nothing. Boxes that only meet at an edge do not touch.
function touchesAsDrawn(centreX: number, part: ScaledBox, item: LanedBox): boolean {
  const road = { centreX };
  const across = (scale: number, x: number) => screenXAt(road, scale, x);
  const left = Math.max(across(item.scale, item.left), across(part.scale, item.lanes.left));
  const right = Math.min(across(item.scale, item.right), across(part.scale, item.lanes.right));
  return (
    left < right &&
    across(part.scale, part.left) < right &&
    left < across(part.scale, part.right) &&
    part.top < item.bottom &&
    item.top < part.bottom
  );
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

// The squared distance from a point to a box, 0 inside it.
function distanceSquared(box: Box, point: RoadPoint): number {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right);
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return dx * dx + dy * dy;
}

// The point of contact: the middle of where the box overlaps the pack's outline.
function contactPoint(outline: Box, box: Box): RoadPoint {
  return {
    x: (Math.max(outline.left, box.left) + Math.min(outline.right, box.right)) / 2,
    y: (Math.max(outline.top, box.top) + Math.min(outline.bottom, box.bottom)) / 2,
  };
}

// Of the dogs, the one whose rectangle is nearest the point, the first in pack order on a tie.
function nearestOf<Dog extends string>(
  dogs: readonly DogBox<Dog>[],
  point: RoadPoint,
): DogBox<Dog> | undefined {
  let nearest: { distance: number; dog: DogBox<Dog> } | undefined;
  for (const dog of dogs) {
    const distance = distanceSquared(dog, point);
    if (nearest === undefined || distance < nearest.distance) {
      nearest = { distance, dog };
    }
  }
  return nearest?.dog;
}

// The dog a pickup touching the pack's outline goes to: the dog whose rectangle is nearest the
// point of contact, or the front dog, the first in pack order, when the walker's is nearer.
// null when the box does not touch the outline, or the pack has no dogs.
export function pickupDog<Dog extends string>(pack: PackBoxes<Dog>, box: Box): Dog | null {
  const [front] = pack.dogs;
  if (front === undefined || !overlaps(pack.outline, box)) {
    return null;
  }
  const point = contactPoint(pack.outline, box);
  const nearest = nearestOf(pack.dogs, point) ?? front;
  return distanceSquared(pack.walker, point) < distanceSquared(nearest, point)
    ? front.dog
    : nearest.dog;
}

// The dog an obstacle hits: the dog whose rectangle it touches as drawn, the one nearest the
// point of contact of those it touches; or the front dog when it touches only the walker's. null
// when it touches no part, even inside the outline, or the pack has no dogs.
export function hitDog<Dog extends string>(pack: PackBoxes<Dog>, box: LanedBox): Dog | null {
  const [front] = pack.dogs;
  if (front === undefined) {
    return null;
  }
  const touched = pack.dogs.filter((dog) => touchesAsDrawn(pack.centreX, dog, box));
  if (touched.length === 0) {
    return touchesAsDrawn(pack.centreX, pack.walker, box) ? front.dog : null;
  }
  return (nearestOf(touched, contactPoint(pack.outline, box)) ?? front).dog;
}

// The first positive-overlap interval while each boundary moves between its endpoints.
// Strict inequalities exclude an edge-only contact and a single instantaneous tangent.
export function sweptOverlapAt(from: readonly number[], to: readonly number[]): number | null {
  let enter = 0;
  let leave = 1;
  for (const [index, before] of from.entries()) {
    const after = to[index] ?? before;
    const change = after - before;
    if (change === 0) {
      if (before <= 0) {
        return null;
      }
    } else if (change > 0) {
      enter = Math.max(enter, -before / change);
    } else {
      leave = Math.min(leave, -before / change);
    }
    if (enter >= leave) {
      return null;
    }
  }
  return enter;
}

function contactGaps(centreX: number, part: ScaledBox, box: LanedBox): number[] {
  const across = (scale: number, x: number) => screenXAt({ centreX }, scale, x);
  const left = [
    across(box.scale, box.left),
    across(part.scale, box.lanes.left),
    across(part.scale, part.left),
  ];
  const right = [
    across(box.scale, box.right),
    across(part.scale, box.lanes.right),
    across(part.scale, part.right),
  ];
  return [
    ...right.flatMap((edge) => left.map((other) => edge - other)),
    part.bottom - box.top,
    box.bottom - part.top,
  ];
}

// One moving component against the moving pack, without joining separate components or
// unrelated positions into one rectangle. Call separately for each turn-partitioned sweep.
export function sweptHitDog<Dog extends string>(
  before: PackBoxes<Dog>,
  after: PackBoxes<Dog>,
  from: LanedBox,
  to: LanedBox,
): Dog | null {
  const initial = hitDog(before, from);
  if (initial !== null) {
    return initial;
  }
  const front = before.dogs[0];
  if (front === undefined) {
    return null;
  }
  const parts = [
    ...before.dogs.map((part, index) => ({
      after: after.dogs[index] ?? part,
      before: part,
      dog: part.dog,
    })),
    { after: after.walker, before: before.walker, dog: front.dog },
  ];
  let first: { at: number; dog: Dog } | undefined;
  for (const part of parts) {
    const at = sweptOverlapAt(
      contactGaps(before.centreX, part.before, from),
      contactGaps(after.centreX, part.after, to),
    );
    if (at !== null && (first === undefined || at < first.at)) {
      first = { at, dog: part.dog };
    }
  }
  return first?.dog ?? null;
}

// graced picks the items, such as obstacles, ignored while the window is open; other items,
// such as pickups, are always collected. startsInvulnerability is asked once for each graced
// item hit, in hit order, whether its hit opens the window: a hit that is only scenery does not.
export interface CollisionRules<Item extends RoadItem> {
  graced: (item: Item) => boolean;
  invulnerabilitySeconds: number;
  startsInvulnerability: (item: Item) => boolean;
}

// An item hit, with the dog the touch lands on.
interface Hit<Item extends RoadItem, Dog extends string> {
  readonly dog: Dog;
  readonly item: Item;
}

// hits are removed from remaining. invulnerableSeconds is the time left in the window.
interface CollisionResult<Item extends RoadItem, Dog extends string> {
  hits: Hit<Item, Dog>[];
  invulnerableSeconds: number;
  remaining: Item[];
}

// Items nearest the bottom are hit first, so of two obstacles touching at once only the
// lower one is hit; the window it opens lets the other pass. An item is hit when it touches the
// pack's box: touching gives the dog the touch lands on, or null for none.
export function collideWithPack<Item extends RoadItem, Dog extends string>(
  rules: CollisionRules<Item>,
  touching: (item: Item) => Dog | null,
  invulnerableSeconds: number,
  items: readonly Item[],
): CollisionResult<Item, Dog> {
  const touched = items
    .flatMap((item) => {
      const dog = touching(item);
      return dog === null ? [] : [{ dog, item }];
    })
    .sort((a, b) => b.item.y + b.item.height - (a.item.y + a.item.height));
  const hits: Hit<Item, Dog>[] = [];
  const hitIds = new Set<number>();
  let windowSeconds = invulnerableSeconds;
  for (const hit of touched) {
    if (hitIds.has(hit.item.id)) {
      continue;
    }
    if (rules.graced(hit.item)) {
      if (windowSeconds > 0) {
        continue;
      }
      if (rules.startsInvulnerability(hit.item)) {
        windowSeconds = rules.invulnerabilitySeconds;
      }
    }
    hits.push(hit);
    hitIds.add(hit.item.id);
  }
  return {
    hits,
    invulnerableSeconds: windowSeconds,
    remaining: items.filter((item) => !hitIds.has(item.id)),
  };
}

export function tickInvulnerability(stepSeconds: number, invulnerableSeconds: number): number {
  return Math.max(0, invulnerableSeconds - stepSeconds);
}
