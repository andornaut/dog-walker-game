import type { GameData, Stat } from "../data/types";
import { packDogs, placeInPack } from "../state/pack";
import type { RunState } from "../state/runState";
import { packSizeBonus, sizeHearts } from "./dogs";
import { type ModifiedSubject, type ModifiedValue, statModified } from "./modified";
import { statParts } from "./modifiers";
import { currentZone } from "./route";
import { read } from "./units";
import { zoneStats } from "./zones";

type StandingData = Pick<GameData, "dogs" | "tuning" | "walkers" | "world">;

type StandingRun = Pick<RunState, "modifiers" | "pack" | "route" | "walker" | "zoneIndex">;

// How many lanes beside the pack's a tip or a treat is grabbed from, as the walk rounds it,
// when tipReach or treatReach modifiers, such as Long reach's, change it.
export function reachModified(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "modifiers">,
  pickup: "tip" | "treat",
): ModifiedValue | null {
  const stat = pickup === "treat" ? "treatReach" : "tipReach";
  const parts = statParts(data.tuning, run.modifiers, stat, 0);
  return statModified({ kind: "reach", pickup }, 0, parts, Math.round);
}

// Each walking owner's max hearts, when maxHearts modifiers, such as Lucky collar's, change it:
// before is the max with no modifiers, and each share is held to hearts.maxOwnerHearts.
function maxHeartsModified(data: StandingData, run: StandingRun): ModifiedValue[] {
  const cap = read(data.tuning, "hearts", "maxOwnerHearts");
  return packDogs(run).flatMap((dog) => {
    const place = placeInPack(run, dog);
    const base = sizeHearts(data.tuning, data.dogs[dog]) + packSizeBonus(data.tuning, place);
    const parts = statParts(data.tuning, run.modifiers, "maxHearts", base);
    const modified = statModified({ dog, kind: "maxHearts" }, base, parts, (value) =>
      Math.min(cap, value),
    );
    return modified === null ? [] : [modified];
  });
}

// The current zone's spawn counts, as the walk plans them, when obstacleSpawns, tipSpawns or
// treatSpawns modifiers, such as Rush hour's or Treat finder's, change them. None between a
// zone's end and the fork after it.
function spawnsModified(data: StandingData, run: StandingRun): ModifiedValue[] {
  if (run.route[run.zoneIndex] === undefined) {
    return [];
  }
  const stats = zoneStats(data.tuning, currentZone(data, run), run.zoneIndex);
  const counts: readonly [Extract<ModifiedSubject, { kind: "spawns" }>["spawn"], Stat, number][] = [
    ["minorObstacles", "obstacleSpawns", stats.minorObstacles],
    ["obstacles", "obstacleSpawns", stats.obstacles],
    ["tips", "tipSpawns", stats.tips],
    ["treats", "treatSpawns", stats.treats],
  ];
  return counts.flatMap(([spawn, stat, base]) => {
    const parts = statParts(data.tuning, run.modifiers, stat, base);
    return statModified({ kind: "spawns", spawn }, base, parts, Math.round) ?? [];
  });
}

// Every value modifiers change for as long as they last, rather than at a moment of the walk:
// the starting money, each owner's max hearts, the walker's agility, how far tips and treats are
// grabbed from, how many pulls a squirrel draws, and the current zone's spawn counts. Each is
// left out unless a modifier changes it. A moment a modifier changes, such as a bump or a tip,
// is reported where it happens instead.
export function standingModified(data: StandingData, run: StandingRun): ModifiedValue[] {
  const purse = read(data.tuning, "money", "startPurse");
  const agility = data.walkers[run.walker].agility;
  const values = [
    statModified(
      { kind: "startMoney" },
      purse,
      statParts(data.tuning, run.modifiers, "startMoney", purse),
    ),
    ...maxHeartsModified(data, run),
    statModified(
      { kind: "agility" },
      agility,
      statParts(data.tuning, run.modifiers, "agility", agility),
    ),
    reachModified(data, run, "tip"),
    reachModified(data, run, "treat"),
    statModified(
      { kind: "squirrelPulls" },
      1,
      statParts(data.tuning, run.modifiers, "squirrelPulls", 1),
      Math.round,
    ),
    ...spawnsModified(data, run),
  ];
  return values.flatMap((value) => value ?? []);
}
