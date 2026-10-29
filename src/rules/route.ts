import { itemAt } from "@andornaut/game-kit/arrays";
import { type Random, randomPick } from "@andornaut/game-kit/random";

import type { GameData, Zone, ZoneId } from "../data/types";
import type { RunState } from "../state/runState";

export type RouteData = Pick<GameData, "world">;

// A fork's paths, left to right.
const PATH_SIDES = ["left", "straight", "right"] as const;
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

function isZoneId(data: RouteData, id: string): id is ZoneId {
  return data.world.zones.some((zone) => zone.id === id);
}

export function firstZoneId(data: RouteData): ZoneId {
  const { firstZone } = data.world;
  if (!isZoneId(data, firstZone)) {
    throw new RangeError(`The first zone ${firstZone} is not in ${data.world.name}`);
  }
  return firstZone;
}

// A zone a walk can take between its first and last: the first in world order that is
// neither.
export function middleZoneId(data: RouteData): ZoneId {
  const { firstZone, lastZone, name, zones } = data.world;
  const id = zones.find((zone) => zone.id !== firstZone && zone.id !== lastZone)?.id;
  if (id === undefined || !isZoneId(data, id)) {
    throw new RangeError(`${name} has no zone between its first and last`);
  }
  return id;
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

// The zone the run walked before its current one, or null in its first.
export function previousZone(
  data: RouteData,
  run: Pick<RunState, "route" | "zoneIndex">,
): Zone | null {
  return run.zoneIndex === 0 ? null : zoneAt(data, run.route, run.zoneIndex - 1);
}

// The id of the zone the run is in.
export function currentZoneId(data: RouteData, run: Pick<RunState, "route" | "zoneIndex">): ZoneId {
  return zoneIdAt(data, run.route, run.zoneIndex);
}

// The id of the zone the run walked before its current one, or null in its first.
export function previousZoneId(
  data: RouteData,
  run: Pick<RunState, "route" | "zoneIndex">,
): ZoneId | null {
  return run.zoneIndex === 0 ? null : zoneIdAt(data, run.route, run.zoneIndex - 1);
}

// The zones not yet walked this run, in world order: easiest first.
export function unwalkedZones(data: RouteData, route: readonly ZoneId[]): ZoneId[] {
  return data.world.zones.flatMap((zone) =>
    isZoneId(data, zone.id) && !route.includes(zone.id) ? [zone.id] : [],
  );
}

// Up to three unwalked zones drawn at random, sorted easiest on the left to hardest on the
// right. The world's last zone ends every walk: the fork before the last zone leads only
// there, and no earlier fork offers it.
export function forkPaths(data: RouteData, random: Random, route: readonly ZoneId[]): ZoneId[] {
  const last = data.world.lastZone as ZoneId;
  if (route.length >= walkLength(data) - 1) {
    return [last];
  }
  const pool = unwalkedZones(data, route).filter((zone) => zone !== last);
  const drawn = new Set<ZoneId>();
  while (drawn.size < Math.min(PATH_SIDES.length, pool.length)) {
    const left = pool.filter((zone) => !drawn.has(zone));
    drawn.add(randomPick(random, left));
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
export function defaultRoute(data: RouteData, zoneCount: number): ZoneId[] {
  return data.world.preForkRoute.slice(0, Math.max(1, zoneCount)) as ZoneId[];
}
