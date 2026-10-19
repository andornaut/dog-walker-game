import { itemAt } from "../arrays";
import type { GameData, Zone, ZoneId } from "../data/types";
import type { RunState } from "../state/runState";

export type RouteData = Pick<GameData, "world">;

// The zones every walk took before forks, in order. A save or dev start without a route
// walked them.
export const PRE_FORK_ROUTE: readonly ZoneId[] = ["street", "park", "shops", "homeStretch"];

// A fork's paths, left to right.
export const PATH_SIDES = ["left", "straight", "right"] as const;
export type PathSide = (typeof PATH_SIDES)[number];

// How many zones a walk visits: the world's walk length, or every zone if the world has fewer.
export function walkLength(data: RouteData): number {
  return Math.min(data.world.walkLength, data.world.zones.length);
}

export function zoneById(data: RouteData, id: ZoneId): Zone {
  const zone = data.world.zones.find((candidate) => candidate.id === id);
  if (zone === undefined) {
    throw new RangeError(`No zone ${id} in ${data.world.name}`);
  }
  return zone;
}

export function isZoneId(data: RouteData, id: string): id is ZoneId {
  return data.world.zones.some((zone) => zone.id === id);
}

export function firstZoneId(data: RouteData): ZoneId {
  const { firstZone } = data.world;
  if (!isZoneId(data, firstZone)) {
    throw new RangeError(`The first zone ${firstZone} is not in ${data.world.name}`);
  }
  return firstZone;
}

// The zone at a route position. Between a zone's end and the fork after it, the position has
// no zone yet, so it is the last zone walked.
export function zoneAt(data: RouteData, route: readonly ZoneId[], zoneIndex: number): Zone {
  return zoneById(data, zoneIdAt(data, route, zoneIndex));
}

function zoneIdAt(data: RouteData, route: readonly ZoneId[], zoneIndex: number): ZoneId {
  return route[Math.min(zoneIndex, route.length - 1)] ?? firstZoneId(data);
}

// The zone the run is in.
export function currentZone(data: RouteData, run: Pick<RunState, "route" | "zoneIndex">): Zone {
  return zoneAt(data, run.route, run.zoneIndex);
}

// The id of the zone the run is in.
export function currentZoneId(data: RouteData, run: Pick<RunState, "route" | "zoneIndex">): ZoneId {
  return zoneIdAt(data, run.route, run.zoneIndex);
}

// The zones not yet walked this run, in world order: easiest first.
export function unwalkedZones(data: RouteData, route: readonly ZoneId[]): ZoneId[] {
  return data.world.zones.flatMap((zone) =>
    isZoneId(data, zone.id) && !route.includes(zone.id) ? [zone.id] : [],
  );
}

// Up to three unwalked zones drawn at random, sorted easiest on the left to hardest on the
// right.
export function forkPaths(
  data: RouteData,
  random: () => number,
  route: readonly ZoneId[],
): ZoneId[] {
  const pool = unwalkedZones(data, route);
  const drawn = new Set<ZoneId>();
  while (drawn.size < Math.min(PATH_SIDES.length, pool.length)) {
    const left = pool.filter((zone) => !drawn.has(zone));
    drawn.add(itemAt(left, Math.floor(random() * left.length)));
  }
  return pool.filter((zone) => drawn.has(zone));
}

// Where a fork's path at index goes: three paths are left, straight and right; two are left
// and right; one goes straight on.
export function pathSide(index: number, pathCount: number): PathSide {
  if (pathCount === 1) {
    return "straight";
  }
  return pathCount === 2 ? (index === 0 ? "left" : "right") : itemAt(PATH_SIDES, index);
}

// The route of a walk started at a later position with no route given: the pre-fork route's
// first zoneCount zones.
export function defaultRoute(zoneCount: number): ZoneId[] {
  return PRE_FORK_ROUTE.slice(0, Math.max(1, zoneCount));
}
