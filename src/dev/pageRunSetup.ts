import { gameData } from "../data";
import type { DogId, GameData, GearId } from "../data/types";
import { type ParsedRunSetup, parseRunSetup, randomSeed, type RunSetupLimits } from "./runSetup";

// The most dogs a pack holds, as PackDogs allows.
const MAX_PACK_SIZE = 3;
const SPEED_LIMITS = { max: 10, min: 0.1 };

export function runSetupLimitsFor(
  data: Pick<GameData, "dogs" | "shopGear" | "world">,
): RunSetupLimits<DogId, GearId> {
  return {
    dogIds: Object.keys(data.dogs) as DogId[],
    gearIds: Object.keys(data.shopGear) as GearId[],
    maxPackSize: MAX_PACK_SIZE,
    speed: SPEED_LIMITS,
    zoneCount: data.world.zones.length,
  };
}

let parsed: ParsedRunSetup<DogId, GearId> | undefined;

// The setup in this page's URL, parsed on first use and kept for the page's life, so every
// scene sees the same random seed when the URL has none. Warnings go to the console.
export function pageRunSetup(): ParsedRunSetup<DogId, GearId> {
  if (parsed === undefined) {
    parsed = parseRunSetup(runSetupLimitsFor(gameData), randomSeed, globalThis.location.search);
    parsed.warnings.forEach((warning) => console.warn(`Run setup: ${warning}`));
  }
  return parsed;
}
