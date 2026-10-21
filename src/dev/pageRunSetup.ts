import { gameData } from "../data";
import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { walkLength } from "../rules/route";
import { MAX_RUN_DOGS } from "../save/schema";
import { homeRunSetup, stripDevParams } from "./devStart";
import { type ParsedRunSetup, parseRunSetup, randomSeed, type RunSetupLimits } from "./runSetup";

const SPEED_LIMITS = { max: 10, min: 0.1 };

// A link or replay log that names a dog by a former id walks the dog it is now.
// CLEANUP (added 2026-10-19): empty this once no dev link or replay log in use names dash or
// waffles.
const RENAMED_DOG_IDS: ReadonlyMap<string, DogId> = new Map<string, DogId>([
  ["dash", "archie"],
  ["waffles", "penny"],
]);

export function runSetupLimitsFor(
  data: Pick<GameData, "dogs" | "shopGear" | "walkers" | "world">,
): RunSetupLimits<DogId, GearId, WalkerId> {
  return {
    dogIds: Object.keys(data.dogs) as DogId[],
    gearIds: Object.keys(data.shopGear) as GearId[],
    maxPackSize: MAX_RUN_DOGS,
    renamedDogIds: RENAMED_DOG_IDS,
    speed: SPEED_LIMITS,
    walkerIds: Object.keys(data.walkers) as WalkerId[],
    zoneCount: walkLength(data),
    zoneIds: data.world.zones.map(({ id }) => id),
  };
}

let parsed: ParsedRunSetup<DogId, GearId, WalkerId> | undefined;

// The setup in this page's URL, parsed on first use and kept for the page's life, so every
// scene sees the same random seed when the URL has none. Warnings and notices go to the
// console.
export function pageRunSetup(): ParsedRunSetup<DogId, GearId, WalkerId> {
  if (parsed === undefined) {
    parsed = parseRunSetup(runSetupLimitsFor(gameData), randomSeed, globalThis.location.search);
    [...parsed.warnings, ...parsed.notices].forEach((warning) =>
      console.warn(`Run setup: ${warning}`),
    );
  }
  return parsed;
}

// Called when the player is home: the URL's run overrides applied to the walk they started, so
// they leave the URL and the page's setup, and the start screen's picks decide the next walk.
export function clearRunOverrides(): void {
  const current = pageRunSetup();
  parsed = {
    notices: [],
    setup: homeRunSetup(current.setup, randomSeed()),
    warnings: [],
  };
  const href = globalThis.location.href;
  const stripped = stripDevParams(href, false);
  if (stripped !== href) {
    globalThis.history.replaceState(globalThis.history.state, "", stripped);
  }
}
