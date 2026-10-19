import type { Effect, GameData, Walker, WalkerId } from "../data/types";

export type WalkerData = Pick<GameData, "walkerPaces" | "walkerStyles" | "walkers">;

// Every run the walker walks applies these: its pace's effects, then its style's.
export function walkerEffects(data: WalkerData, walker: WalkerId): Effect[] {
  const { pace, style } = data.walkers[walker];
  return [...data.walkerPaces[pace].effects, ...data.walkerStyles[style].effects];
}

// How many zones one walk must finish to unlock the walker: 0 for a starting walker.
export function walkerGoal(walker: Walker): number {
  return walker.unlock === "start" ? 0 : walker.zone;
}

// The walkers a walk that finished zonesFinished zones unlocks and owned lacks, in data
// order. At a zone's end, with the zones the run has finished so far, it names the walker who
// greets the pack; when a run is banked, with the best zones finished, the walkers it adds.
export function newWalkers(
  data: Pick<GameData, "walkers">,
  owned: readonly WalkerId[],
  zonesFinished: number,
): WalkerId[] {
  return (Object.keys(data.walkers) as WalkerId[]).filter(
    (id) => !owned.includes(id) && walkerGoal(data.walkers[id]) <= zonesFinished,
  );
}
