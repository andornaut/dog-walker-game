import { ACHIEVEMENTS } from "./achievements";
import { DEBUFFS } from "./debuffs";
import { DOGS } from "./dogs";
import { DOG_SLOTS } from "./dogSlots";
import { ENCOUNTERS } from "./encounters";
import { FORCED_STOPS } from "./forcedStops";
import { HELP_PAGES } from "./help";
import { HINTS } from "./hints";
import { HOME_TEXT } from "./homeText";
import { MINOR_OBSTACLES } from "./minorObstacles";
import { QUIPS } from "./quips";
import { RUN_TEXT } from "./runText";
import { SHOP_GEAR } from "./shop";
import { TUNING } from "./tuning";
import type { GameData } from "./types";
import { UPGRADES } from "./upgrades";
import { DEFAULT_WALKER, WALKERS } from "./walkers";
import { WORLD } from "./world";

interface ValueExports {
  readonly ACHIEVEMENTS: typeof ACHIEVEMENTS;
  readonly DEBUFFS: typeof DEBUFFS;
  readonly DEFAULT_WALKER: typeof DEFAULT_WALKER;
  readonly DOGS: typeof DOGS;
  readonly DOG_SLOTS: typeof DOG_SLOTS;
  readonly ENCOUNTERS: typeof ENCOUNTERS;
  readonly FORCED_STOPS: typeof FORCED_STOPS;
  readonly HELP_PAGES: typeof HELP_PAGES;
  readonly HINTS: typeof HINTS;
  readonly HOME_TEXT: typeof HOME_TEXT;
  readonly MINOR_OBSTACLES: typeof MINOR_OBSTACLES;
  readonly QUIPS: typeof QUIPS;
  readonly RUN_TEXT: typeof RUN_TEXT;
  readonly SHOP_GEAR: typeof SHOP_GEAR;
  readonly TUNING: typeof TUNING;
  readonly UPGRADES: typeof UPGRADES;
  readonly WALKERS: typeof WALKERS;
  readonly WORLD: typeof WORLD;
}

function toGameData(values: ValueExports): GameData {
  return {
    achievements: values.ACHIEVEMENTS,
    debuffs: values.DEBUFFS,
    defaultWalker: values.DEFAULT_WALKER,
    dogSlots: values.DOG_SLOTS,
    dogs: values.DOGS,
    encounters: values.ENCOUNTERS,
    forcedStops: values.FORCED_STOPS,
    help: values.HELP_PAGES,
    hints: values.HINTS,
    homeText: values.HOME_TEXT,
    minorObstacles: values.MINOR_OBSTACLES,
    quips: values.QUIPS,
    runText: values.RUN_TEXT,
    shopGear: values.SHOP_GEAR,
    tuning: values.TUNING,
    upgrades: values.UPGRADES,
    walkers: values.WALKERS,
    world: values.WORLD,
  };
}

let values: ValueExports = {
  ACHIEVEMENTS,
  DEBUFFS,
  DEFAULT_WALKER,
  DOGS,
  DOG_SLOTS,
  ENCOUNTERS,
  FORCED_STOPS,
  HELP_PAGES,
  HINTS,
  HOME_TEXT,
  MINOR_OBSTACLES,
  QUIPS,
  RUN_TEXT,
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
      "./achievements.ts",
      "./debuffs.ts",
      "./dogSlots.ts",
      "./dogs.ts",
      "./encounters.ts",
      "./forcedStops.ts",
      "./help.ts",
      "./hints.ts",
      "./homeText.ts",
      "./minorObstacles.ts",
      "./quips.ts",
      "./runText.ts",
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
