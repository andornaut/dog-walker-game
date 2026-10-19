import type { DogId, GameData } from "../data/types";
import type { DogStats, Owned, SaveStats } from "../save/schema";
import { statsPage } from "../save/stats";
import { dollarText } from "./home";

export interface StatsRow {
  readonly label: string;
  readonly value: string;
}

// The Stats page's overall figures, in the rulebook's order. Worlds finished equals runs
// finished while there is one world.
export function overallRows(
  data: Pick<GameData, "dogs" | "world">,
  stats: SaveStats,
): { outcomes: StatsRow[]; overall: StatsRow[] } {
  const page = statsPage(stats);
  const firedBy =
    page.mostFiredBy === null ? "" : ` (most: ${data.dogs[page.mostFiredBy].owner.name})`;
  return {
    outcomes: [
      { label: "Finished", value: String(page.runs.finished) },
      { label: "Headed home", value: String(page.runs.wentHome) },
      { label: "Out of dogs", value: String(page.runs.noDogs) },
    ],
    overall: [
      { label: "Runs played", value: String(page.runsPlayed) },
      { label: "Best run", value: dollarText(page.bestRunCents) },
      { label: "Lifetime earnings", value: dollarText(page.lifetimeCents) },
      { label: "Times fired", value: `${page.timesFired}${firedBy}` },
      { label: "Best zone completed", value: String(page.bestZoneFinished) },
      { label: `${data.world.name} finished`, value: String(page.runs.finished) },
    ],
  };
}

export interface DogStatsRow extends DogStats {
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
        timesFired: walked?.timesFired ?? 0,
        walks: walked?.walks ?? 0,
        zonesFinished: walked?.zonesFinished ?? 0,
      },
    ];
  });
}
