import type { Encounter, EncounterId } from "./types";

// Things the pack bumps into: obstacles by accident and lucky finds on purpose. A card
// obstacle opens a card for the whole pack with its options shown left to right in this order;
// a contact obstacle applies its effects to the pack as it is touched; touching a pull obstacle
// does nothing, and dogs pull toward it. A lucky find applies its effects on contact with a
// popup.
// Money amounts and modifier values are keys into tuning.ts; hearts are per owner.
// art is a key into the art manifest's images. A card option's id, unique on its card, is what
// the save counts its picks by: keep it when the option is renamed.
export const ENCOUNTERS = {
  bigScreenPromo: {
    hitLabel: "FREE SAMPLE!",
    hitWord: "FLASH!",
    kind: "obstacle",
    name: "Big screen promo",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-big-screen-promo-wave",
          effects: [{ debuff: "spotlight", kind: "debuff" }],
          id: "wave",
          name: "Wave hello",
        },
        {
          art: "card-big-screen-promo-merch",
          effects: [{ amount: "promoMerch", change: "lose", kind: "money" }],
          id: "merch",
          name: "Buy the merch",
        },
        {
          art: "card-big-screen-promo-push-through",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "pushThrough",
          name: "Push through",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["yongeStreet"],
  },
  cheeseCrates: {
    hitLabel: "PEE-YEW!",
    hitWord: "WHIFF!",
    kind: "obstacle",
    name: "Cheese crates",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-cheese-crates-sniff",
          effects: [{ debuff: "stinky", kind: "debuff" }],
          id: "sniff",
          name: "Have a sniff",
        },
        {
          art: "card-cheese-crates-buy",
          effects: [{ amount: "cheeseBuy", change: "lose", kind: "money" }],
          id: "buy",
          name: "Buy the cheese",
        },
        {
          art: "card-cheese-crates-hurry-on",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "hurryOn",
          name: "Hurry on",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["kensingtonMarket", "distilleryDistrict"],
  },
  droppedIceCream: {
    hitLabel: "MELTDOWN!",
    hitWord: "SPLAT!",
    kind: "obstacle",
    name: "Dropped ice cream",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-dropped-ice-cream-lick",
          effects: [{ debuff: "muddy", kind: "debuff" }],
          id: "lick",
          name: "Let them lick it",
        },
        {
          art: "card-dropped-ice-cream-buy",
          effects: [{ amount: "newCone", change: "lose", kind: "money" }],
          id: "buy",
          name: "Buy a new cone",
        },
        {
          art: "card-dropped-ice-cream-walk-on-by",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "walkOnBy",
          name: "Walk on by",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["theBeaches"],
  },
  // A neighbourhood card obstacle comes only in its zones.
  escapedCapybara: {
    hitLabel: "CAPYBARA!",
    hitWord: "SQUEAK!",
    kind: "obstacle",
    movement: { kind: "step", steps: { max: 2, min: 1 } },
    name: "Escaped capybara",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-escaped-capybara-help",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "lead" } }],
          id: "help",
          name: "Help the keeper",
        },
        {
          art: "card-escaped-capybara-call-zoo",
          effects: [{ amount: "escapedCapybaraCall", change: "lose", kind: "money" }],
          id: "callZoo",
          name: "Call the zoo",
        },
        {
          art: "card-escaped-capybara-drag",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "drag",
          name: "Drag them away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["highPark"],
  },
  friendlyNeighbour: {
    kind: "lucky",
    movement: { kind: "step", steps: { max: 2, min: 1 } },
    name: "Friendly neighbour",
    resolution: {
      art: "card-friendly-neighbour-take",
      effects: [{ amount: "neighbourHearts", kind: "sharedHearts" }],
      kind: "instant",
      tally: "neighboursMet",
    },
  },
  greenBinSpill: {
    hitLabel: "BIN SPILL!",
    hitWord: "GLOP!",
    kind: "obstacle",
    name: "Green bin spill",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-green-bin-spill-wade-through",
          effects: [{ debuff: "muddy", kind: "debuff" }],
          id: "wadeThrough",
          name: "Wade through",
        },
        {
          art: "card-green-bin-spill-pay",
          effects: [{ amount: "greenBinSpillCleanUp", change: "lose", kind: "money" }],
          id: "pay",
          name: "Pay for cleanup",
        },
        {
          art: "card-green-bin-spill-hurry-past",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "hurryPast",
          name: "Hurry past",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["kensingtonMarket"],
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
          id: "sniff",
          name: "Let them sniff",
        },
        {
          art: "card-other-dog-pull-away",
          effects: [{ debuff: "zoomies", kind: "debuff" }],
          id: "pullAway",
          name: "Pull away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  porchCat: {
    hitLabel: "STANDOFF!",
    hitWord: "HISS!",
    kind: "obstacle",
    name: "Porch cat",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-porch-cat-stand",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "lead" } }],
          id: "stand",
          name: "Stand your ground",
        },
        {
          art: "card-porch-cat-treat",
          effects: [{ amount: "porchCatTreat", change: "lose", kind: "money" }],
          id: "treat",
          name: "Treat bribe",
        },
        {
          art: "card-porch-cat-bolt",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "bolt",
          name: "Bolt past",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    zones: ["cabbagetown"],
  },
  pothole: {
    kind: "obstacle",
    name: "Pothole",
    resolution: {
      effects: [{ debuff: "muddy", kind: "debuff" }],
      immuneText: "potholes don't make the pack Muddy",
      kind: "contact",
    },
    shape: { lanes: 2, rows: 1 },
    zones: ["kensingtonMarket", "distilleryDistrict", "yongeStreet"],
  },
  puddle: {
    kind: "obstacle",
    name: "Puddle",
    resolution: {
      effects: [{ debuff: "muddy", kind: "debuff" }],
      immuneText: "puddles don't make the pack Muddy",
      kind: "contact",
    },
    shape: { lanes: 2, rows: 1 },
    zones: ["cabbagetown", "highPark", "theBeaches"],
  },
  skunk: {
    hitLabel: "SPRAYED!",
    hitWord: "PHEW!",
    kind: "obstacle",
    movement: { kind: "approach", steps: { max: 6, min: 3 } },
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
          id: "grooming",
          name: "Full groom",
        },
        {
          art: "card-skunk-rinse",
          effects: [{ debuff: "stinky", kind: "debuff" }],
          id: "rinse",
          name: "Quick rinse",
        },
        {
          art: "card-skunk-ignore",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "ignore",
          name: "Hold your nose",
        },
      ],
    },
    shape: { lanes: 2, rows: 2 },
  },
  squirrel: {
    kind: "obstacle",
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0 },
    name: "Squirrel",
    resolution: { kind: "pull" },
    shape: { lanes: 1, rows: 1 },
  },
  thief: {
    hitLabel: "THIEF!",
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
          id: "letGo",
          name: "Let the tips go",
        },
        {
          art: "card-thief-grab-back",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "grabBack",
          name: "Grab it back",
        },
        {
          art: "card-thief-give-chase",
          effects: [{ debuff: "zoomies", kind: "debuff" }],
          id: "giveChase",
          name: "Dogs give chase",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  weddingPhotoShoot: {
    hitLabel: "SAY CHEESE!",
    hitWord: "CLICK!",
    kind: "obstacle",
    name: "Wedding photo shoot",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-wedding-photo-shoot-pose",
          effects: [{ debuff: "spotlight", kind: "debuff" }],
          id: "pose",
          name: "Pose",
        },
        {
          art: "card-wedding-photo-shoot-walk-around",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          id: "walkAround",
          name: "Walk around",
        },
        {
          art: "card-wedding-photo-shoot-reshoot",
          effects: [{ amount: "weddingApology", change: "lose", kind: "money" }],
          id: "reshoot",
          name: "Pay for a reshoot",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
    zones: ["theBeaches", "distilleryDistrict"],
  },
} as const satisfies Record<EncounterId, Encounter>;
