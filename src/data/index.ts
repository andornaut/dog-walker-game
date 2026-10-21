import { ACHIEVEMENTS } from "./achievements";
import { DEBUFFS } from "./debuffs";
import { DOGS } from "./dogs";
import { DOG_SLOTS } from "./dogSlots";
import { ENCOUNTERS } from "./encounters";
import { HELP_PAGES } from "./help";
import { HINTS } from "./hints";
import { HOME_TEXT } from "./homeText";
import { MENU_TEXT } from "./menuText";
import { MINOR_OBSTACLES } from "./minorObstacles";
import { QUIPS } from "./quips";
import { RUN_TEXT } from "./runText";
import { SHOP_GEAR } from "./shop";
import { TUNING } from "./tuning";
import type { GameData } from "./types";
import { UPGRADES } from "./upgrades";
import { DEFAULT_WALKER, WALKER_PERKS, WALKERS } from "./walkers";
import { WORLD } from "./world";

function toGameData(values: ValueExports): GameData {
  return {
    achievements: values.ACHIEVEMENTS,
    debuffs: values.DEBUFFS,
    defaultWalker: values.DEFAULT_WALKER,
    dogSlots: values.DOG_SLOTS,
    dogs: values.DOGS,
    encounters: values.ENCOUNTERS,
    help: values.HELP_PAGES,
    hints: values.HINTS,
    homeText: values.HOME_TEXT,
    menuText: values.MENU_TEXT,
    minorObstacles: values.MINOR_OBSTACLES,
    quips: values.QUIPS,
    runText: values.RUN_TEXT,
    shopGear: values.SHOP_GEAR,
    tuning: values.TUNING,
    upgrades: values.UPGRADES,
    walkerPerks: values.WALKER_PERKS,
    walkers: values.WALKERS,
    world: values.WORLD,
  };
}

const INITIAL_VALUES = {
  ACHIEVEMENTS,
  DEBUFFS,
  DEFAULT_WALKER,
  DOGS,
  DOG_SLOTS,
  ENCOUNTERS,
  HELP_PAGES,
  HINTS,
  HOME_TEXT,
  MENU_TEXT,
  MINOR_OBSTACLES,
  QUIPS,
  RUN_TEXT,
  SHOP_GEAR,
  TUNING,
  UPGRADES,
  WALKERS,
  WALKER_PERKS,
  WORLD,
} as const;
type ValueExports = typeof INITIAL_VALUES;

let values: ValueExports = INITIAL_VALUES;
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
      "./help.ts",
      "./hints.ts",
      "./homeText.ts",
      "./menuText.ts",
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
