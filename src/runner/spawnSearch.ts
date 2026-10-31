import { randomStream } from "@andornaut/game-kit/random";

import type { DrawnMover, PlannerStreams } from "./moverPlanning";
import { type AdmissionReport, SpawnCapacityError } from "./spawnAdmission";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export interface SpawnSearchContext {
  readonly seed: number;
  readonly zoneIndex: number;
}

export interface SpawnConstruction {
  readonly admitted: readonly boolean[][];
  // Original quota index, then member index: reorderings never change request identity.
  readonly drawn: readonly DrawnMover[][];
  readonly exact: boolean;
  readonly order: "constrained-first" | "original";
}

type Strategy = "alternate-path" | "constrained-first" | "original";

export interface MissingSpawn<Kind extends string> {
  readonly count: number;
  readonly kind: Kind;
  readonly movement: AdmissionReport<Kind>["counts"][number]["movement"];
  readonly requests: readonly { readonly memberIndex: number; readonly quotaIndex: number }[];
  // Observations for this kind's candidates, not a proof of why no arrangement exists.
  readonly observedRejections: AdmissionReport<Kind>["rejections"];
}

interface SearchAttempt<Kind extends string> {
  readonly admission: AdmissionReport<Kind>;
  readonly missing: readonly MissingSpawn<Kind>[];
  readonly strategy: Strategy;
}

export type ConstructiveSpawnResult<Kind extends string> =
  | {
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly planned: PlannedSpawns<Kind>;
      readonly status: "complete";
      readonly strategy: Strategy;
    }
  | {
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly reason: string;
      readonly status: "capacity-impossible";
    }
  | {
      readonly admission: AdmissionReport<Kind>;
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly missing: readonly MissingSpawn<Kind>[];
      readonly reason: string;
      readonly status: "planner-unable";
    };

function missingFrom<Kind extends string>(
  construction: SpawnConstruction,
  plan: SpawnPlan<Kind>,
  admission: AdmissionReport<Kind>,
): MissingSpawn<Kind>[] {
  const missing: {
    count: number;
    kind: Kind;
    movement: MissingSpawn<Kind>["movement"];
    observedRejections: MissingSpawn<Kind>["observedRejections"];
    requests: { memberIndex: number; quotaIndex: number }[];
  }[] = [];
  plan.quotas.forEach((quota, quotaIndex) => {
    const movement = quota.mover?.movement ?? null;
    for (let memberIndex = 0; memberIndex < quota.count; memberIndex++) {
      if (
        construction.admitted[quotaIndex]?.[memberIndex] === true ||
        construction.drawn[quotaIndex]?.[memberIndex]?.herring === true
      ) {
        continue;
      }
      let group = missing.find((group) => group.kind === quota.kind && group.movement === movement);
      if (group === undefined) {
        group = {
          count: 0,
          kind: quota.kind,
          movement,
          observedRejections: admission.rejections.filter(
            (rejection) => rejection.kind === quota.kind,
          ),
          requests: [],
        };
        missing.push(group);
      }
      group.count += 1;
      group.requests.push({ memberIndex, quotaIndex });
    }
  });
  return missing;
}

// A finite construction portfolio, not a seed sweep or an empirical capacity threshold. The
// baseline keeps normal draws and choices; repairs reuse its requested movers and draw only
// layout choices from isolated streams. A complete baseline returns without a repair.
export function searchSpawnAdmission<Kind extends string>(
  attempt: (construction: SpawnConstruction, streams: PlannerStreams) => PlannedSpawns<Kind>,
  context: SpawnSearchContext,
  streams: PlannerStreams,
  plan: SpawnPlan<Kind>,
): ConstructiveSpawnResult<Kind> {
  const drawn = plan.quotas.map((): DrawnMover[] => []);
  const attempts: SearchAttempt<Kind>[] = [];
  let best: SearchAttempt<Kind> | undefined;
  const missingTotal = (items: readonly MissingSpawn<Kind>[]) =>
    items.reduce((sum, item) => sum + item.count, 0);
  try {
    for (const strategy of ["original", "alternate-path", "constrained-first"] as const) {
      const repair = strategy !== "original";
      if (repair) {
        plan.quotas.forEach((quota, index) => {
          if (quota.mover !== undefined && drawn[index]?.length !== quota.count) {
            throw new Error(`Missing frozen mover requests for quota ${index}`);
          }
        });
      }
      const layout = repair
        ? {
            movers: randomStream(context.seed, `repair-movers-${context.zoneIndex}-${strategy}`),
            spawns: randomStream(context.seed, `repair-spawns-${context.zoneIndex}-${strategy}`),
          }
        : streams;
      const construction: SpawnConstruction = {
        admitted: plan.quotas.map(() => []),
        drawn,
        exact: repair,
        order: strategy === "constrained-first" ? strategy : "original",
      };
      const planned = attempt(construction, layout);
      const missing = missingFrom(construction, plan, planned.admission);
      const report = { admission: planned.admission, missing, strategy };
      attempts.push(report);
      if (missing.length === 0 && planned.admission.substitutions.length === 0) {
        return { attempts, planned, status: "complete", strategy };
      }
      if (best === undefined || missingTotal(missing) < missingTotal(best.missing)) {
        best = report;
      }
    }
  } catch (error) {
    if (!(error instanceof SpawnCapacityError)) {
      throw error;
    }
    return { attempts, reason: error.message, status: "capacity-impossible" };
  }
  if (best === undefined) {
    throw new Error("No spawn construction attempted");
  }
  const descriptions = best.missing.map(
    ({ count, kind, movement }) => `${count} ${kind} (${movement ?? "standing"})`,
  );
  return {
    admission: best.admission,
    attempts,
    missing: best.missing,
    reason: `Planner unable after ${attempts.length} constructions: ${descriptions.join(", ")}`,
    status: "planner-unable",
  };
}
