import type { Debuff } from "./types";

// Applying a debuff the pack already has refreshes it; debuffs never stack.
export const DEBUFFS = {
  spooked: {
    curedByTreat: true,
    duration: { seconds: "spookedSeconds" },
    modifiers: [{ by: "spookedLaneMove", operation: "multiply", stat: "laneMove" }],
    name: "Spooked",
  },
  stinky: {
    curedByTreat: true,
    duration: "zone",
    modifiers: [{ by: "stinkyTipSpawns", operation: "multiply", stat: "tipSpawns" }],
    name: "Stinky",
  },
  tangled: {
    curedByTreat: true,
    duration: { seconds: "tangledSeconds" },
    modifiers: [{ by: "tangledLaneLock", operation: "add", stat: "laneChangeLock" }],
    name: "Tangled",
  },
  tuckeredOut: {
    curedByTreat: true,
    duration: "zone",
    modifiers: [{ by: "tuckeredUrgency", operation: "multiply", stat: "needUrgency" }],
    name: "Tuckered out",
  },
} as const satisfies Record<string, Debuff>;
