import type { Debuff } from "./types";

// Applying a debuff the pack already has restarts its time; debuffs never stack. Nothing
// cures one: it runs out. Zoomies has no modifiers: the walk drifts the pack while it lasts,
// every seconds.zoomiesDriftSeconds.
export const DEBUFFS = {
  muddy: {
    modifiers: [{ by: "muddyBumpHearts", operation: "multiply", stat: "bumpHearts" }],
    name: "Muddy",
    seconds: "muddySeconds",
    stake: "bumps cost 2♥ for {seconds}s",
  },
  stinky: {
    modifiers: [{ by: "stinkyTipValue", operation: "multiply", stat: "tipValue" }],
    name: "Stinky",
    seconds: "stinkySeconds",
    stake: "tips pay nothing for {seconds}s",
  },
  zoomies: {
    modifiers: [],
    name: "Zoomies",
    seconds: "zoomiesSeconds",
    stake: "the pack drifts on its own for {seconds}s",
  },
} as const satisfies Record<string, Debuff>;
