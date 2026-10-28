import type { GameData } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { baseMaxHearts, placeInPack } from "./dogs";
import { type ModifiedValue, statModified } from "./modified";
import { read } from "./units";

type StandingData = Pick<GameData, "dogs" | "tuning" | "walkers">;

export type StandingRun = Pick<RunState, "modifiers" | "pack" | "walker">;

// How many lanes beside the pack's a tip or a treat is grabbed from, as the walk rounds it,
// when tipReach or treatReach modifiers, such as Long reach's, change it.
export function reachModified(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "modifiers">,
  pickup: "tip" | "treat",
): ModifiedValue | null {
  const stat = pickup === "treat" ? "treatReach" : "tipReach";
  return statModified(data.tuning, run.modifiers, stat, { kind: "reach", pickup }, 0, Math.round);
}

// Each walking owner's max hearts, when maxHearts modifiers, such as Lucky collar's, change it:
// before is the max with no modifiers, and each share is held to hearts.maxOwnerHearts.
function maxHeartsModified(data: StandingData, run: StandingRun): ModifiedValue[] {
  const cap = read(data.tuning, "hearts", "maxOwnerHearts");
  return packDogs(run).flatMap((dog) => {
    const base = baseMaxHearts(data.tuning, placeInPack(run, dog), data.dogs[dog]);
    const modified = statModified(
      data.tuning,
      run.modifiers,
      "maxHearts",
      { dog, kind: "maxHearts" },
      base,
      (value) => Math.min(cap, value),
    );
    return modified === null ? [] : [modified];
  });
}

// Every value modifiers change for as long as they last, rather than at a moment of the walk:
// each owner's max hearts, the walker's agility, how far tips and treats are grabbed from and
// how many pulls a squirrel draws. Each is left out unless a modifier changes it. A moment a
// modifier changes, such as a bump, a tip or a card's cost, is reported where it happens
// instead.
export function standingModified(data: StandingData, run: StandingRun): ModifiedValue[] {
  const agility = data.walkers[run.walker].agility;
  const values = [
    ...maxHeartsModified(data, run),
    statModified(data.tuning, run.modifiers, "agility", { kind: "agility" }, agility),
    reachModified(data, run, "tip"),
    reachModified(data, run, "treat"),
    statModified(
      data.tuning,
      run.modifiers,
      "squirrelPulls",
      { kind: "squirrelPulls" },
      1,
      Math.round,
    ),
  ];
  return values.flatMap((value) => value ?? []);
}
