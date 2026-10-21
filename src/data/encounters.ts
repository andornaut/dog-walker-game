import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident, each opening a card for the whole pack
// with its options shown left to right in this order, and lucky finds on purpose, each
// applying its effects on contact with a popup.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
// art is a key into the art manifest's images.
export const ENCOUNTERS = {
  biscuitNeighbour: {
    kind: "lucky",
    name: "Generous neighbour",
    resolution: {
      art: "card-biscuit-neighbour-take",
      effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
      kind: "instant",
    },
  },
  lostWallet: {
    kind: "lucky",
    name: "Lost wallet",
    resolution: {
      art: "card-lost-wallet-keep",
      effects: [{ amount: "lostWalletKeep", change: "gain", kind: "money" }],
      kind: "instant",
    },
  },
  otherDog: {
    hitLabel: "NEW FRIEND!",
    kind: "obstacle",
    movement: { kind: "dart" },
    name: "Other dog",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-other-dog-sniff",
          effects: [
            { amount: 1, kind: "hearts", target: { kind: "affected" } },
            { amount: "missedTips", change: "lose", kind: "money" },
          ],
          name: "Let them sniff",
        },
        {
          art: "card-other-dog-pull-away",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Pull away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  puddle: {
    hitLabel: "SOAKED!",
    kind: "obstacle",
    name: "Puddle",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-puddle-towel",
          effects: [{ amount: "encounterLow", change: "lose", kind: "money" }],
          name: "Towel off",
        },
        {
          art: "card-puddle-through",
          effects: [{ debuff: "muddy", kind: "debuff" }],
          name: "Splash through",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
  skunk: {
    hitLabel: "SPRAYED!",
    kind: "obstacle",
    name: "Skunk",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-skunk-grooming",
          effects: [
            {
              amount: "encounterHigh",
              change: "lose",
              kind: "money",
            },
          ],
          name: "Full groom",
        },
        {
          art: "card-skunk-rinse",
          effects: [{ debuff: "stinky", kind: "debuff" }],
          name: "Quick rinse",
        },
        {
          art: "card-skunk-ignore",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Hold your nose",
        },
      ],
    },
    shape: { lanes: 2, rows: 2 },
  },
  squirrel: {
    hitLabel: "SQUIRREL!",
    kind: "obstacle",
    movement: { kind: "dart" },
    name: "Squirrel",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-squirrel-chase",
          chase: true,
          effects: [{ amount: "squirrelChase", change: "lose", kind: "money" }],
          name: "Let them chase",
        },
        {
          art: "card-squirrel-hold",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Hold tight",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  thief: {
    hitLabel: "PICKPOCKETED!",
    kind: "obstacle",
    movement: { kind: "step", steps: 2 },
    name: "Thief",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-thief-let-go",
          effects: [{ amount: "thiefLetGo", change: "lose", kind: "money" }],
          name: "Let them go",
        },
        {
          art: "card-thief-chase",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Chase them off",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
} as const satisfies Record<EncounterId, Encounter>;
