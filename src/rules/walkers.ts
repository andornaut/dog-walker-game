import type { Effect, GameData, Modifier, Walker, WalkerId, ZoneId } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { isLarge } from "./dogs";
import { modifiedStat } from "./modifiers";
import { read } from "./units";

type WalkerData = Pick<GameData, "walkerPerks" | "walkers">;

// Every run the walker walks applies its perk's effects.
export function walkerEffects(data: WalkerData, walker: WalkerId): readonly Effect[] {
  return data.walkerPerks[data.walkers[walker].perk].effects;
}

// What the pack's large dogs take off the walker's agility: largeDogAgility for each walking one.
function largeDogsAgility(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "pack">,
): number {
  const large = packDogs(run).filter((dog) => isLarge(data.dogs[dog])).length;
  return large * read(data.tuning, "multipliers", "largeDogAgility");
}

// The agility the pack changes lanes at: the walker's, with its modifiers, and its large dogs',
// which never take it below minPackAgility, or the walker's own when lower.
export function packAgility(
  data: Pick<GameData, "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "modifiers" | "pack" | "walker">,
): number {
  const agility = walkerAgility(data, run.modifiers, run.walker);
  const floor = Math.min(agility, read(data.tuning, "multipliers", "minPackAgility"));
  return Math.max(floor, agility + largeDogsAgility(data, run));
}

// The walker's agility after agility modifiers, such as Running shoes'.
export function walkerAgility(
  data: Pick<GameData, "tuning" | "walkers">,
  modifiers: readonly Modifier[],
  walker: WalkerId,
): number {
  return modifiedStat(data.tuning, modifiers, "agility", data.walkers[walker].agility);
}

// The lowest agility any pack can change lanes at, which sets the row spacing: minPackAgility,
// which large dogs never take a pack below, or the slowest walker's own when lower.
export function slowestPackAgility(data: Pick<GameData, "tuning" | "walkers">): number {
  const slowest = Math.min(...Object.values(data.walkers).map(({ agility }) => agility));
  return Math.min(slowest, read(data.tuning, "multipliers", "minPackAgility"));
}

// The zone whose finish unlocks the walker, or null for a starting walker.
export function walkerGoal(walker: Walker): ZoneId | null {
  return walker.unlock === "start" ? null : walker.zone;
}

// The walkers a walk that finished the zones in finished unlocks and owned lacks, in data
// order. At a zone's end, with the zones the run has finished so far, it names the walker who
// greets the pack; when a run is banked, the walkers it adds.
export function newWalkers(
  data: Pick<GameData, "walkers">,
  owned: readonly WalkerId[],
  finished: readonly ZoneId[],
): WalkerId[] {
  return (Object.keys(data.walkers) as WalkerId[]).filter((id) => {
    const goal = walkerGoal(data.walkers[id]);
    return !owned.includes(id) && (goal === null || finished.includes(goal));
  });
}
