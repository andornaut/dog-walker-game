import type { Debuff } from "./types";

// Applying a debuff the pack already has restarts its time; debuffs never stack. Nothing
// cures one: it runs out. Zoomies drifts the pack in random directions at uniformly random
// walking-time intervals. Spotlight makes bumps cost its bumpMoney in cash on top of their
// hearts. Muddy slows the pack's lane changes to muddyLaneSlow of their speed.
export const DEBUFFS = {
  muddy: {
    modifiers: [{ by: "muddyLaneSlow", operation: "multiply", stat: "agility" }],
    name: "Muddy",
    seconds: "muddySeconds",
    stake: "slower for {seconds}s",
  },
  spotlight: {
    bumpMoney: "spotlightBump",
    modifiers: [],
    name: "Spotlight",
    seconds: "spotlightSeconds",
    stake: "bumps cost {cash} for {seconds}s",
  },
  stinky: {
    modifiers: [{ by: "stinkyTipValue", operation: "multiply", stat: "tipValue" }],
    name: "Stinky",
    seconds: "stinkySeconds",
    stake: "tips pay nothing for {seconds}s",
  },
  zoomies: {
    modifiers: [],
    movement: {
      direction: "random",
      interval: { kind: "uniform", max: "zoomiesDriftMaxSeconds", min: "zoomiesDriftMinSeconds" },
      kind: "drift",
    },
    name: "Zoomies",
    seconds: "zoomiesSeconds",
    stake: "random drifts for {seconds}s",
  },
} as const satisfies Record<string, Debuff>;
