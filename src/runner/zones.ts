import { itemAt } from "../arrays";

// length is a scroll distance in pixels; speedMultiplier scales the route's base speed.
export interface ZoneSpec {
  length: number;
  speedMultiplier: number;
}

// baseSpeed is in pixels per second. A route needs at least one zone.
export interface ZoneRoute {
  baseSpeed: number;
  zones: readonly ZoneSpec[];
}

// distance runs from the start of the run; zoneDistance from the start of the current zone.
export interface ZoneProgress {
  distance: number;
  finished: boolean;
  zoneDistance: number;
  zoneIndex: number;
}

// completedZones lists the zones that ended during the step, in order.
export interface ZoneStep {
  completedZones: number[];
  progress: ZoneProgress;
}

export const runStart: ZoneProgress = {
  distance: 0,
  finished: false,
  zoneDistance: 0,
  zoneIndex: 0,
};

const zoneSpeed = (route: ZoneRoute, zoneIndex: number): number =>
  route.baseSpeed * itemAt(route.zones, zoneIndex).speedMultiplier;

// Pixels per second in the current zone, and 0 once the run has finished.
export function zoneScrollSpeed(route: ZoneRoute, progress: ZoneProgress): number {
  return progress.finished ? 0 : zoneSpeed(route, progress.zoneIndex);
}

// How far through the current zone, from 0 to 1. advanceZones keeps zoneDistance within
// the zone's length.
export function zoneFraction(route: ZoneRoute, progress: ZoneProgress): number {
  return progress.zoneDistance / itemAt(route.zones, progress.zoneIndex).length;
}

// Time left in the step after a zone ends is spent at the next zone's speed. The run
// finishes at the end of the last zone, and the distance stops there.
export function advanceZones(
  route: ZoneRoute,
  stepSeconds: number,
  progress: ZoneProgress,
): ZoneStep {
  const { zones } = route;
  const completedZones: number[] = [];
  let { distance, finished, zoneDistance, zoneIndex } = progress;
  let secondsLeft = stepSeconds;
  while (!finished && secondsLeft > 0) {
    const zone = itemAt(zones, zoneIndex);
    const speed = zoneSpeed(route, zoneIndex);
    const distanceLeft = zone.length - zoneDistance;
    const travel = speed * secondsLeft;
    if (travel < distanceLeft) {
      distance += travel;
      zoneDistance += travel;
      break;
    }
    distance += distanceLeft;
    secondsLeft -= speed > 0 ? distanceLeft / speed : 0;
    completedZones.push(zoneIndex);
    if (zoneIndex === zones.length - 1) {
      finished = true;
      zoneDistance = zone.length;
    } else {
      zoneIndex += 1;
      zoneDistance = 0;
    }
  }
  return { completedZones, progress: { distance, finished, zoneDistance, zoneIndex } };
}
