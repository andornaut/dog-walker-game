import type { DebuffId, GameData, HelpPage } from "../data/types";
import { formatDollars } from "../rules/effectText";
import { read, readTable } from "../rules/units";
import { fillNames } from "../text/lines";

// The {name}s a help page's body may use, each filled from the game data when the page shows,
// so a tuning change never leaves a stale number.
export const HELP_BODY_FIELDS = [
  "bigHearts",
  "bumpHearts",
  "debuffSeconds",
  "dodgeIn",
  "loneBonus",
  "mediumHearts",
  "pairBonus",
  "smallHearts",
  "tip",
  "treatHearts",
  "walkLength",
  "world",
] as const;

export type HelpBodyField = (typeof HELP_BODY_FIELDS)[number];

// Each field's text. debuffSeconds is the debuffs' length, or their shortest to longest when
// they differ; dodgeIn is the small dogs' dodge chance as one in so many; loneBonus and pairBonus
// are the lead owner's extra hearts walking one dog and walking two.
export function helpBodyValues(data: GameData): Readonly<Record<HelpBodyField, string>> {
  const { tuning, world } = data;
  const hearts = (size: "big" | "medium" | "small") =>
    String(readTable(tuning, "hearts", "maxBySize", size));
  const seconds = (Object.keys(data.debuffs) as DebuffId[]).map((debuff) =>
    read(tuning, "seconds", data.debuffs[debuff].seconds),
  );
  const shortest = Math.min(...seconds);
  const longest = Math.max(...seconds);
  return {
    bigHearts: hearts("big"),
    bumpHearts: String(read(tuning, "hearts", "bump")),
    debuffSeconds: shortest === longest ? String(shortest) : `${shortest} to ${longest}`,
    dodgeIn: String(Math.round(1 / read(tuning, "probability", "smallDodgeChance"))),
    loneBonus: String(readTable(tuning, "hearts", "packSizeBonus", 1)),
    mediumHearts: hearts("medium"),
    pairBonus: String(readTable(tuning, "hearts", "packSizeBonus", 2)),
    smallHearts: hearts("small"),
    tip: formatDollars(read(tuning, "money", "tip")),
    treatHearts: String(read(tuning, "hearts", "treat")),
    walkLength: String(world.walkLength),
    world: world.name,
  };
}

// The page's body with its names filled.
export function helpBody(data: GameData, page: Pick<HelpPage, "body">): string {
  return fillNames(page.body, helpBodyValues(data));
}
