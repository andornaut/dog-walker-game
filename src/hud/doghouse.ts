import type { Point } from "../layout/rect";
import { heartRows } from "./hudView";

// Where the parts of a dog slot go, in pixels from the 72x146 doghouse's top-left corner.
// Centred parts give the centre's x; every y is the top of the capitals or the sprite.
export const DOGHOUSE = {
  dogFace: { x: 20, y: 36 },
  fired: { x: 36, y: 128 },
  // On the doormat, 31px wide: room for "10/10".
  heartCount: { x: 36, y: 70 },
  hearts: { perRow: 6, pitchX: 9, pitchY: 8, x: 9, y: 127 },
  // The roof's name plate and the hearts board, for fitting names: the scales each may take,
  // largest first. The owner's name has 9px above the hearts, room for 1x only.
  name: { scales: [2, 1], width: 56, x: 36, y: 16 },
  ownerFace: { x: 8, y: 78 },
  ownerName: { scales: [1], width: 57, x: 9, y: 118 },
  // The dog's status icons (16x16, top-left corners) on the pegs beside the owner's window,
  // the newest on the upper peg.
  statuses: [
    { x: 46, y: 78 },
    { x: 46, y: 96 },
  ],
} as const;

export interface HeartCell extends Point {
  full: boolean;
}

// The meter's hearts in rows of six, the first `hearts` of them full.
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
