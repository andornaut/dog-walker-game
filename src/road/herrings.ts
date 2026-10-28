import type { GameData } from "../data/types";
import { hasLeftRoad, moverPlace, moverY } from "../runner/movers";
import type { SpawnEvent } from "../runner/spawning";
import { itemHeight, type RoadGeometry } from "../runner/walk";
import { footprintOf, type WalkItem, type WalkItemKind } from "../runner/walkItems";

// The red herring crossers (herringSpawn in src/runner/moverPlanning.ts): a share of a kind's
// planned crossers, such as the tourist train, that the planner leaves off the road. Each crosses
// the whole road far up it, with no cue, blocking nothing and colliding with nothing: the walk
// never reads them. Each is drawn as the mover it looks like would be, at its depth and in its art,
// from as its row comes on screen until it has left the road past its far edge. Like the road's
// movers it is measured in road scroll, so it stands still while the road does.

// A red herring as the road item it is drawn as zoneDistance into its zone, or null while it is not
// on the road: before its row comes on screen, and once it has crossed.
export function herringNow(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<
    RoadGeometry,
    "cell" | "itemHeights" | "laneCount" | "lens" | "packBand" | "roadTop"
  >,
  zoneDistance: number,
  herring: SpawnEvent<WalkItemKind>,
):
  | (Pick<WalkItem, "height" | "kind" | "laneSpan" | "y"> & Required<Pick<WalkItem, "mover">>)
  | null {
  const { mover: path } = herring;
  const since = zoneDistance - herring.distance;
  if (path === undefined || since < 0) {
    return null;
  }
  const place = moverPlace(geometry.laneCount, path, since);
  if (hasLeftRoad(geometry.laneCount, place)) {
    return null;
  }
  const height = itemHeight(data, geometry, herring.kind, true);
  return {
    height,
    kind: herring.kind,
    laneSpan: footprintOf(data, herring.kind).lanes,
    mover: { path, since },
    y: moverY(geometry.roadTop, height, place),
  };
}
