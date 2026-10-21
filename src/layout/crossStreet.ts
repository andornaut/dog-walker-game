import { SCREEN_CONFIG } from "../data/screen";

// The backdrops' cross street, as the band rows its ambient movers stand on: the bottom row of
// each sidewalk and lane (far sidewalk 39 to 36 rows over the band's bottom edge, far lane 33 to
// 30, near lane 28 to 25, near sidewalk 24 to 20). The backdrops draw the street at fixed rows
// over the band's bottom edge, so those rows count up from it.

// The band row `rows` up from the band's bottom edge, where the band's last row is 1.
const overBottom = (rows: number): number => SCREEN_CONFIG.backdropHeight - rows;

export const CROSS_STREET = {
  farLane: overBottom(30),
  farWalk: overBottom(36),
  nearLane: overBottom(25),
  nearWalk: overBottom(20),
} as const;
