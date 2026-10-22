import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident and lucky finds on purpose. A card
// obstacle opens a card for the whole pack with its options shown left to right in this order;
// a contact obstacle applies its effects to the pack as it is touched; touching a pull obstacle
// does nothing, and dogs pull toward it. A lucky find applies its effects on contact with a
// popup.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
// art is a key into the art manifest's images.
export const ENCOUNTERS = {
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
    hitWord: "SNIFF!",
    kind: "obstacle",
    movement: { kind: "dart", tilt: { max: 0, min: 0 }, turnBackShare: 0.33 },
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
          tally: "sniffs",
        },
        {
          art: "card-other-dog-pull-away",
          effects: [{ debuff: "zoomies", kind: "debuff" }],
          name: "Pull away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  pettingNeighbor: {
    kind: "lucky",
    name: "Friendly neighbor",
    resolution: {
      art: "card-petting-neighbor-take",
      effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
      kind: "instant",
    },
  },
  puddle: {
    hitWord: "SPLOSH!",
    kind: "obstacle",
    name: "Puddle",
    resolution: {
      effects: [{ debuff: "muddy", kind: "debuff" }],
      immuneText: "puddles don't muddy the pack",
      kind: "contact",
    },
    shape: { lanes: 2, rows: 1 },
  },
  skunk: {
    hitLabel: "SPRAYED!",
    hitWord: "PHEW!",
    kind: "obstacle",
    movement: { kind: "approach", steps: { max: 3, min: 2 } },
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
    hitWord: "CHIRP!",
    kind: "obstacle",
    movement: { kind: "dart", tilt: { max: 0, min: 0 }, turnBackShare: 0 },
    name: "Squirrel",
    resolution: { kind: "pull" },
    shape: { lanes: 1, rows: 1 },
  },
  thief: {
    hitLabel: "YOINK!",
    hitWord: "YOINK!",
    kind: "obstacle",
    movement: { kind: "approach", steps: { max: 3, min: 2 } },
    name: "Thief",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-thief-let-go",
          effects: [{ amount: "thiefLetGo", change: "lose", kind: "money" }],
          name: "Let them go",
          tally: "thievesLetGo",
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
