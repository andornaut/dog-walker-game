import { moverPlace, moverY, stopsOnVerge } from "../../runner/movers";
import type { WalkItem } from "../../runner/walk";

// A dart that stops on the verge leaves the walk as it leaves the road, so it collides with
// nothing from then on, and is kept as scenery: the item as the walk last had it, and the zone
// and how far into it the walk was then. Scenery is drawn only: the walk never sees it.
export interface VergeItem {
  readonly item: WalkItem;
  readonly zoneDistance: number;
  readonly zoneIndex: number;
}

// Which zone the walk is in, and how far into it.
interface RoadPlace {
  readonly zoneDistance: number;
  readonly zoneIndex: number;
}

// Whether an item is a dart that stops on the verge, which is kept as scenery once off the road.
export function goesToVerge(laneCount: number, item: WalkItem): boolean {
  return item.mover !== undefined && stopsOnVerge(laneCount, item.mover.path);
}

// The dart as it stands now, its path played on by as far as the walk has gone since it was
// kept, crossing on to its stop and then coming down the road with it; or null once it lies
// wholly past roadBottom, as the walk drops an item there, or the walk is in another zone.
export function vergeNow(
  road: { readonly laneCount: number; readonly roadBottom: number; readonly roadTop: number },
  run: RoadPlace,
  kept: VergeItem,
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
