import type { DogId, GameData } from "../data/types";
import { fillLine } from "../lib/lines";
import type { DogStats, Owned, SaveStats } from "../save/schema";
import { statsPage, ZERO_DOG_STATS } from "../save/stats";
import { dollarText } from "./home";
import { MENU_TEXT_FIELDS } from "./menuText";

export interface StatsRow {
  readonly label: string;
  readonly value: string;
}

// The Stats page's overall figures, in the rulebook's order.
export function overallRows(
  data: Pick<GameData, "dogs" | "menuText">,
  stats: SaveStats,
): { outcomes: StatsRow[]; overall: StatsRow[] } {
  const text = data.menuText.stats;
  const page = statsPage(stats);
  const count = String(page.timesFired);
  const timesFired =
    page.mostFiredBy === null
      ? count
      : fillLine(MENU_TEXT_FIELDS.stats, text, "timesFiredBy", {
          count,
          owner: data.dogs[page.mostFiredBy].owner.name,
        });
  return {
    outcomes: [
      { label: text.outcomes.finished, value: String(page.runs.finished) },
      { label: text.outcomes.wentHome, value: String(page.runs.wentHome) },
      { label: text.outcomes.noDogs, value: String(page.runs.noDogs) },
    ],
    overall: [
      { label: text.overall.runsPlayed, value: String(page.runsPlayed) },
      { label: text.overall.bestRun, value: dollarText(page.bestRunCents) },
      { label: text.overall.lifetime, value: dollarText(page.lifetimeCents) },
      { label: text.overall.timesFired, value: timesFired },
      { label: text.overall.bestZone, value: String(page.bestZoneFinished) },
    ],
  };
}

interface DogStatsRow extends DogStats {
  readonly dog: DogId;
  readonly name: string;
}

// One row per dog the player owns or has walked, in roster order.
export function dogRows(
  data: Pick<GameData, "dogs">,
  owned: Pick<Owned, "dogs">,
  stats: SaveStats,
): DogStatsRow[] {
  return (Object.keys(data.dogs) as DogId[]).flatMap((dog) => {
    const walked = stats.dogs[dog];
    if (walked === undefined && !owned.dogs.includes(dog)) {
      return [];
    }
    return [
      {
        dog,
        name: data.dogs[dog].name,
        ...(walked ?? ZERO_DOG_STATS),
      },
    ];
  });
}
