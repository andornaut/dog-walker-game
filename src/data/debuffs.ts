import type { Debuff } from "./types";

// Applying a debuff the pack already has refreshes it; debuffs never stack.
export const DEBUFFS = {
  stinky: {
    duration: "zone",
    modifiers: [{ by: "stinkyTipSpawns", operation: "multiply", stat: "tipSpawns" }],
    name: "Stinky",
  },
} as const satisfies Record<string, Debuff>;
