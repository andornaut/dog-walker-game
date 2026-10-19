import { gameData } from "../data";
import type { DogId, GameData, GearId } from "../data/types";
import { type ParsedRunSetup, parseRunSetup, randomSeed, type RunSetupLimits } from "./runSetup";

// The most dogs a pack holds, as PackDogs allows.
const MAX_PACK_SIZE = 3;
const SPEED_LIMITS = { max: 10, min: 0.1 };

// A link or replay log that names a dog by a former id walks the dog it is now.
// CLEANUP (added 2026-10-19): empty this once no dev link or replay log in use names dash or
// waffles.
export const RENAMED_DOG_IDS: ReadonlyMap<string, DogId> = new Map<string, DogId>([
  ["dash", "archie"],
  ["waffles", "penny"],
]);

export function runSetupLimitsFor(
  data: Pick<GameData, "dogs" | "shopGear" | "world">,
): RunSetupLimits<DogId, GearId> {
  return {
    dogIds: Object.keys(data.dogs) as DogId[],
    gearIds: Object.keys(data.shopGear) as GearId[],
    maxPackSize: MAX_PACK_SIZE,
    renamedDogIds: RENAMED_DOG_IDS,
    speed: SPEED_LIMITS,
    zoneCount: data.world.zones.length,
  };
}

let parsed: ParsedRunSetup<DogId, GearId> | undefined;

// The setup in this page's URL, parsed on first use and kept for the page's life, so every
// scene sees the same random seed when the URL has none. Warnings and notices go to the
// console.
export function pageRunSetup(): ParsedRunSetup<DogId, GearId> {
  if (parsed === undefined) {
    parsed = parseRunSetup(runSetupLimitsFor(gameData), randomSeed, globalThis.location.search);
    [...parsed.warnings, ...parsed.notices].forEach((warning) =>
      console.warn(`Run setup: ${warning}`),
    );
  }
  return parsed;
}
