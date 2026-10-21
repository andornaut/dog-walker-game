import type { Debuff } from "./types";

// Applying a debuff the pack already has restarts its time; debuffs never stack. Nothing
// cures one: it runs out.
export const DEBUFFS = {
  muddy: {
    modifiers: [{ by: "muddyBumpHearts", operation: "multiply", stat: "bumpHearts" }],
    name: "Muddy",
    seconds: "muddySeconds",
    stake: "bumps cost 2♥ for {seconds}s",
  },
  stinky: {
    modifiers: [{ by: "stinkyTipSpawns", operation: "multiply", stat: "tipSpawns" }],
    name: "Stinky",
    seconds: "stinkySeconds",
    stake: "half the tips for {seconds}s",
  },
} as const satisfies Record<string, Debuff>;
