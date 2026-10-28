import { stopsOnVerge } from "../runner/moverPlanning";
import { moverPlace, moverY } from "../runner/movers";
import type { RoadGeometry } from "../runner/walk";
import type { WalkItem } from "../runner/walkItems";
import type { KeptScenery, RoadPlace } from "./struckScenery";

// Whether an item is a dart that stops on the verge. It leaves the walk as it leaves the road, so
// it collides with nothing from then on, and is kept as scenery (KeptScenery).
export function goesToVerge(laneCount: number, item: WalkItem): boolean {
  return item.mover !== undefined && stopsOnVerge(laneCount, item.mover.path);
}

// The dart as it stands now, its path played on by as far as the walk has gone since it was
// kept, crossing on to its stop and then coming down the road with it; or null once it lies
// wholly past roadBottom, as the walk drops an item there, or the walk is in another zone.
export function vergeNow(
  road: Pick<RoadGeometry, "laneCount" | "roadBottom" | "roadTop">,
  run: RoadPlace,
  kept: KeptScenery,
): WalkItem | null {
  const { item } = kept;
  if (run.zoneIndex !== kept.zoneIndex || item.mover === undefined) {
    return null;
  }
  const since = item.mover.since + run.zoneDistance - kept.zoneDistance;
  const place = moverPlace(road.laneCount, item.mover.path, since);
  const y = moverY(road.roadTop, item.height, place);
  return y < road.roadBottom ? { ...item, mover: { ...item.mover, since }, y } : null;
}
