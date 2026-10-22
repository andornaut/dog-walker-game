import type { DogId, WalkerId, ZoneId } from "../data/types";
import { type RunCounters, type RunFacts, walkedFromTheStart } from "../rules/achievements";
import { addCents, type Cents } from "../rules/units";
import { newWalkers } from "../rules/walkers";
import type { EndReason } from "../state/runState";
import { awardAchievements, type AwardContext } from "./achievements";
import type { Checkpoint, DogRun, DogStats, LastWalk, SaveDocument, SaveStats } from "./schema";
import { ZERO_DOG_STATS } from "./stats";

// A finished run. earnedCents is what the run banks. zone is the zone in
// progress when the run ended, counting from 1; between zones it is the next one. A
// finished run ends in its last zone.
export interface RunResult {
  counters: RunCounters;
  dogs: DogRun[];
  earnedCents: Cents;
  outcome: EndReason;
  // The zones the run walked, in order, the one it ended in included.
  route: ZoneId[];
  walker: WalkerId;
  zone: number;
}

// Only finished zones count: heading home or running out of dogs in zone 3 finishes 2.
export function zonesFinishedBy(result: Pick<RunResult, "outcome" | "zone">): number {
  return result.outcome === "finished" ? result.zone : result.zone - 1;
}

// Lifetime counts with a run's added, key by key: the tallies, or the bumps by kind.
function addCounts<Key extends string>(
  lifetime: Readonly<Partial<Record<Key, number>>>,
  run: Readonly<Partial<Record<Key, number>>>,
): Partial<Record<Key, number>> {
  const sum: Partial<Record<Key, number>> = { ...lifetime };
  for (const [key, count] of Object.entries(run) as [Key, number][]) {
    sum[key] = (sum[key] ?? 0) + count;
  }
  return sum;
}

// Whether a walk of packSize dogs banking earnedCents beats every walk yet with that many
// dogs; the end screen flags it.
export function isNewBestWalk(
  stats: Pick<SaveStats, "bestCentsByPackSize">,
  packSize: number,
  earnedCents: Cents,
): boolean {
  const best = stats.bestCentsByPackSize[packSize];
  return best === undefined || earnedCents > best;
}

// Whether a run banking earnedCents beats the best walk the logbook shows, whatever its dogs.
function beatsBestWalk(stats: Pick<SaveStats, "bestWalk">, earnedCents: Cents): boolean {
  return stats.bestWalk === null || earnedCents > stats.bestWalk.earnedCents;
}

// walker is null for a checkpoint, which banks as heading home and so finishes no walk.
type BankedRun = Pick<
  Checkpoint,
  "counters" | "dogs" | "earnedCents" | "route" | "zonesFinished"
> & {
  outcome: EndReason;
  walker: WalkerId | null;
};

// Banks the earnings, counts the outcome and updates every stat and the logbook. Unlocks the
// walkers whose goal zone the run finished, leaving out zones a dev start skipped. Clears the checkpoint, since the run
// it belonged to is now banked. Then awards what the run earned.
function bankRun(context: AwardContext, run: BankedRun, save: SaveDocument): SaveDocument {
  const { stats } = save;
  const dogs: Partial<Record<DogId, DogStats>> = { ...stats.dogs };
  for (const { fired, id, zonesFinished } of run.dogs) {
    const current = dogs[id] ?? ZERO_DOG_STATS;
    dogs[id] = {
      timesFired: current.timesFired + (fired ? 1 : 0),
      walks: current.walks + 1,
      zonesFinished: current.zonesFinished + zonesFinished,
    };
  }

  const { earnedCents, outcome, zonesFinished } = run;
  const walkDogs = run.dogs.map(({ id }) => id);
  // A dog fired in a zone was paid for the zones before it.
  const firedBy = run.dogs.flatMap(({ fired, id, zonesFinished: paid }) =>
    fired ? [{ dog: id, zone: paid + 1 }] : [],
  );
  const lastWalk: LastWalk = {
    dogs: walkDogs,
    earnedCents,
    firings: firedBy,
    outcome,
    route: run.route,
    zonesFinished,
  };
  // A walk counts as finished for the totals only when a dev start skipped no zone.
  const finished = outcome === "finished" && walkedFromTheStart(run.counters);
  const stayed = run.dogs.flatMap(({ fired, id }) => (fired ? [] : [id]));
  const bestZoneFinished = Math.max(stats.bestZoneFinished, zonesFinished);
  const { owned } = save;
  const banked: SaveDocument = {
    ...save,
    bankCents: addCents(save.bankCents, earnedCents),
    checkpoint: null,
    owned: {
      ...owned,
      walkers: [
        ...owned.walkers,
        ...newWalkers(
          context.data,
          owned.walkers,
          run.route.slice(run.counters.firstZone, zonesFinished),
        ),
      ],
    },
    stats: {
      ...stats,
      bestCentsByPackSize: isNewBestWalk(stats, walkDogs.length, earnedCents)
        ? { ...stats.bestCentsByPackSize, [walkDogs.length]: earnedCents }
        : stats.bestCentsByPackSize,
      bestWalk: beatsBestWalk(stats, earnedCents)
        ? { dogs: walkDogs, earnedCents, zonesFinished }
        : stats.bestWalk,
      bestZoneFinished,
      bumpsByKind: addCounts(stats.bumpsByKind, run.counters.bumpsByKind),
      dogs,
      dogsFinishedWith: finished
        ? [...new Set([...stats.dogsFinishedWith, ...stayed])]
        : stats.dogsFinishedWith,
      lastWalk,
      lifetimeCents: addCents(stats.lifetimeCents, earnedCents),
      runs: { ...stats.runs, [outcome]: stats.runs[outcome] + 1 },
      tallies: addCounts(stats.tallies, run.counters.tallies),
      timesFired: stats.timesFired + firedBy.length,
      walkersFinishedWith:
        finished && run.walker !== null
          ? [...new Set([...stats.walkersFinishedWith, run.walker])]
          : stats.walkersFinishedWith,
      walksWithoutFiring: stats.walksWithoutFiring + (finished && firedBy.length === 0 ? 1 : 0),
      zonesEverFinished: walkedFromTheStart(run.counters)
        ? [...new Set([...stats.zonesEverFinished, ...run.route.slice(0, zonesFinished)])]
        : stats.zonesEverFinished,
    },
  };
  const facts: RunFacts = {
    ...run.counters,
    dogsHome: stayed.length,
    earnedCents,
    packSize: run.dogs.length,
    zonesFinished,
  };
  return awardAchievements(context, facts, save, banked);
}

export function recordCheckpoint(save: SaveDocument, slice: Checkpoint): SaveDocument {
  return { ...save, checkpoint: slice };
}

// Banks an unfinished run as if the player had headed home after the checkpoint's zone.
export function bankCheckpoint(context: AwardContext, save: SaveDocument): SaveDocument {
  const { checkpoint } = save;
  if (checkpoint === null) {
    return save;
  }
  return bankRun(context, { ...checkpoint, outcome: "wentHome", walker: null }, save);
}

// Banks a run that ended.
export function recordRunEnd(
  context: AwardContext,
  save: SaveDocument,
  result: RunResult,
): SaveDocument {
  return bankRun(
    context,
    {
      counters: result.counters,
      dogs: result.dogs,
      earnedCents: result.earnedCents,
      outcome: result.outcome,
      route: result.route,
      walker: result.walker,
      zonesFinished: zonesFinishedBy(result),
    },
    save,
  );
}
