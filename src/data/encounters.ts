import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident, lucky ones on purpose.
// Options show left to right in this order.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
export const ENCOUNTERS = {
  biscuitNeighbour: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Biscuit neighbour",
    options: [
      {
        effects: [
          {
            amount: "biscuitNeighbourTreatsPerDog",
            kind: "treats",
            perDog: { kind: "affected" },
          },
        ],
        name: "Take biscuits",
      },
      { effects: [], name: "Politely pass" },
    ],
  },
  lostWallet: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Lost wallet",
    options: [
      { effects: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }], name: "Return it" },
      {
        effects: [
          { amount: "lostWalletKeep", change: "gain", kind: "money" },
          { amount: -1, kind: "hearts", target: { kind: "affected" } },
        ],
        name: "Keep it",
      },
    ],
  },
  otherDog: {
    affects: { kind: "all" },
    kind: "obstacle",
    name: "Other dog",
    options: [
      {
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "affected" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "Let them sniff",
      },
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
        name: "Pull away",
      },
    ],
  },
  photoOp: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Photo op",
    options: [
      {
        effects: [
          { amount: "photoOpTip", change: "gain", kind: "money" },
          { amount: 1, kind: "hearts", target: { kind: "temperament", temperament: "dramatic" } },
        ],
        name: "Pose",
      },
      { effects: [], name: "Wave and walk on" },
    ],
  },
  puddle: {
    affects: { kind: "caught" },
    kind: "obstacle",
    name: "Puddle",
    options: [
      {
        effects: [
          { amount: -1, kind: "hearts", target: { kind: "affected" }, traitAmounts: { fancy: -2 } },
        ],
        name: "Go through",
      },
      {
        effects: [
          { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "Towel",
      },
    ],
  },
  skunk: {
    affects: { kind: "caught" },
    kind: "obstacle",
    name: "Skunk",
    options: [
      {
        effects: [
          { amount: "encounterHigh", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "Grooming",
      },
      {
        effects: [
          { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
          { debuff: "stinky", kind: "debuff" },
        ],
        name: "Quick rinse",
      },
      { effects: [{ amount: -2, kind: "hearts", target: { kind: "affected" } }], name: "Ignore" },
    ],
  },
  squirrel: {
    affects: { kind: "trait", trait: "chaser" },
    kind: "obstacle",
    name: "Squirrel",
    options: [
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
        name: "Hold tight",
      },
      {
        effects: [{ amount: "squirrelChase", change: "lose", kind: "money" }],
        name: "Let them chase",
      },
    ],
  },
  thief: {
    affects: { kind: "all" },
    kind: "obstacle",
    name: "Thief",
    noCardWhen: { kind: "packHasSize", size: "big" },
    options: [
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
        name: "Chase them off",
      },
      { effects: [{ amount: "thiefLetGo", change: "lose", kind: "money" }], name: "Let it go" },
    ],
  },
} as const satisfies Record<EncounterId, Encounter>;
