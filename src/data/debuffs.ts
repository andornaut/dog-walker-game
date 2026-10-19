import type { Debuff } from "./types";

// Applying a debuff the pack already has refreshes it; debuffs never stack.
export const DEBUFFS = {
  stinky: {
    duration: "zone",
    modifiers: [{ by: "stinkyTip", operation: "multiply", stat: "tipValue" }],
    name: "Stinky",
  },
} as const satisfies Record<string, Debuff>;
