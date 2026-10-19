import { DEBUFFS } from "./debuffs";
import { DOGS } from "./dogs";
import { ENCOUNTERS } from "./encounters";
import { FORCED_STOPS } from "./forcedStops";
import { HELP_PAGES } from "./help";
import { QUIPS } from "./quips";
import { SHOP_GEAR } from "./shop";
import { TUNING } from "./tuning";
import type { GameData } from "./types";
import { UPGRADES } from "./upgrades";
import { WALKERS } from "./walkers";
import { WORLD } from "./world";

interface ValueExports {
  readonly DEBUFFS: typeof DEBUFFS;
  readonly DOGS: typeof DOGS;
  readonly ENCOUNTERS: typeof ENCOUNTERS;
  readonly FORCED_STOPS: typeof FORCED_STOPS;
  readonly HELP_PAGES: typeof HELP_PAGES;
  readonly QUIPS: typeof QUIPS;
  readonly SHOP_GEAR: typeof SHOP_GEAR;
  readonly TUNING: typeof TUNING;
  readonly UPGRADES: typeof UPGRADES;
  readonly WALKERS: typeof WALKERS;
  readonly WORLD: typeof WORLD;
}

function toGameData(values: ValueExports): GameData {
  return {
    debuffs: values.DEBUFFS,
    dogs: values.DOGS,
    encounters: values.ENCOUNTERS,
    forcedStops: values.FORCED_STOPS,
    help: values.HELP_PAGES,
    quips: values.QUIPS,
    shopGear: values.SHOP_GEAR,
    tuning: values.TUNING,
    upgrades: values.UPGRADES,
    walkers: values.WALKERS,
    world: values.WORLD,
  };
}

let values: ValueExports = {
  DEBUFFS,
  DOGS,
  ENCOUNTERS,
  FORCED_STOPS,
  HELP_PAGES,
  QUIPS,
  SHOP_GEAR,
  TUNING,
  UPGRADES,
  WALKERS,
  WORLD,
};
const live: { -readonly [K in keyof GameData]: GameData[K] } = toGameData(values);

// The one live copy of the game data. Read it at the time of use, never cache a value from
// it: in development, editing a value file replaces its group here without a page reload.
export const gameData: GameData = live;

const changeListeners = new Set<() => void>();

// Called after an edited value file is swapped in, so a view can redraw what it derived.
export function onGameDataChange(listener: () => void): void {
  changeListeners.add(listener);
}

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      "./debuffs.ts",
      "./dogs.ts",
      "./encounters.ts",
      "./forcedStops.ts",
      "./help.ts",
      "./quips.ts",
      "./shop.ts",
      "./tuning.ts",
      "./upgrades.ts",
      "./walkers.ts",
      "./world.ts",
    ],
    (modules) => {
      // Only the edited modules are defined; the others keep their current values.
      values = Object.assign({}, values, ...modules.filter((module) => module !== undefined));
      Object.assign(live, toGameData(values));
      changeListeners.forEach((listener) => listener());
    },
  );
}
