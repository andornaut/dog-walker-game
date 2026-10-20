import type { FieldTable } from "../text/lines";

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    forkFees: ["fees"],
    need: ["amount"],
    quirkNoLoss: ["quirk"],
  },
  firedBy: ["owner"],
  homeQuestion: {
    keep: ["money"],
    lose: ["fees", "zone"],
    zonesLeft: ["count"],
  },
  newWalker: {
    info: ["pace", "style"],
    subtitle: ["walker"],
  },
  zoneDone: {
    earnings: ["fees", "tips"],
    subtitle: ["zone"],
  },
} as const satisfies FieldTable;
