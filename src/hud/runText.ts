import type { FieldTable } from "../text/lines";

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: { fires: ["owners"], need: ["amount"] },
  firedBy: ["owner"],
} as const satisfies FieldTable;
