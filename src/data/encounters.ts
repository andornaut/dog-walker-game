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
    name: "Biscuit neighbour",
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
          name: "Return it",
        },
        {
          art: "card-lost-wallet-keep",
          effects: [
            { amount: "lostWalletKeep", change: "gain", kind: "money" },
            { amount: -1, kind: "hearts", target: { kind: "affected" } },
          ],
          name: "Keep it",
        },
      ],
    },
  },
  otherDog: {
    affects: { kind: "all" },
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
          name: "Go through",
        },
        {
          art: "card-puddle-towel",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Towel",
        },
      ],
    },
  },
  skunk: {
    affects: { kind: "caught" },
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
          name: "Grooming",
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
          name: "Ignore",
        },
      ],
    },
  },
  squirrel: {
    affects: { kind: "trait", trait: "chaser" },
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
  },
  thief: {
    affects: { kind: "all" },
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
  },
} as const satisfies Record<EncounterId, Encounter>;
