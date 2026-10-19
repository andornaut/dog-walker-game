import { occupiedLanes } from "../runner/laneMotion";
import { isNeedSpot, isOtherDog, nextNeedMoment } from "../runner/needs";
import { nextPullMoment, type Pulls } from "../runner/pulls";
import { laneMask } from "../runner/spawning";
import { blocksLane, footprintOf, type Walk, zoneLength } from "../runner/walk";
import { type BotRoad, contactWindow, itemLanes, moverContacts, reachMask } from "./bot";

// A step ends this long after the moment it is cut at, so the moment has passed when the walk
// is sampled.
const PAST = 1e-6;
// The step taken while something touches the pack without being hit, as the game takes it.
const FRAME_SECONDS = 1 / 60;

// A step that ends just before a pull's moment, then one that crosses it, so the pull applies
// at its moment: stepPulls pulls in the step that runs its tell out.
function untilPullMoment(remaining: number): number {
  return remaining > 2 * PAST ? remaining - PAST : remaining + PAST / 10;
}

// Seconds of walking until the walk must next be sampled, between which it changes only by
// scrolling: the hit stop's end, an item or forced stop starting to touch the pack in a lane
// it occupies (or, for a pickup, can reach), a mover or squirrel coming into view, the pack's
// lane move ending, a dog's tell or pull, something a dog could pull toward coming into view, a
// dog's need turning urgent or going wrong, or the zone's end. While an obstacle touches the
// pack inside the hit grace, the grace's end; while a strain waits on its target, every frame.
export function nextWalkEvent(road: BotRoad, pulls: Pulls, walk: Walk): number {
  const { hitStop } = walk.road;
  if (hitStop !== null) {
    return hitStop.seconds;
  }
  const { data, geometry, speed } = road;
  const { control, forcedStopAhead, forcedStopOnRoad, invulnerableSeconds, items, pending } =
    walk.road;
  const band = geometry.packBand;
  const occupied = laneMask(occupiedLanes(control.motion));
  const { zoneDistance } = walk.run;
  let next = (zoneLength(data, walk.run) - zoneDistance) / speed + PAST;
  if (control.motion.kind === "moving") {
    next = Math.min(next, control.motion.duration - control.motion.elapsed);
  }
  const pullAt = nextPullMoment(pulls, FRAME_SECONDS);
  if (pullAt !== Infinity) {
    next = Math.min(next, untilPullMoment(pullAt));
  }
  next = Math.min(next, nextNeedMoment(data, walk.run) + PAST);
  // What an item touching the pack calls for: the end of the grace, or the next frame.
  const touching = (item: (typeof items)[number]) =>
    blocksLane(data, item.kind) && invulnerableSeconds > 0
      ? invulnerableSeconds + PAST
      : FRAME_SECONDS;
  for (const item of items) {
    if (item.mover !== undefined) {
      for (const contact of moverContacts(road, next, item)) {
        if ((occupied & (1 << contact.lane)) !== 0) {
          next = Math.min(next, contact.from > 0 ? contact.from : touching(item));
        }
      }
      continue;
    }
    if ((itemLanes(item) & reachMask(road, walk, item.kind, occupied)) === 0) {
      continue;
    }
    const { end, start } = contactWindow(band, speed, item.y, item.height);
    if (end <= 0) {
      continue;
    }
    if (start > 0) {
      next = Math.min(next, start + PAST);
    } else {
      next = Math.min(next, touching(item));
    }
  }
  const stopHeight = geometry.itemHeights.forcedStop;
  if (forcedStopOnRoad !== null) {
    const { start } = contactWindow(band, speed, forcedStopOnRoad.y, stopHeight);
    next = Math.min(next, Math.max(0, start) + PAST);
  }
  // Something not yet in view has its bottom edge at the far edge of the road plus the road
  // still to go before it comes into view.
  const fromTop = (distance: number) =>
    (band.top - geometry.roadTop + distance - zoneDistance) / speed;
  if (forcedStopAhead !== null) {
    next = Math.min(next, fromTop(forcedStopAhead.distance) + PAST);
  }
  for (const spawn of pending) {
    const appears = (spawn.distance - zoneDistance) / speed;
    if (appears >= next) {
      break;
    }
    // A squirrel, treat, need spot or other dog coming into view can start a strain.
    const target =
      spawn.kind === "squirrel" ||
      spawn.kind === "treat" ||
      isNeedSpot(data, spawn.kind) ||
      isOtherDog(data, spawn.kind);
    if (spawn.mover !== undefined || target) {
      next = Math.min(next, appears + PAST);
      continue;
    }
    const start = fromTop(spawn.distance);
    const lanes = itemLanes({ lane: spawn.lane, laneSpan: footprintOf(data, spawn.kind).lanes });
    if ((lanes & reachMask(road, walk, spawn.kind, occupied)) !== 0) {
      next = Math.min(next, start + PAST);
    }
  }
  return next;
}
