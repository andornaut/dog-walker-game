import type { GameData, HelpPage } from "../data/types";
import { fillNames } from "../lib/lines";
import { dodgeInText, formatDollars } from "../rules/effectText";
import { read, readTable } from "../rules/units";

// The {name}s a help page's body may use, each filled from the game data when the page shows,
// so a tuning change never leaves a stale number.
export const HELP_BODY_FIELDS = [
  "bumpHearts",
  "dodgeIn",
  "largeHearts",
  "loneBonus",
  "mediumHearts",
  "pairBonus",
  "smallHearts",
  "tip",
  "treatCash",
  "treatHearts",
  "walkBonus",
  "walkLength",
  "world",
] as const;

type HelpBodyField = (typeof HELP_BODY_FIELDS)[number];

// Each field's text. dodgeIn is the small dogs' dodge chance as one in so many; loneBonus and
// pairBonus are the lead owner's extra hearts walking one dog and walking two.
export function helpBodyValues(data: GameData): Readonly<Record<HelpBodyField, string>> {
  const { tuning, world } = data;
  const hearts = (size: "large" | "medium" | "small") =>
    String(readTable(tuning, "hearts", "maxBySize", size));
  return {
    bumpHearts: String(read(tuning, "hearts", "bump")),
    dodgeIn: dodgeInText(tuning, "smallDodgeChance"),
    largeHearts: hearts("large"),
    loneBonus: String(readTable(tuning, "hearts", "packSizeBonus", 1)),
    mediumHearts: hearts("medium"),
    pairBonus: String(readTable(tuning, "hearts", "packSizeBonus", 2)),
    smallHearts: hearts("small"),
    tip: formatDollars(read(tuning, "money", "tip")),
    treatCash: formatDollars(read(tuning, "money", "treatCash")),
    treatHearts: String(read(tuning, "hearts", "treat")),
    walkBonus: formatDollars(read(tuning, "money", "walkBonus")),
    walkLength: String(world.walkLength),
    world: world.name,
  };
}

// The page's body with its names filled.
export function helpBody(data: GameData, page: Pick<HelpPage, "body">): string {
  return fillNames(page.body, helpBodyValues(data));
}
