import { gameData } from "../data";
import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { keysOf } from "../lib/records";
import { walkLength } from "../rules/route";
import { MAX_RUN_DOGS } from "../save/schema";
import { homeRunSetup, stripDevParams } from "./devStart";
import { type ParsedRunSetup, parseRunSetup, randomSeed, type RunSetupLimits } from "./runSetup";

const SPEED_LIMITS = { max: 10, min: 0.1 };

export function runSetupLimitsFor(
  data: Pick<GameData, "dogs" | "shopGear" | "walkers" | "world">,
): RunSetupLimits<DogId, GearId, WalkerId> {
  return {
    dogIds: keysOf(data.dogs),
    gearIds: keysOf(data.shopGear),
    maxPackSize: MAX_RUN_DOGS,
    speed: SPEED_LIMITS,
    walkerIds: keysOf(data.walkers),
    zoneCount: walkLength(data),
    zoneIds: data.world.zones.map(({ id }) => id),
  };
}

let parsed: ParsedRunSetup<DogId, GearId, WalkerId> | undefined;

// The setup in this page's URL, parsed on first use and kept for the page's life, so every
// scene sees the same random seed when the URL has none. Warnings go to the console.
export function pageRunSetup(): ParsedRunSetup<DogId, GearId, WalkerId> {
  if (parsed === undefined) {
    parsed = parseRunSetup(runSetupLimitsFor(gameData), randomSeed, globalThis.location.search);
    parsed.warnings.forEach((warning) => console.warn(`Run setup: ${warning}`));
  }
  return parsed;
}

// Called when the player is home: the URL's run overrides applied to the walk they started, so
// they leave the URL and the page's setup, and the start screen's picks decide the next walk.
export function clearRunOverrides(): void {
  const current = pageRunSetup();
  parsed = {
    setup: homeRunSetup(current.setup, randomSeed()),
    warnings: [],
  };
  const href = globalThis.location.href;
  const stripped = stripDevParams(href, false);
  if (stripped !== href) {
    globalThis.history.replaceState(globalThis.history.state, "", stripped);
  }
}
