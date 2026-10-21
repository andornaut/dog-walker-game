import {
  packOnRoad,
  packOutline,
  type PackSprites,
  PART_INSET,
  type PartBox,
} from "../layout/packFormation";
import type { RoadGeometry } from "../runner/walk";

// A focal length long enough that the road's rows are flat: a row dy up the screen from the
// walker's feet is dy road pixels ahead, to well within a hundredth of a pixel.
const FLAT_FOCAL = 1e7;

// The game's pack of three on a flat test road, the walker's feet on walkerFootY: Casey with
// Koda leading, Biscuit and Zippy. Its first dogs stand in for a smaller pack's.
export function testPack(walkerFootY: number): Pick<RoadGeometry, "packBand" | "packParts"> {
  const lens = { focal: FLAT_FOCAL, footY: walkerFootY, horizonY: walkerFootY - FLAT_FOCAL };
  const pack: PackSprites = { dogs: ["koda", "biscuit", "zippy"], walker: "casey" };
  const along = (part: PartBox): PartBox => ({
    ...part,
    bottom: walkerFootY + part.bottom,
    top: walkerFootY + part.top,
  });
  const parts = packOnRoad(lens, PART_INSET, pack);
  const outline = along(packOutline(packOnRoad(lens, 0, pack)));
  return {
    packBand: { bottom: outline.bottom, top: outline.top },
    packParts: { dogs: parts.dogs.map(along), outline, walker: along(parts.walker) },
  };
}
