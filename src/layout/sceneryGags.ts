import type { ZoneId } from "../data/types";
import type { Point, Rect } from "./rect";

// The scenery gags in the backdrop band: a cat on a perch and a kite snagged in a street tree.
// They are still pictures, the first frame of their art, with no collision and no effect.
// Positions are band pixels, by the top-left corner of their sprites. The street runs up from
// the band's bottom edge to a cross street, and the gags sit on the lawns either side of it.

export const GAG_KEYS = { cat: "gag-cat", kite: "gag-kite" } as const;
export const GAG_SIZES = {
  cat: { height: 24, width: 24 },
  kite: { height: 40, width: 36 },
} as const;
// The tag whose first frame each gag shows.
export const GAG_TAGS = { cat: "idle", kite: "flutter" } as const;

// The near-left perch's top rail, rows 158 and 159, on the band's approach rows.
export const PERCH_RAIL_Y = 158;

// The backdrops' cross street, as the band rows its ambient movers stand on: the bottom row of
// each sidewalk and lane (far sidewalk 135 to 138, far lane 141 to 144, near lane 146 to 149,
// near sidewalk 150 to 154).
export const CROSS_STREET = { farLane: 144, farWalk: 138, nearLane: 149, nearWalk: 154 } as const;

// The cat's paws, on its frame's bottom row, rest on the perch's top rail, and the kite's tree
// stands on the near-right lawn, its crown over the cross street.
export const GAG_Y = { cat: PERCH_RAIL_Y + 1 - GAG_SIZES.cat.height, kite: 133 } as const;

// The kite's tree on the near-right lawn, in every zone.
export const KITE_AT: Point = { x: 284, y: GAG_Y.kite };

export interface Span {
  readonly x0: number;
  readonly x1: number;
}

// perches: where a cat may sit.
export interface ZoneGags {
  readonly perches: readonly Span[];
}

// Every backdrop has a perch along its near-left lawn: a picket fence, a park rail or a
// planter's ledge.
const NEAR_LEFT_PERCH: Span = { x0: 0, x1: 72 };

export const ZONE_GAGS: Readonly<Record<ZoneId, ZoneGags>> = {
  homeStretch: { perches: [NEAR_LEFT_PERCH] },
  park: { perches: [NEAR_LEFT_PERCH] },
  // The cat sits on the riverside railing, which takes the perch's rows.
  pawsPromenade: { perches: [NEAR_LEFT_PERCH] },
  shops: { perches: [NEAR_LEFT_PERCH] },
  snoozeCrescent: { perches: [NEAR_LEFT_PERCH] },
  street: { perches: [NEAR_LEFT_PERCH] },
};

// Where the zone's cat sits, drawn from roll in [0, 1): a spot on one of its perches, or null
// for a zone without one. The cat stays wholly on the perch.
export function catX(gags: ZoneGags, roll: number): number | null {
  const room = gags.perches.map(({ x0, x1 }) => Math.max(0, x1 - x0 - GAG_SIZES.cat.width));
  const total = room.reduce((sum, width) => sum + width, 0);
  let offset = Math.min(Math.max(0, roll), 0.999999) * total;
  for (const [i, width] of room.entries()) {
    const perch = gags.perches[i];
    if (perch !== undefined && offset <= width) {
      return perch.x0 + Math.floor(offset);
    }
    offset -= width;
  }
  return null;
}

// Each perch from its top rail down to the band's bottom edge, bandHeight rows tall, both
// ends of its span included. The perch stands on the approach rows, where the road's moving
// verge is drawn over the backdrop, so the verge leaves these rects to the backdrop: the
// perch never takes the verge's detail, and the cat never sits over a gap in its rail.
export function perchRects(gags: ZoneGags, bandHeight: number): Rect[] {
  return gags.perches.map(({ x0, x1 }) => ({
    height: bandHeight - PERCH_RAIL_Y,
    width: x1 - x0 + 1,
    x: x0,
    y: PERCH_RAIL_Y,
  }));
}
