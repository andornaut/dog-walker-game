import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident and lucky finds on purpose. A card
// obstacle opens a card for the whole pack with its options shown left to right in this order;
// a contact obstacle applies its effects to the pack as it is touched; touching a pull obstacle
// does nothing, and dogs pull toward it. A lucky find applies its effects on contact with a
// popup.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
// art is a key into the art manifest's images.
export const ENCOUNTERS = {
  // Each neighbourhood's own card obstacle comes only in its zone.
  capybara: {
    hitLabel: "CAPYBARA!",
    hitWord: "SQUEAK!",
    kind: "obstacle",
    movement: { kind: "step", steps: { max: 2, min: 1 } },
    name: "Escaped capybara",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-capybara-help",
          effects: [{ debuff: "muddy", kind: "debuff" }],
          name: "Help the keeper",
        },
        {
          art: "card-capybara-call-zoo",
          effects: [{ amount: "capybaraCall", change: "lose", kind: "money" }],
          name: "Call the zoo",
        },
        {
          art: "card-capybara-drag",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Drag them away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["park"],
  },
  droppedCone: {
    hitLabel: "MELTDOWN!",
    hitWord: "SPLAT!",
    kind: "obstacle",
    name: "Dropped ice cream",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-dropped-cone-lick",
          effects: [{ debuff: "zoomies", kind: "debuff" }],
          name: "Let them lick it",
        },
        {
          art: "card-dropped-cone-buy",
          effects: [{ amount: "newCone", change: "lose", kind: "money" }],
          name: "Buy a new cone",
        },
        {
          art: "card-dropped-cone-walk-on-by",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Walk on by",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["pawsPromenade"],
  },
  fishCrates: {
    hitLabel: "FISHY!",
    hitWord: "FLOP!",
    kind: "obstacle",
    name: "Fish crate spill",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-fish-crates-sniff",
          effects: [{ debuff: "stinky", kind: "debuff" }],
          name: "Sniff the fish",
        },
        {
          art: "card-fish-crates-pay",
          effects: [{ amount: "fishCleanUp", change: "lose", kind: "money" }],
          name: "Pay for the fish",
        },
        {
          art: "card-fish-crates-hurry-past",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Hurry past",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["shops"],
  },
  lostWallet: {
    kind: "lucky",
    name: "Lost wallet",
    resolution: {
      art: "card-lost-wallet-keep",
      effects: [{ amount: "lostWalletKeep", change: "gain", kind: "money" }],
      kind: "instant",
      tally: "walletsFound",
    },
  },
  otherDog: {
    hitLabel: "NEW FRIEND!",
    hitWord: "SNIFF!",
    kind: "obstacle",
    movement: { kind: "dart", stopShare: 0.33, tilt: { max: 0, min: 0 }, turnBackShare: 0.33 },
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
  pettingNeighbour: {
    kind: "lucky",
    movement: { kind: "step", steps: { max: 2, min: 1 } },
    name: "Friendly neighbor",
    resolution: {
      art: "card-petting-neighbour-take",
      effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
      kind: "instant",
      tally: "neighboursMet",
    },
  },
  porchCat: {
    hitLabel: "HISS!",
    hitWord: "HISS!",
    kind: "obstacle",
    name: "Porch cat",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-porch-cat-stand",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "lead" } }],
          name: "Stand your ground",
        },
        {
          art: "card-porch-cat-treat",
          effects: [{ amount: "porchCatTreat", change: "lose", kind: "money" }],
          name: "Treat bribe",
        },
        {
          art: "card-porch-cat-bolt",
          effects: [{ debuff: "zoomies", kind: "debuff" }],
          name: "Bolt past",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["snoozeCrescent"],
  },
  promoTeam: {
    hitLabel: "FREE SAMPLE!",
    hitWord: "FLASH!",
    kind: "obstacle",
    name: "Big screen promo",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-promo-team-wave",
          effects: [{ debuff: "spotlight", kind: "debuff" }],
          name: "Wave hello",
        },
        {
          art: "card-promo-team-merch",
          effects: [{ amount: "promoMerch", change: "lose", kind: "money" }],
          name: "Buy the merch",
        },
        {
          art: "card-promo-team-push-through",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Push through",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["homeStretch"],
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
    movement: { kind: "approach", steps: { max: 5, min: 2 } },
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
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0 },
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
  weddingShoot: {
    hitLabel: "SAY CHEESE!",
    hitWord: "CLICK!",
    kind: "obstacle",
    name: "Wedding photo shoot",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-wedding-shoot-pose",
          effects: [{ debuff: "spotlight", kind: "debuff" }],
          name: "Pose",
        },
        {
          art: "card-wedding-shoot-walk-around",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Walk around",
        },
        {
          art: "card-wedding-shoot-reshoot",
          effects: [{ amount: "weddingApology", change: "lose", kind: "money" }],
          name: "Pay for a reshoot",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
    zones: ["street"],
  },
} as const satisfies Record<EncounterId, Encounter>;
