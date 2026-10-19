import type { Point } from "../layout/rect";
import { heartRows } from "./hudView";

// Where the parts of a dog slot go, in pixels from the 120x90 doghouse's top-left corner.
// Centred parts give the centre's x; every y is the top of the capitals or the sprite.
export const DOGHOUSE = {
  dogFace: { x: 6, y: 24 },
  fired: { x: 60, y: 74 },
  heartCount: { x: 98, y: 46 },
  // Rows of five 8px hearts: from x 76 the fifth ends on the house's right edge.
  hearts: { perRow: 5, pitchX: 9, pitchY: 8, x: 76, y: 26 },
  // The roof's name plate and the owner's name under the faces, for fitting names: the
  // scales each may take, largest first.
  name: { scales: [2, 1], width: 108, x: 60, y: 6 },
  ownerFace: { x: 42, y: 24 },
  ownerName: { scales: [1], width: 70, x: 6, y: 62 },
  // The roof band, which the name plate sits on.
  roof: { height: 20 },
  size: { height: 90, width: 120 },
  // The dog's status icons (16x16, top-left corners) under the hearts, the newest on the
  // left.
  statuses: [
    { x: 78, y: 62 },
    { x: 98, y: 62 },
  ],
} as const;

export interface HeartCell extends Point {
  full: boolean;
}

// The meter's hearts in rows, the first `hearts` of them full.
export function doghouseHearts(hearts: number, max: number): HeartCell[] {
  const { perRow, pitchX, pitchY, x, y } = DOGHOUSE.hearts;
  return heartRows(perRow, hearts, max).flatMap((row, rowIndex) =>
    row.map((full, column) => ({ full, x: x + column * pitchX, y: y + rowIndex * pitchY })),
  );
}

// The count beside the hearts, so the meter never relies on colour alone.
export function heartCount(hearts: number, max: number): string {
  return `${hearts}/${max}`;
}

// The largest whole scale, from the largest given down, at which text measuring width at 1x
// fits in room; 1 when none does.
export function fittingScale(room: number, scales: readonly number[], width: number): number {
  return scales.find((scale) => width * scale <= room) ?? 1;
}
