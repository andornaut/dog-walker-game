import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import type { RoadGeometry } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const ROAD = screenLayout(SCREEN_CONFIG).road;
const VIEW = walkProjection(ROAD_CAMERA, ROAD);
const GEOMETRIES = new Map<number, RoadGeometry>();

// The road's geometry on the game's screen for the run's pack, which the run scene and the
// simulator both walk: one per pack size, made once.
export function screenRoadGeometry(run: RunState): RoadGeometry {
  const dogs = packDogs(run).length;
  let geometry = GEOMETRIES.get(dogs);
  if (geometry === undefined) {
    geometry = walkGeometry(LANE_COUNT, dogs, VIEW, ROAD);
    GEOMETRIES.set(dogs, geometry);
  }
  return geometry;
}
