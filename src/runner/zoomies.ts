import { SECONDS_EPSILON } from "@andornaut/game-kit/clock/fixedStep";
import type { Random } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";

import type { DebuffId, GameData } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { read } from "../rules/units";
import { laneBlockedForPull, type PullData, type PullGeometry } from "./pulls";
import { steerWalk, type Walk } from "./walk";

// One active movement owner shares one walking-time clock and one in-memory next interval.
export interface DebuffMovementClock {
  readonly debuff: DebuffId;
  readonly elapsed: number;
  readonly interval: number;
}

interface DriftProfile {
  readonly debuff: DebuffId;
  readonly direction: "heading" | "random";
  readonly interval:
    | { readonly kind: "fixed"; readonly seconds: number }
    | { readonly kind: "uniform"; readonly max: number; readonly min: number };
}

interface DebuffMovementStep {
  readonly clock: DebuffMovementClock | null;
  readonly drifted: LaneDirection | null;
  readonly walk: Walk;
}

export function debuffDriftProfile(
  data: Pick<GameData, "debuffs" | "tuning">,
): DriftProfile | null {
  let profile: DriftProfile | null = null;
  for (const debuff of keysOf(data.debuffs)) {
    const movement = data.debuffs[debuff].movement;
    if (movement === undefined) {
      continue;
    }
    if (movement.kind !== "drift") {
      throw new Error("Unsupported debuff movement profile");
    }
    if (profile !== null) {
      throw new Error("Only one debuff may define movement");
    }
    if (movement.direction !== "heading" && movement.direction !== "random") {
      throw new Error("Unsupported debuff drift direction");
    }
    const interval = movement.interval;
    if (interval.kind !== "fixed" && interval.kind !== "uniform") {
      throw new Error("Unsupported debuff drift interval");
    }
    const min = read(
      data.tuning,
      "seconds",
      interval.kind === "fixed" ? interval.seconds : interval.min,
    );
    const max = read(
      data.tuning,
      "seconds",
      interval.kind === "fixed" ? interval.seconds : interval.max,
    );
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      throw new Error("Debuff drift intervals must be positive, finite and ordered");
    }
    profile = {
      debuff,
      direction: movement.direction,
      interval:
        interval.kind === "fixed" ? { kind: "fixed", seconds: min } : { kind: "uniform", max, min },
    };
  }
  return profile;
}

export function hasDebuffDrift(data: Pick<GameData, "debuffs" | "tuning">, walk: Walk): boolean {
  const profile = debuffDriftProfile(data);
  return profile !== null && walk.run.debuffs.some(({ debuff }) => debuff === profile.debuff);
}

// The requested one-lane direction, its safe opposite, or no movement when both are blocked.
function driftDirection(
  data: PullData,
  geometry: PullGeometry,
  heading: LaneDirection,
  walk: Walk,
): LaneDirection | null {
  const { control } = walk.road;
  const open = (direction: LaneDirection) => {
    const lane = control.target + direction;
    return (
      lane >= 0 && lane < geometry.laneCount && !laneBlockedForPull(data, geometry, lane, walk)
    );
  };
  if (open(heading)) {
    return heading;
  }
  const back: LaneDirection = heading === 1 ? -1 : 1;
  return open(back) ? back : null;
}

// Only walking time advances the schedule. Each attempted one-lane drift samples its own
// direction and next interval, including an attempt whose two candidate lanes are blocked.
export function stepDebuffMovement(
  data: PullData,
  geometry: PullGeometry,
  random: Random,
  stepSeconds: number,
  clock: DebuffMovementClock | null,
  walk: Walk,
): DebuffMovementStep {
  const profile = debuffDriftProfile(data);
  if (profile === null || !walk.run.debuffs.some(({ debuff }) => debuff === profile.debuff)) {
    return { clock: null, drifted: null, walk };
  }
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { clock, drifted: null, walk };
  }
  const nextInterval = () => {
    const { interval } = profile;
    return interval.kind === "fixed"
      ? interval.seconds
      : interval.min + (interval.max - interval.min) * random();
  };
  const current =
    clock?.debuff === profile.debuff
      ? clock
      : { debuff: profile.debuff, elapsed: 0, interval: nextInterval() };
  const elapsed = current.elapsed + stepSeconds;
  if (elapsed < current.interval - SECONDS_EPSILON) {
    return { clock: { ...current, elapsed }, drifted: null, walk };
  }
  const heading =
    profile.direction === "random" ? (random() < 0.5 ? -1 : 1) : (walk.road.control.heading ?? 1);
  const direction = driftDirection(data, geometry, heading, walk);
  return {
    clock: {
      debuff: profile.debuff,
      elapsed: Math.max(0, elapsed - current.interval),
      interval: nextInterval(),
    },
    drifted: direction,
    walk: direction === null ? walk : steerWalk(data, geometry.laneCount, direction, walk),
  };
}
