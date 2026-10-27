import type { Debuff } from "./types";

// Applying a debuff the pack already has restarts its time; debuffs never stack. Nothing
// cures one: it runs out. Zoomies has no modifiers: the walk drifts the pack while it lasts,
// every seconds.zoomiesDriftSeconds. Spotlight makes plain bumps cost its bumpMoney in cash
// instead of hearts. Muddy slows the pack's lane changes to muddyLaneSlow of their speed.
export const DEBUFFS = {
  muddy: {
    modifiers: [{ by: "muddyLaneSlow", operation: "multiply", stat: "agility" }],
    name: "Muddy",
    seconds: "muddySeconds",
    stake: "lane changes {slower} slower for {seconds}s",
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
    name: "Zoomies",
    seconds: "zoomiesSeconds",
    stake: "the pack drifts on its own for {seconds}s",
  },
} as const satisfies Record<string, Debuff>;
