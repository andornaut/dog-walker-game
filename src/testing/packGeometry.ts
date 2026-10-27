import type { RoadGeometry } from "../runner/walk";
import { walkGeometry } from "../runner/walkGeometry";

// A focal length long enough that the road's rows are flat: a row dy up the screen from the
// walker's feet is dy road pixels ahead, to well within a hundredth of a pixel.
const FLAT_FOCAL = 1e7;
const FOOT_Y = 634;
const FLAT_LENS = { focal: FLAT_FOCAL, footY: FOOT_Y, horizonY: FOOT_Y - FLAT_FOCAL };

// The game's pack of three on a flat test road, the walker's feet on FOOT_Y, placed as the walk
// places it: Casey with Kilo leading, Biscuit and Buddy. Its first dogs stand in for a smaller
// pack's. The road's rect only sets the feet row; the rest of the test road is its own.
const { packBand, packParts } = walkGeometry(
  5,
  { dogs: ["kilo", "biscuit", "buddy"], walker: "casey" },
  { ...FLAT_LENS, visibleDistance: 0 },
  { height: FOOT_Y, width: 280, x: 0, y: 4 },
);

// A flat five-lane test road with the test pack on it.
export const TEST_ROAD_GEOMETRY: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  // On a flat road every row is drawn at scale 1, so the road's centre moves nothing.
  lens: { centerX: 0, ...FLAT_LENS },
  packBand,
  packParts,
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
};
