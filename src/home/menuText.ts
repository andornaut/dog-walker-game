import type { FieldTable } from "../text/lines";

// The {name}s each menu text line may use, by group; a line left out uses none. A line is
// filled with fillLine(MENU_TEXT_FIELDS.<group>, gameData.menuText.<group>, key, fields).
export const MENU_TEXT_FIELDS = {
  celebration: { titleMany: ["count"] },
  end: { firedYou: ["owner"] },
  settings: { volume: ["percent"] },
  stats: {
    badgeLine: ["line"],
    earnedCount: ["earned", "total"],
    timesFiredBy: ["count", "owner"],
  },
} as const satisfies FieldTable;
