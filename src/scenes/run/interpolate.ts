import type { GameData } from "../../data/types";
import { clamp01 } from "../../lib/numbers";
import { pixels } from "../../lib/units";
import { advanceLaneControl } from "../../runner/laneControl";
import type { SessionInput } from "../../runner/session";
import { laneMotionConfig, steerWalk, type Walk } from "../../runner/walk";
import { type WalkItem } from "../../runner/walkItems";

// The walk as drawn between two fixed steps. The session steps at 60 Hz while the screen may
// refresh at any rate, so each frame draws the last two steps' walks blended by how far the
// clock has banked toward the next step: motion advances every frame, evenly, rather than by
// zero, one or two steps. The pack's lane slide leads instead (see leadWalk). Only drawing
// reads the blend and the lead; the session stays as stepped.

// How far toward the next step a frame is: its banked time over a step, within 0 to 1.
export function stepAlpha(bankedMs: number, stepMs: number): number {
  return clamp01(bankedMs / stepMs);
}

function lerp(alpha: number, from: number, to: number): number {
  return from + (to - from) * alpha;
}

// The walk with its pack's lane control as of the frame's time: the lane moves queued for the
// next step steered as that step will steer them, then the move advanced by the seconds banked
// toward it. A lane move shows on the first frame drawn after its input, with no wait for a
// step and no step of blending behind it. A pull or a hit in the next step can still change
// the control; the step's own control replaces the lead once it runs. A hit stop holds the
// pack and drops steering, as the step does.
export function leadWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  seconds: number,
  queued: readonly SessionInput[],
  walk: Walk,
): Walk {
  if (walk.road.hitStop !== null || walk.run.phase.kind !== "walking") {
    return walk;
  }
  const steered = queued.reduce(
    (current, input) =>
      input.kind === "lane" ? steerWalk(data, laneCount, input.direction, current) : current,
    walk,
  );
  if (seconds <= 0) {
    return steered;
  }
  const config = laneMotionConfig(data, laneCount, steered.run);
  const control = advanceLaneControl(config, seconds, steered.road.control);
  return { ...steered, road: { ...steered.road, control } };
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

// The walk drawn alpha of the way from previous to current, with current's lane control. Across
// a change of zone the newer step draws as it is, since its distances start again.
export function blendWalk(alpha: number, previous: Walk, current: Walk): Walk {
  if (previous === current || previous.run.zoneIndex !== current.run.zoneIndex || alpha >= 1) {
    return current;
  }
  const before = new Map(previous.road.items.map((item) => [item.id, item]));
  const { road, run } = current;
  return {
    road: {
      ...road,

      items: road.items.map((item) => blendItem(alpha, before.get(item.id), item)),
    },
    run: {
      ...run,
      zoneDistance: pixels(lerp(alpha, previous.run.zoneDistance, run.zoneDistance)),
    },
  };
}
