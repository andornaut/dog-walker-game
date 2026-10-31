import type { MovementKind } from "../data/types";
import type { MoverSpec } from "./moverPlanning";
import type { SpawnPlan } from "./spawning";
import { rowsWithin } from "./stretches";

// A failed candidate check, not proof that no arrangement can admit the quota.
export type SpawnRejection =
  | "body"
  | "cells"
  | "geometry"
  | "open-lanes"
  | "outside-road"
  | "outside-rows"
  | "outside-zone"
  | "pack-gap"
  | "path-stop"
  | "reservation"
  | "rider-gap"
  | "screen-cap"
  | "wide-gap";

interface CapacityLimit {
  readonly available: number;
  readonly required: number;
  readonly resource: string;
}

// Necessary bounds only: passing them does not prove that a legal arrangement exists.
export interface SpawnCapacity {
  readonly limits: readonly CapacityLimit[];
  readonly rows: number;
}

export interface AdmissionReport<Kind extends string> {
  readonly capacity: SpawnCapacity;
  // Counts are logical groups: a delayed trail is one mover, regardless of its components.
  readonly counts: readonly {
    readonly admitted: number;
    readonly herrings: number;
    readonly kind: Kind;
    readonly movement: MovementKind | null;
    readonly requested: number;
  }[];
  // These count failed candidate checks, including candidates of movers eventually admitted.
  readonly rejections: readonly {
    readonly candidates: number;
    readonly kind: Kind;
    readonly reason: SpawnRejection;
  }[];
  readonly substitutions: readonly { readonly from: Kind; readonly to: Kind }[];
}

// Every admissible placement keeps its cue on screen for its warning. Riders then traverse the
// road, at no more than their greatest varied speed. Other standing movers traverse at road
// speed, with their spread only lengthening the interval. These deliberately ignore extra cues,
// moves and tails, so they remain lower bounds for every retry variant.
function minimumOnScreen(plan: SpawnPlan<string>, spec: MoverSpec): number {
  const height = spec.footprint.rows * plan.cellLength;
  switch (spec.motion.kind) {
    case "signature":
      return spec.motion.profile.warningSeconds * plan.scrollSpeed;
    case "cross":
      return spec.warningSeconds * plan.scrollSpeed;
    case "ride":
      return (
        spec.warningSeconds * plan.scrollSpeed +
        (plan.roadLength + height) / (spec.motion.speedMultiplier * (1 + spec.variation.speedShare))
      );
    default:
      return plan.roadLength + height;
  }
}

// Rejects only necessary-bound violations before the planner allocates per-spawn work. Movers
// may share cells, so blocked-lane unions are never added up as though they were distinct cells.
export function validateSpawnCapacity(plan: SpawnPlan<string>, rows: number): SpawnCapacity {
  for (const { count, kind } of plan.quotas) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`Spawn quota ${kind} count must be a nonnegative safe integer`);
    }
  }
  const standing = plan.quotas.filter((quota) => quota.mover === undefined);
  const limits: CapacityLimit[] = [
    {
      available: rows * plan.laneCount,
      required: standing.reduce((sum, quota) => sum + quota.count, 0),
      resource: "standing cells",
    },
    {
      available: rows * (plan.laneCount - plan.minOpenLanes),
      required: standing
        .filter((quota) => quota.blocksLane)
        .reduce((sum, quota) => sum + quota.count, 0),
      resource: "standing blocking cells",
    },
  ];
  for (const quota of standing) {
    if (quota.within !== undefined) {
      const [first, end] = rowsWithin(rows, quota.within);
      limits.push({
        available:
          (end - first) * (quota.blocksLane ? plan.laneCount - plan.minOpenLanes : plan.laneCount),
        required: quota.count,
        resource: `${quota.kind} standing cells in rows ${first}..${end}`,
      });
    }
  }
  const movers = plan.quotas.flatMap((quota) => {
    const spec = quota.mover;
    // A first ordinary mover may stand instead, and a herring takes no screen capacity.
    if (
      spec === undefined ||
      !quota.blocksLane ||
      (quota.first === true && spec.motion.kind !== "signature") ||
      (spec.motion.kind === "cross" && (spec.motion.herring?.share ?? 0) > 0)
    ) {
      return [];
    }
    return [{ count: quota.count, minimum: minimumOnScreen(plan, spec), spec }];
  });
  const blocking = plan.quotas.filter(
    (quota) =>
      quota.blocksLane &&
      !(quota.mover?.motion.kind === "cross" && (quota.mover.motion.herring?.share ?? 0) > 0),
  );
  const minimum = blocking.reduce(
    (smallest, quota) =>
      quota.mover === undefined ? smallest : Math.min(smallest, minimumOnScreen(plan, quota.mover)),
    Infinity,
  );
  // A blocking group is either standing in distinct cells or moving under the shared screen
  // cap. This also bounds first movers that may stand when no moving placement fits.
  const movingMaximum =
    minimum === Infinity ? 0 : Math.floor((plan.moverCaps.total * plan.zoneLength) / minimum);
  limits.push({
    available: rows * (plan.laneCount - plan.minOpenLanes) + movingMaximum,
    required: blocking.reduce((sum, quota) => sum + quota.count, 0),
    resource: "blocking logical groups",
  });
  const groups = [
    { cap: plan.moverCaps.total, items: movers, resource: "mover screen distance" },
    {
      cap: plan.moverCaps.darts,
      items: movers.filter(
        ({ spec }) =>
          spec.motion.kind === "cross" ||
          (spec.motion.kind === "signature" &&
            ["dart", "dive", "stopAndGoAcross"].includes(spec.movement)),
      ),
      resource: "dart screen distance",
    },
    {
      cap: plan.moverCaps.slowVehicles,
      items: movers.filter(
        ({ spec }) =>
          spec.motion.kind === "ride" &&
          spec.motion.speedMultiplier * (1 + spec.variation.speedShare) < 1,
      ),
      resource: "slow-vehicle screen distance",
    },
  ];
  for (const { cap, items, resource } of groups) {
    limits.push({
      available: cap * plan.zoneLength,
      required: items.reduce((sum, item) => sum + item.count * item.minimum, 0),
      resource,
    });
  }
  const failed = limits.filter(({ available, required }) => required > available + 1e-9);
  if (failed.length > 0) {
    const reasons = failed.map(
      ({ available, required, resource }) =>
        `${resource} requires ${required}, maximum ${available}`,
    );
    throw new RangeError(`Impossible spawn quota: ${reasons.join("; ")}`);
  }
  return { limits, rows };
}
