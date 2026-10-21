import { pixels } from "../../rules/units";
import type { LaneMotion } from "../../runner/laneMotion";
import type { Walk, WalkItem } from "../../runner/walk";

// The walk as drawn between two fixed steps. The session steps at 60 Hz while the screen may
// refresh at any rate, so each frame draws the last two steps' walks blended by how far the
// clock has banked toward the next step: motion advances every frame, evenly, rather than by
// zero, one or two steps. Only drawing reads the blend; the session stays as stepped.

// How far toward the next step a frame is: its banked time over a step, within 0 to 1.
export function stepAlpha(bankedMs: number, stepMs: number): number {
  return Math.min(1, Math.max(0, bankedMs / stepMs));
}

function lerp(alpha: number, from: number, to: number): number {
  return from + (to - from) * alpha;
}

// A move's progress blends while it is the same move in both steps; anything else draws as
// the newer step has it.
function blendMotion(alpha: number, previous: LaneMotion, current: LaneMotion): LaneMotion {
  if (
    previous.kind === "moving" &&
    current.kind === "moving" &&
    previous.from === current.from &&
    previous.to === current.to
  ) {
    return { ...current, elapsed: lerp(alpha, previous.elapsed, current.elapsed) };
  }
  return current;
}

// An item in both steps blends its place on the road, and a mover how far it has gone; an item
// new in the newer step stands where it came in.
function blendItem(alpha: number, previous: WalkItem | undefined, current: WalkItem): WalkItem {
  if (previous === undefined) {
    return current;
  }
  const y = lerp(alpha, previous.y, current.y);
  if (current.mover === undefined || previous.mover?.path !== current.mover.path) {
    return { ...current, y };
  }
  const since = lerp(alpha, previous.mover.since, current.mover.since);
  return { ...current, mover: { ...current.mover, since }, y };
}

// The walk drawn alpha of the way from previous to current. Across a change of zone the
// newer step draws as it is, since its distances start again.
export function blendWalk(alpha: number, previous: Walk, current: Walk): Walk {
  if (previous === current || previous.run.zoneIndex !== current.run.zoneIndex || alpha >= 1) {
    return current;
  }
  const before = new Map(previous.road.items.map((item) => [item.id, item]));
  const { road, run } = current;
  const stop = road.forcedStopOnRoad;
  const stopBefore = previous.road.forcedStopOnRoad;
  return {
    road: {
      ...road,
      control: {
        ...road.control,
        motion: blendMotion(alpha, previous.road.control.motion, road.control.motion),
      },
      forcedStopOnRoad:
        stop === null || stopBefore?.stop !== stop.stop
          ? stop
          : { ...stop, y: lerp(alpha, stopBefore.y, stop.y) },
      items: road.items.map((item) => blendItem(alpha, before.get(item.id), item)),
    },
    run: {
      ...run,
      zoneDistance: pixels(lerp(alpha, previous.run.zoneDistance, run.zoneDistance)),
    },
  };
}
