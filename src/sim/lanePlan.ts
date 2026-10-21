import { clampIndex } from "../arrays";
import type { LaneDirection } from "../layout/lanes";

// Times are seconds of walking from now, and lanes are lane masks: bit n set means lane n.
// A hazard is hit by a pack that occupies one of its lanes during the open interval
// (from, to). Anything that moves across lanes, such as a mover, is several hazards, one per
// lane mask it holds over a stretch of time.
export interface LaneHazard {
  readonly from: number;
  readonly lanes: number;
  readonly to: number;
}

// A prize counts as collected when the pack occupies one of its lanes at the moment it first
// touches the pack.
export interface LanePrize {
  readonly at: number;
  readonly lanes: number;
  readonly value: number;
}

// A dog's pull seen coming: at at, the pack is pulled one lane toward direction, or inward
// from the edge lane, and lane changes lock for lockSeconds once that move ends. The plan
// changes lanes no sooner than reactSeconds after the pull either.
export interface LanePull {
  readonly at: number;
  readonly direction: LaneDirection;
  readonly lockSeconds: number;
  readonly reactSeconds: number;
}

// moveStep is the time from one lane change to the next: at least moveSeconds, longer with a
// cooldown. gridSeconds spaces the times the plan may wait until; the ends of hazards and
// locks, and whole lane changes after them, are tried too, so a gap is used to its full
// length.
export interface LanePlanConfig {
  readonly gridSeconds: number;
  readonly horizon: number;
  readonly laneCount: number;
  readonly moveSeconds: number;
  readonly moveStep: number;
}

// The pack is still in lane from readyAt on, and may change lanes from movableAt on.
export interface PlanStart {
  readonly lane: number;
  readonly movableAt: number;
  readonly readyAt: number;
}

export interface PlannedMove {
  readonly at: number;
  readonly direction: LaneDirection;
}

const HIT_COST = 1000;
const MOVE_COST = 0.01;
const SAME_TIME = 1e-9;
// A lock is taken to last this much longer than it does, so rounding never has a lane change
// start during it.
export const LOCK_MARGIN = 1e-4;

const STAY = 0;
const PULLED = 2;
const DIRECTIONS = [-1, 1] as const;

function sortedTimes(
  config: LanePlanConfig,
  start: PlanStart,
  end: number,
  anchors: readonly number[],
): number[] {
  const { gridSeconds, laneCount, moveStep } = config;
  const times: number[] = [];
  for (let i = 0; start.readyAt + i * gridSeconds < end; i++) {
    times.push(start.readyAt + i * gridSeconds);
  }
  for (const anchor of anchors) {
    for (let k = 0; k < laneCount; k++) {
      const time = anchor + k * moveStep;
      if (time > start.readyAt && time < end) {
        times.push(time);
      }
    }
  }
  times.push(end);
  times.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const time of times) {
    const last = unique.at(-1);
    if (last === undefined || time - last > SAME_TIME) {
      unique.push(time);
    }
  }
  return unique;
}

