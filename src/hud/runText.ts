import type { FieldTable } from "../text/lines";

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    forkFees: ["fees"],
    need: ["amount"],
    quirkNoLoss: ["quirk"],
    walkerGreeting: ["walker"],
  },
  firedBy: ["owner"],
  newWalker: {
    info: ["pace", "style"],
    title: ["walker"],
  },
  zoneDone: {
    earnings: ["fees", "tips"],
    title: ["zone"],
  },
} as const satisfies FieldTable;
