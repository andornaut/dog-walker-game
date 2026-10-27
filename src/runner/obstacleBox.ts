import type { Silhouette } from "../layout/packFormation";
import { distanceAtY, scaleAt, screenYAt } from "../layout/projection";
import type { ScaledBox } from "./collision";

// An obstacle's hit box is what it draws, as the pack's parts are: the bounding box of its
// sprites' opaque pixels at its depth, less an inset on every side. Rows run down the flat road,
// so a sprite drawn taller than its footprint, as a cyclist is, hits as tall as it is drawn,
// and a long footprint, such as a truck's, hits only as long as the truck is drawn. Columns are
// screen columns, kept at the scale of the obstacle's feet row.

// The road's projection in road pixels: centreX is the road's centre across from its left edge.
export interface RoadLens {
  readonly centreX: number;
  readonly focal: number;
  readonly footY: number;
  readonly horizonY: number;
}

// One sprite of an obstacle as it stands: its silhouette, dx across the road from the item's
// centre, and behind up the road from the item's near edge, in road pixels.
export interface PlacedPart {
  readonly behind: number;
  readonly dx: number;
  readonly silhouette: Silhouette;
}

// The obstacle's place: feetY, its near edge, the road row its sprites stand on, and x, its
// centre across the road, both in road pixels.
interface ObstaclePlace {
  readonly feetY: number;
  readonly x: number;
}

// The hit box of an obstacle whose sprites are drawn as itemViews draws them: each on its feet
// row through the projection, at the projected scale capped at 1, inset by inset screen pixels on
// every side.
export function drawnObstacleBox(
  lens: RoadLens,
  inset: number,
  parts: readonly PlacedPart[],
  place: ObstaclePlace,
): ScaledBox {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const { behind, dx, silhouette } of parts) {
    const distance = lens.footY - (place.feetY - behind);
    const projected = scaleAt(lens, distance);
    const drawn = Math.min(1, projected);
    const feetRow = screenYAt(lens, distance);
    const centre = lens.centreX + (place.x + dx - lens.centreX) * projected;
    top = Math.min(top, feetRow - silhouette.above * drawn + inset);
    bottom = Math.max(bottom, feetRow - inset);
    left = Math.min(left, centre + silhouette.left * drawn + inset);
    right = Math.max(right, centre + silhouette.right * drawn - inset);
  }
  // Columns go back to road pixels at the scale of the near edge's row.
  const scale = scaleAt(lens, lens.footY - place.feetY);
  const across = (column: number) => lens.centreX + (column - lens.centreX) / scale;
  return {
    bottom: lens.footY - distanceAtY(lens, bottom),
    left: across(left),
    right: across(right),
    scale,
    top: lens.footY - distanceAtY(lens, top),
  };
}

// How far the hit box's far edge stands up the road from its near edge at the moment it passes
// bandBottom, the pack's lowest row: the hit length the walk gives the obstacle, so that the
// rows from its near edge back by that length overlap the pack's band exactly while its drawn hit
// box does. The far edge moves down the road with the near edge, so it passes the band once.
export function exitLength(
  lens: RoadLens,
  inset: number,
  parts: readonly PlacedPart[],
  bandBottom: number,
): number {
  const farEdge = (feetY: number) => drawnObstacleBox(lens, inset, parts, { feetY, x: 0 }).top;
  let low = bandBottom;
  let high = bandBottom + lens.focal / 2;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (farEdge(middle) < bandBottom) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2 - bandBottom;
}