// The first index whose time is at or after time, or the last index.
function indexAtOrAfter(times: readonly number[], time: number): number {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((times[middle] ?? 0) < time - SAME_TIME) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

// When the plan may change lanes again after a pull: after the pull's lane change, if it
// moves the pack, and its lock, and after the reaction.
function unlocksAt(moveSeconds: number, pull: LanePull, moves: boolean): number {
  const locked = (moves ? moveSeconds : 0) + pull.lockSeconds;
  return pull.at + Math.max(locked, pull.reactSeconds) + LOCK_MARGIN;
}

// The cheapest way through the hazards, collecting what prizes it safely can: a hit costs
// HIT_COST, so a plan only takes a hit it cannot avoid, and each lane change costs a little,
// so the plan does not weave for nothing. Each lane change takes moveSeconds, during which
// the pack occupies both lanes. A pull moves the pack whatever the plan, so the plan works
// around it: none of its own lane changes is under way when a pull comes, and none starts
// until the pull's lock ends. Returns the plan's own lane changes in time order.
export function planLanes(
  config: LanePlanConfig,
  start: PlanStart,
  hazards: readonly LaneHazard[],
  prizes: readonly LanePrize[],
  pulls: readonly LanePull[],
): PlannedMove[] {
  const { laneCount, moveSeconds, moveStep } = config;
  const coming = pulls.filter((pull) => pull.at >= start.readyAt);
  const latest = Math.max(
    start.movableAt,
    ...hazards.map((hazard) => hazard.to),
    ...prizes.map((prize) => prize.at),
    ...coming.map((pull) => unlocksAt(moveSeconds, pull, true)),
  );
  const end = Math.max(
    start.readyAt + moveStep,
    Math.min(config.horizon, latest + laneCount * moveStep),
  );
  const times = sortedTimes(config, start, end, [
    start.movableAt,
    ...hazards.map((hazard) => hazard.to),
    ...prizes.map((prize) => prize.at - moveSeconds),
    ...coming.flatMap((pull) => [
      pull.at,
      unlocksAt(moveSeconds, pull, false),
      unlocksAt(moveSeconds, pull, true),
    ]),
  ]);
  const count = times.length;
  const pullAt = (time: number) => coming.find((pull) => Math.abs(pull.at - time) <= SAME_TIME);
  // A pull toward the road edge from the edge lane turns inward.
  const pulledTo = (pull: LanePull, lane: number) => {
    const to = lane + pull.direction;
    return to < 0 || to >= laneCount ? clampIndex(laneCount, lane - pull.direction) : to;
  };
  // A lane change started at time would still be under way when a pull comes.
  const pullDuring = (time: number) =>
    coming.some((pull) => pull.at > time + SAME_TIME && pull.at < time + moveStep);

  const lanesOf = <Item extends { readonly lanes: number }>(items: readonly Item[]) =>
    Array.from({ length: laneCount }, (_, lane) =>
      items.filter((item) => (item.lanes & (1 << lane)) !== 0),
    );
  const hazardsIn = lanesOf(hazards);
  const prizesIn = lanesOf(prizes);

  // The cost of occupying stay over [from, to), and leave over [from, leaveUntil) as well,
  // where leaveUntil is at most to, so what covers both lanes counts once.
  const occupyCost = (
    stay: number,
    from: number,
    to: number,
    leave: number,
    leaveUntil: number,
  ): number => {
    const stayMask = 1 << stay;
    let cost = 0;
    for (const hazard of hazardsIn[stay] ?? []) {
      if (hazard.from < to && hazard.to > from) {
        cost += HIT_COST;
      }
    }
    for (const prize of prizesIn[stay] ?? []) {
      if (prize.at >= from && prize.at < to) {
        cost -= prize.value;
      }
    }
    if (leave < 0) {
      return cost;
    }
    for (const hazard of hazardsIn[leave] ?? []) {
      if ((hazard.lanes & stayMask) === 0 && hazard.from < leaveUntil && hazard.to > from) {
        cost += HIT_COST;
      }
    }
    for (const prize of prizesIn[leave] ?? []) {
      if ((prize.lanes & stayMask) === 0 && prize.at >= from && prize.at < leaveUntil) {
        cost -= prize.value;
      }
    }
    return cost;
  };

  // The cost to go from each time and lane, still, and the choice that gets it.
  const value = new Float64Array(count * laneCount);
  const choice = new Int8Array(count * laneCount);
  const arrival = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    arrival[i] = indexAtOrAfter(times, (times[i] ?? 0) + moveStep);
  }
  for (let i = count - 2; i >= 0; i--) {
    const now = times[i] ?? 0;
    const pull = coming.length === 0 ? undefined : pullAt(now);
    if (pull !== undefined) {
      for (let lane = 0; lane < laneCount; lane++) {
        const to = pulledTo(pull, lane);
        const unlocked = indexAtOrAfter(times, unlocksAt(moveSeconds, pull, to !== lane));
        const unlockedAt = times[unlocked] ?? end;
        value[i * laneCount + lane] =
          (to === lane
            ? occupyCost(lane, now, unlockedAt, -1, 0)
            : occupyCost(to, now, unlockedAt, lane, now + moveSeconds)) +
          (value[unlocked * laneCount + to] ?? 0);
        choice[i * laneCount + lane] = PULLED;
      }
      continue;
    }
    const next = times[i + 1] ?? end;
    const landed = arrival[i] ?? count - 1;
    const landedAt = Math.max(times[landed] ?? end, now + moveStep);
    const canMove = now >= start.movableAt - SAME_TIME && (coming.length === 0 || !pullDuring(now));
    for (let lane = 0; lane < laneCount; lane++) {
      let best = occupyCost(lane, now, next, -1, 0) + (value[(i + 1) * laneCount + lane] ?? 0);
      let bestChoice = STAY;
      if (canMove) {
        for (const direction of DIRECTIONS) {
          const to = lane + direction;
          if (to < 0 || to >= laneCount) {
            continue;
          }
          const cost =
            MOVE_COST +
            occupyCost(to, now, landedAt, lane, now + moveSeconds) +
            (value[landed * laneCount + to] ?? 0);
          if (cost < best) {
            best = cost;
            bestChoice = direction;
          }
        }
      }
      value[i * laneCount + lane] = best;
      choice[i * laneCount + lane] = bestChoice;
    }
  }

  const moves: PlannedMove[] = [];
  let lane = start.lane;
  for (let i = 0; i < count - 1;) {
    const picked = choice[i * laneCount + lane] ?? STAY;
    const pull = pullAt(times[i] ?? 0);
    if (picked === PULLED && pull !== undefined) {
      const to = pulledTo(pull, lane);
      i = indexAtOrAfter(times, unlocksAt(moveSeconds, pull, to !== lane));
      lane = to;
    } else if (picked === STAY) {
      i += 1;
    } else {
      const direction: LaneDirection = picked === 1 ? 1 : -1;
      moves.push({ at: times[i] ?? 0, direction });
      lane += direction;
      i = arrival[i] ?? count;
    }
  }
  return moves;
}
