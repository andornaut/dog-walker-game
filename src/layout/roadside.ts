import type { ZoneId } from "../data/types";

// What lies beside the projected road, as the backdrops paint it below their streets, so the
// verge under the band continues the band's bottom row. across is how far from the road's
// centre line a pixel is, in road pixels: the road is across < 140. z is a road distance from
// the start of the walk, so seams and mown stripes scroll with the road, and span is how much
// road the screen row covers.

// Endesga 32 colours.
const GREEN = 0x63c74d;
const DARK_GREEN = 0x3e8948;
const GREY = 0x8b9bb4;
const LIGHT_GREY = 0xc0cbdc;
const ORANGE = 0xf77622;
const RUST = 0xbe4a2f;

const ROAD_HALF = 140;
// Lines across the sidewalk every SEAM_PERIOD, and lawn mown in stripes half a period wide.
const SEAM_PERIOD = 32;
const STRIPE_PERIOD = 64;
// A row covering more road than this draws no seam: seams would run together.
const SEAM_MAX_SPAN = 16;
// Fallen leaves on The Long Way Home: one 2x2 cell in LEAF_RARITY, on rows that cover
// little enough road to show a cell every frame.
const LEAF_CELL = 2;
const LEAF_RARITY = 37;
const LEAF_MAX_SPAN = 2;

// The curb runs from the road's edge to curbTo, the sidewalk or paving to walkTo, and the
// lawn beyond. A zone without a curb or a sidewalk has them end where they start.
export interface VergeEdges {
  readonly curbTo: number;
  readonly walkTo: number;
}

export const VERGE_EDGES: Readonly<Record<ZoneId, VergeEdges>> = {
  homeStretch: { curbTo: 144, walkTo: 188 },
  park: { curbTo: ROAD_HALF, walkTo: ROAD_HALF },
  shops: { curbTo: 144, walkTo: Number.POSITIVE_INFINITY },
  street: { curbTo: 144, walkTo: 188 },
};

export interface VergeColors {
  readonly curb: number;
  readonly lawn: number;
  readonly walk: number;
}

// Whether a line every period along the road falls on this row: exactly one row shows each
// line, however much road the row covers, so a line never blinks as the road scrolls.
export function crossesLine(period: number, z: number, span: number): boolean {
  return Math.floor(z / period) !== Math.floor((z - Math.max(span, 1)) / period);
}

export function vergeColors(z: number, span: number): VergeColors {
  const stripe = (((z % STRIPE_PERIOD) + STRIPE_PERIOD) % STRIPE_PERIOD) * 2 >= STRIPE_PERIOD;
  return {
    curb: GREY,
    lawn: stripe ? DARK_GREEN : GREEN,
    walk: span < SEAM_MAX_SPAN && crossesLine(SEAM_PERIOD, z, span) ? GREY : LIGHT_GREY,
  };
}

function hashed(x: number, y: number): number {
  return Math.abs(Math.imul(x, 7919) + Math.imul(y, 104729) + Math.imul(Math.imul(x, y), 31));
}

// Whether a row of the zone's verge can have fallen leaves.
export function hasLeaves(zone: ZoneId, span: number): boolean {
  return zone === "homeStretch" && span <= LEAF_MAX_SPAN;
}

// A fallen leaf at road position x, z on The Long Way Home's lawns and sidewalks, or null.
export function leafAt(zone: ZoneId, x: number, z: number, span: number): number | null {
  if (!hasLeaves(zone, span)) {
    return null;
  }
  const cellX = Math.floor(x / LEAF_CELL);
  const cellZ = Math.floor(z / LEAF_CELL);
  const hash = hashed(cellX, cellZ);
  if (hash % LEAF_RARITY !== 0) {
    return null;
  }
  return (cellX + cellZ) % 3 === 0 ? RUST : ORANGE;
}
