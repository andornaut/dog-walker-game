import type { Effect, GameData, HomeText, Modifier, Walker, WalkerId, ZoneId } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { isHeavy } from "./dogs";
import { modifiedStat } from "./modifiers";
import { read } from "./units";

export type WalkerData = Pick<GameData, "walkerPerks" | "walkers">;

// Every run the walker walks applies its perk's effects.
export function walkerEffects(data: WalkerData, walker: WalkerId): readonly Effect[] {
  return data.walkerPerks[data.walkers[walker].perk].effects;
}

// What the pack's heavy dogs take off the walker's agility: bigDogAgility for each walking one.
export function bigDogsAgility(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "pack">,
): number {
  const big = packDogs(run).filter((dog) => isHeavy(data.dogs[dog])).length;
  return big * read(data.tuning, "multipliers", "bigDogAgility");
}

// The agility the pack changes lanes at: the walker's, with its modifiers, and its big dogs',
// which never take it below the slowest walker's, or the walker's own when lower.
export function packAgility(
  data: Pick<GameData, "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "modifiers" | "pack" | "walker">,
): number {
  const agility = walkerAgility(data, run.modifiers, run.walker);
  const floor = Math.min(agility, slowestAgility(data));
  return Math.max(floor, agility + bigDogsAgility(data, run));
}

// The walker's agility after agility modifiers, such as Running shoes'.
export function walkerAgility(
  data: Pick<GameData, "tuning" | "walkers">,
  modifiers: readonly Modifier[],
  walker: WalkerId,
): number {
  return modifiedStat(data.tuning, modifiers, "agility", data.walkers[walker].agility);
}

// The lowest agility of any walker before modifiers, which sets the row spacing.
export function slowestAgility(data: Pick<GameData, "walkers">): number {
  return Math.min(...Object.values(data.walkers).map(({ agility }) => agility));
}

// An agility in words: the word of the highest band it reaches, or the lowest band's below it.
export function agilityWord(text: Pick<HomeText, "agilityWords">, agility: number): string {
  const [first, ...rest] = text.agilityWords;
  // A rounding error less, so 1.1 reaches a band from 1.1 whatever sums made it.
  return rest.reduce((word, band) => (agility + 1e-9 >= band.from ? band.word : word), first.word);
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
