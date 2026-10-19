import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident, lucky ones on purpose.
// A "card" resolution opens a card, its options shown left to right in this order; an
// "instant" one applies its effects on contact with a popup.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
// art is a key into the art manifest's images.
export const ENCOUNTERS = {
  biscuitNeighbour: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Generous neighbour",
    resolution: {
      art: "card-biscuit-neighbour-take",
      effects: [
        { amount: "biscuitNeighbourTreatsPerDog", kind: "treats", perDog: { kind: "affected" } },
      ],
      kind: "instant",
    },
  },
  lostWallet: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Lost wallet",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-lost-wallet-return",
          effects: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
          name: "Hand it in",
        },
        {
          art: "card-lost-wallet-keep",
          effects: [
            { amount: "lostWalletKeep", change: "gain", kind: "money" },
            { amount: -1, kind: "hearts", target: { kind: "affected" } },
          ],
          name: "Finders keepers",
        },
      ],
    },
  },
  otherDog: {
    affects: { kind: "all" },
    hitLabel: "NEW FRIEND!",
    kind: "obstacle",
    name: "Other dog",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-other-dog-sniff",
          effects: [
            { amount: 1, kind: "hearts", target: { kind: "affected" } },
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
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
  photoOp: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Photo op",
    resolution: {
      art: "card-photo-op-pose",
      effects: [
        { amount: "photoOpTip", change: "gain", kind: "money" },
        { amount: 1, kind: "hearts", target: { kind: "temperament", temperament: "dramatic" } },
      ],
      kind: "instant",
    },
  },
  puddle: {
    affects: { kind: "caught" },
    hitLabel: "SOAKED!",
    kind: "obstacle",
    name: "Puddle",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-puddle-through",
          effects: [
            {
              amount: -1,
              kind: "hearts",
              target: { kind: "affected" },
              traitAmounts: { fancy: -2 },
            },
          ],
          name: "Splash through",
        },
        {
          art: "card-puddle-towel",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Towel off",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
  skunk: {
    affects: { kind: "caught" },
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
              perDog: { kind: "affected" },
            },
          ],
          name: "Full groom",
        },
        {
          art: "card-skunk-rinse",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
            { debuff: "stinky", kind: "debuff" },
          ],
          name: "Quick rinse",
        },
        {
          art: "card-skunk-ignore",
          effects: [{ amount: -2, kind: "hearts", target: { kind: "affected" } }],
          name: "Hold your nose",
        },
      ],
    },
    shape: { lanes: 2, rows: 2 },
  },
  squirrel: {
    affects: { kind: "trait", trait: "chaser" },
    hitLabel: "SQUIRREL!",
    kind: "obstacle",
    name: "Squirrel",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-squirrel-hold",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Hold tight",
        },
        {
          art: "card-squirrel-chase",
          effects: [{ amount: "squirrelChase", change: "lose", kind: "money" }],
          name: "Let them chase",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  thief: {
    affects: { kind: "all" },
    hitLabel: "PICKPOCKETED!",
    kind: "obstacle",
    name: "Thief",
    noCardWhen: { kind: "packHasSize", size: "big" },
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-thief-chase",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Chase them off",
        },
        {
          art: "card-thief-let-go",
          effects: [{ amount: "thiefLetGo", change: "lose", kind: "money" }],
          name: "Let it go",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
} as const satisfies Record<EncounterId, Encounter>;
