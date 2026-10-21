import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { formationOrder } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import type { RoadGeometry } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const ROAD = screenLayout(SCREEN_CONFIG).road;
const VIEW = walkProjection(ROAD_CAMERA, ROAD);
const GEOMETRIES = new Map<string, RoadGeometry>();

// The road's geometry on the game's screen for the run's walker and walking dogs, which the run
// scene and the simulator both walk: one per pack, made once.
export function screenRoadGeometry(run: Pick<RunState, "pack" | "walker">): RoadGeometry {
  const pack = { dogs: formationOrder(packDogs(run)), walker: run.walker };
  const key = `${pack.walker} ${pack.dogs.join(" ")}`;
  let geometry = GEOMETRIES.get(key);
  if (geometry === undefined) {
    geometry = walkGeometry(LANE_COUNT, pack, VIEW, ROAD);
    GEOMETRIES.set(key, geometry);
  }
  return geometry;
}
