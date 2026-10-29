import type { DogId, EncounterId, OptionPicks, WalkerId, ZoneId } from "../data/types";
import { type RunCounters, type RunFacts, walkedFromTheStart } from "../rules/achievements";
import { newWalkers } from "../rules/walkers";
import type { EndReason } from "../state/runState";
import { addCents, type Cents, cents } from "../units";
import { awardAchievements, type AwardContext } from "./achievements";
import type { Checkpoint, DogRun, DogStats, LastWalk, SaveDocument, SaveStats } from "./schema";
import { bestWalkCents, ZERO_DOG_STATS } from "./stats";

// A finished run. earnedCents is what the run banks, and lostCents the cash it carried and lost
// by ending early (walkEarnings). lastHeartOwners is how many walking owners ended it
// on their last heart. zone is the zone in progress when the run ended, counting from 1; between
// zones it is the next one. A finished run ends in its last zone.
export interface RunResult {
  counters: RunCounters;
  dogs: DogRun[];
  earnedCents: Cents;
  lastHeartOwners: number;
  lostCents: Cents;
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

// The dogs still walking at the end of a finished walk: those whose owner never fired you, which
// are the dogs the last zone paid and the Walk bonus counts (packDogs), since an owner at 0 hearts
// fires you at once. null for a walk not finished: headed home, every owner having fired you, or
// begun past zone 1 by a dev start.
export function dogsFinishedWith(
  run: Pick<RunResult, "counters" | "dogs" | "outcome">,
): number | null {
  if (run.outcome !== "finished" || !walkedFromTheStart(run.counters)) {
    return null;
  }
  return run.dogs.filter(({ firedInZone }) => firedInZone === null).length;
}

// Lifetime counts with a run's added, key by key: the tallies, the bumps by kind, or an
// encounter's option picks.
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

// Lifetime option picks with a run's added, option by option.
function addPicks(lifetime: OptionPicks, run: OptionPicks): OptionPicks {
  const sum: OptionPicks = { ...lifetime };
  for (const [encounter, picks] of Object.entries(run) as [EncounterId, Record<string, number>][]) {
    // Every option addCounts returns has a count.
    sum[encounter] = addCounts(sum[encounter] ?? {}, picks) as Record<string, number>;
  }
  return sum;
}

// The streak of finished walks with no firing after a walk: a firing ends it, a walk finished
// from the first zone adds one, and any other walk, headed home early, leaves it as it was.
function nextNoFiringStreak(streak: number, finished: boolean, firings: number): number {
  if (firings > 0) {
    return 0;
  }
  return finished ? streak + 1 : streak;
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
function beatsBestWalk(
  stats: Pick<SaveStats, "bestCentsByPackSize" | "bestWalk">,
  earnedCents: Cents,
): boolean {
  return stats.bestWalk === null || earnedCents > bestWalkCents(stats);
}

// walker is null for a checkpoint, which banks as heading home and so finishes no walk.
type BankedRun = Pick<
  Checkpoint,
  "counters" | "dogs" | "earnedCents" | "route" | "zonesFinished"
> & {
  lastHeartOwners: number;
  outcome: EndReason;
  walker: WalkerId | null;
};

// Banks the earnings, counts the outcome and updates every stat and the logbook. A run a dev start
// began past zone 1 banks no money, adds no starting cash and sets no best walk, and its zone
// counts leave out the zones it skipped. Unlocks the walkers that a finished walk's dogs still
// walking at its end reach (dogsFinishedWith). Clears the checkpoint, since the run it belonged to is now banked. Then
// awards what the run earned.
function bankRun(context: AwardContext, run: BankedRun, save: SaveDocument): SaveDocument {
  const { stats } = save;
  const walked = walkedFromTheStart(run.counters);
  const walkedOf = (zones: number) => Math.max(0, zones - run.counters.firstZone);
  const { earnedCents, outcome, zonesFinished } = run;
  const dogs: Partial<Record<DogId, DogStats>> = { ...stats.dogs };
  for (const { firedInZone, id } of run.dogs) {
    const current = dogs[id] ?? ZERO_DOG_STATS;
    // A dog fired in a zone was paid for the zones before it.
    const paid = firedInZone === null ? zonesFinished : firedInZone - 1;
    dogs[id] = {
      timesFired: current.timesFired + (firedInZone === null ? 0 : 1),
      walks: current.walks + 1,
      zonesFinished: current.zonesFinished + walkedOf(paid),
    };
  }

  const walkDogs = run.dogs.map(({ id }) => id);
  const firedBy = run.dogs.flatMap(({ firedInZone, id }) => (firedInZone === null ? [] : [id]));
  const lastWalk: LastWalk = {
    dogs: walkDogs,
    earnedCents,
    firings: firedBy,
    outcome,
    route: run.route,
    zonesFinished,
  };
  // A walk counts as finished for the totals only when a dev start skipped no zone, and as
  // headed home otherwise.
  const finished = outcome === "finished" && walked;
  const counted: EndReason = outcome === "finished" && !walked ? "wentHome" : outcome;
  const stayed = run.dogs.flatMap(({ firedInZone, id }) => (firedInZone === null ? [id] : []));
  const banks = walked ? earnedCents : cents(0);
  const { owned } = save;
  const banked: SaveDocument = {
    ...save,
    bankCents: addCents(save.bankCents, banks),
    checkpoint: null,
    owned: {
      ...owned,
      walkers: [
        ...owned.walkers,
        ...newWalkers(context.data, owned.walkers, dogsFinishedWith(run)),
      ],
    },
    stats: {
      ...stats,
      bestCentsByPackSize:
        walked && isNewBestWalk(stats, walkDogs.length, earnedCents)
          ? { ...stats.bestCentsByPackSize, [walkDogs.length]: earnedCents }
          : stats.bestCentsByPackSize,
      bestWalk:
        walked && beatsBestWalk(stats, earnedCents)
          ? { dogs: walkDogs, zonesFinished }
          : stats.bestWalk,
      bestZoneFinished: Math.max(stats.bestZoneFinished, walkedOf(zonesFinished)),
      bumpsByKind: addCounts(stats.bumpsByKind, run.counters.bumpsByKind),
      dogs,
      dogsFinishedWith: finished
        ? [...new Set([...stats.dogsFinishedWith, ...stayed])]
        : stats.dogsFinishedWith,
      lastWalk,
      lifetimeCents: addCents(stats.lifetimeCents, banks),
      lifetimeStartCents: walked
        ? addCents(stats.lifetimeStartCents, run.counters.startCents)
        : stats.lifetimeStartCents,
      noFiringStreak: nextNoFiringStreak(stats.noFiringStreak, finished, firedBy.length),
      optionPicks: addPicks(stats.optionPicks, run.counters.optionPicks),
      runs: { ...stats.runs, [counted]: stats.runs[counted] + 1 },
      tallies: addCounts(stats.tallies, run.counters.tallies),
      walkersFinishedWith:
        finished && run.walker !== null
          ? [...new Set([...stats.walkersFinishedWith, run.walker])]
          : stats.walkersFinishedWith,
      zonesEverFinished: walked
        ? [...new Set([...stats.zonesEverFinished, ...run.route.slice(0, zonesFinished)])]
        : stats.zonesEverFinished,
    },
  };
  const facts: RunFacts = {
    ...run.counters,
    dogsHome: stayed.length,
    earnedCents,
    lastHeartOwners: run.lastHeartOwners,
    packSize: run.dogs.length,
    zonesFinished,
  };
  return awardAchievements(context, facts, save, banked);
}

export function recordCheckpoint(save: SaveDocument, slice: Checkpoint): SaveDocument {
  return { ...save, checkpoint: slice };
}

// Banks an unfinished run as if the player had headed home after the checkpoint's zone. Only a
// finished walk counts the owners on their last heart, and a checkpoint never is one: the walk's
// last zone ends the run, which then saves no checkpoint.
export function bankCheckpoint(context: AwardContext, save: SaveDocument): SaveDocument {
  const { checkpoint } = save;
  if (checkpoint === null) {
    return save;
  }
  return bankRun(
    context,
    { ...checkpoint, lastHeartOwners: 0, outcome: "wentHome", walker: null },
    save,
  );
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
      lastHeartOwners: result.lastHeartOwners,
      outcome: result.outcome,
      route: result.route,
      walker: result.walker,
      zonesFinished: zonesFinishedBy(result),
    },
    save,
  );
}
