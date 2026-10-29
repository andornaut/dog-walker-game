import type { Effect, GameData, Modifier, Walker, WalkerId, ZoneId } from "../data/types";
import { keysOf } from "../lib/records";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { dogAgility } from "./dogs";
import { modifiedStat } from "./modifiers";
import { packModifiers } from "./run";
import { read } from "./units";

type WalkerData = Pick<GameData, "walkerPerks" | "walkers">;

// Every run the walker walks applies its perk's effects.
export function walkerEffects(data: WalkerData, walker: WalkerId): readonly Effect[] {
  return data.walkerPerks[data.walkers[walker].perk].effects;
}

// What the pack's walking dogs add to the walker's agility, each its dogAgility.
function dogsAgility(data: Pick<GameData, "dogs" | "tuning">, run: Pick<RunState, "pack">): number {
  return packDogs(run).reduce((sum, dog) => sum + dogAgility(data.tuning, data.dogs[dog]), 0);
}

// The agility the pack changes lanes at: the walker's, with its modifiers, and its dogs', which
// never take it below minPackAgility, or the walker's own when lower; then scaled by the
// multiply agility modifiers of the run and its debuffs, such as Muddy's, so a Muddy pack changes
// lanes at muddyLaneSlow of its own speed.
export function packAgility(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
): number {
  const agility = walkerAgility(data, run.modifiers, run.walker);
  const floor = Math.min(agility, read(data.tuning, "multipliers", "minPackAgility"));
  const walking = Math.max(floor, agility + dogsAgility(data, run));
  const scaling = packModifiers(data, run).filter(({ operation }) => operation === "multiply");
  return modifiedStat(data.tuning, scaling, "agility", walking);
}

// The walker's agility after add agility modifiers, such as Running shoes'.
export function walkerAgility(
  data: Pick<GameData, "tuning" | "walkers">,
  modifiers: readonly Modifier[],
  walker: WalkerId,
): number {
  const adding = modifiers.filter(({ operation }) => operation === "add");
  return modifiedStat(data.tuning, adding, "agility", data.walkers[walker].agility);
}

// The lowest agility any pack can change lanes at, which sets the row spacing: minPackAgility,
// which large dogs never take a pack below, or the slowest walker's own when lower.
export function slowestPackAgility(data: Pick<GameData, "tuning" | "walkers">): number {
  const slowest = Math.min(...Object.values(data.walkers).map(({ agility }) => agility));
  return Math.min(slowest, read(data.tuning, "multipliers", "minPackAgility"));
}

// The lowest agility any pack can change lanes at with every debuff on it, which spaces the held
// path's lane changes: slowestPackAgility, scaled by each debuff's multiply agility modifiers
// that slow it, such as Muddy's.
export function slowestDebuffedAgility(
  data: Pick<GameData, "debuffs" | "tuning" | "walkers">,
): number {
  const slowing = Object.values(data.debuffs)
    .flatMap(({ modifiers }): readonly Modifier[] => modifiers)
    .filter(({ operation, stat }) => operation === "multiply" && stat === "agility");
  return Math.min(
    slowestPackAgility(data),
    modifiedStat(data.tuning, slowing, "agility", slowestPackAgility(data)),
  );
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
  return keysOf(data.walkers).filter((id) => {
    const goal = walkerGoal(data.walkers[id]);
    return !owned.includes(id) && (goal === null || finished.includes(goal));
  });
}
