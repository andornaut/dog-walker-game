import { SECONDS_EPSILON } from "@andornaut/game-kit/clock/fixedStep";
import { keysOf } from "@andornaut/game-kit/records";

import type { DebuffId, GameData, SecondsKey } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { read } from "../rules/units";
import { laneBlockedForPull, type PullData, type PullGeometry } from "./pulls";
import { steerWalk, type Walk } from "./walk";

// An active debuff's movement profile drifts one lane toward the pack's last heading, right
// before it has steered. A blocked lane or road edge reverses the drift; two blocked lanes
// prevent it. The walk state determines every drift without drawing random numbers.

// seconds holds walking time since the last drift or the movement profile became active.
interface ZoomiesStep {
  readonly drifted: LaneDirection | null;
  readonly seconds: number;
  readonly walk: Walk;
}

// One configured owner keeps the session's single drift clock unambiguous.
export function debuffDriftProfile(
  data: Pick<GameData, "debuffs" | "tuning">,
): { readonly debuff: DebuffId; readonly every: SecondsKey } | null {
  let profile: { readonly debuff: DebuffId; readonly every: SecondsKey } | null = null;
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
    // CLEANUP (added 2026-10-31): replace with strategy evaluation before enabling its data.
    if (!("every" in movement)) {
      throw new Error("Debuff drift strategies require their runtime evaluator");
    }
    const every = read(data.tuning, "seconds", movement.every);
    if (!Number.isFinite(every) || every <= 0) {
      throw new Error("Debuff drift interval must be positive and finite");
    }
    profile = { debuff, every: movement.every };
  }
  return profile;
}

export function hasDebuffDrift(data: Pick<GameData, "debuffs" | "tuning">, walk: Walk): boolean {
  const profile = debuffDriftProfile(data);
  return profile !== null && walk.run.debuffs.some(({ debuff }) => debuff === profile.debuff);
}

// The way the pack drifts from its target lane: its heading, else the other way, or null when
// it stays.
function driftDirection(data: PullData, geometry: PullGeometry, walk: Walk): LaneDirection | null {
  const { control } = walk.road;
  const heading = control.heading ?? 1;
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

// The drift clock runs only while its debuff is active and the walk moves without hit stop.
// Each profile interval drifts one lane. An inactive profile resets the clock.
export function stepZoomies(
  data: PullData,
  geometry: PullGeometry,
  stepSeconds: number,
  seconds: number,
  walk: Walk,
): ZoomiesStep {
  const profile = debuffDriftProfile(data);
  if (profile === null || !walk.run.debuffs.some(({ debuff }) => debuff === profile.debuff)) {
    return { drifted: null, seconds: 0, walk };
  }
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { drifted: null, seconds, walk };
  }
  const every = read(data.tuning, "seconds", profile.every);
  const elapsed = seconds + stepSeconds;
  if (elapsed < every - SECONDS_EPSILON) {
    return { drifted: null, seconds: elapsed, walk };
  }
  const direction = driftDirection(data, geometry, walk);
  if (direction === null) {
    return { drifted: null, seconds: elapsed - every, walk };
  }
  return {
    drifted: direction,
    seconds: elapsed - every,
    walk: steerWalk(data, geometry.laneCount, direction, walk),
  };
}
