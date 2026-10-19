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
  cafe: {
    affects: { kind: "all" },
    hitLabel: "SPILLED LATTE!",
    kind: "obstacle",
    name: "Cafe patio",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-cafe-charm",
          effects: [
            { kind: "fulfilNeed", need: "friendly" },
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Charm the crowd",
        },
        {
          art: "card-cafe-buy-lattes",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
            { amount: 1, kind: "hearts", target: { kind: "temperament", temperament: "fussy" } },
          ],
          name: "Buy new lattes",
        },
        {
          art: "card-cafe-slink-away",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Slink away",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
  // Always a mover: it waddles across the road, and a big dog does not scare it off.
  goose: {
    affects: { kind: "all" },
    hitLabel: "HONK!",
    kind: "obstacle",
    name: "Angry goose",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-goose-back-off",
          effects: [
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Back off slowly",
        },
        {
          art: "card-goose-honk-back",
          effects: [
            {
              amount: -1,
              kind: "hearts",
              target: { kind: "affected" },
              traitAmounts: { chaser: -2 },
            },
          ],
          name: "Honk back",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
  },
  lemonade: {
    affects: { kind: "all" },
    hitLabel: "LEMONADE!",
    kind: "lucky",
    name: "Lemonade stand",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-lemonade-water",
          effects: [
            { kind: "fulfilNeed", need: "thirsty" },
            { amount: "lemonadeCup", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Water, please",
        },
        {
          art: "card-lemonade-say-hi",
          effects: [
            { kind: "fulfilNeed", need: "friendly" },
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Say hi",
        },
        { art: "card-lemonade-maybe-later", effects: [], name: "Maybe later" },
      ],
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
            {
              amount: 1,
              kind: "hearts",
              quirkAmounts: { nervous: -1 },
              target: { kind: "affected" },
            },
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
            { kind: "fulfilNeed", need: "playful" },
          ],
          name: "Let them sniff",
        },
        {
          art: "card-other-dog-pull-away",
          effects: [{ debuff: "tangled", kind: "debuff" }],
          name: "Pull away",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    skins: {
      park: {
        art: "social-frisbee-dog",
        cardArtPrefix: "card-social-frisbee-dog",
        hitLabel: "CATCH!",
        name: "Frisbee dog",
      },
      pawsPromenade: {
        art: "social-jogger-dog",
        cardArtPrefix: "card-social-jogger-dog",
        hitLabel: "NEW FRIEND!",
        name: "Jogger's dog",
      },
      shops: {
        art: "social-handbag-dog",
        cardArtPrefix: "card-social-handbag-dog",
        hitLabel: "YIP YIP!",
        name: "Dog in a handbag",
      },
      snoozeCrescent: {
        art: "social-gate-dog",
        cardArtPrefix: "card-social-gate-dog",
        hitLabel: "NEW FRIEND!",
        name: "Dog at a gate",
      },
    },
  },
  petunias: {
    affects: { kind: "all" },
    hitLabel: "OOPS, PETUNIAS!",
    kind: "obstacle",
    name: "Prize petunias",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-petunias-replant",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Replant them",
        },
        {
          art: "card-petunias-nature-calls",
          effects: [
            { kind: "fulfilNeed", need: "regular" },
            { amount: -1, kind: "hearts", target: { kind: "affected" } },
          ],
          name: "Nature calls",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
  photoOp: {
    affects: { kind: "all" },
    kind: "lucky",
    name: "Photo op",
    resolution: {
      art: "card-photo-op-pose",
      effects: [
        {
          amount: "photoOpTip",
          change: "gain",
          kind: "money",
          quirkMultipliers: { cameraReady: "cameraReadyTip" },
        },
        { amount: 1, kind: "hearts", target: { kind: "temperament", temperament: "dramatic" } },
      ],
      kind: "instant",
    },
  },
  picnic: {
    affects: { kind: "trait", trait: "foodDriven" },
    hitLabel: "SNACK ATTACK!",
    kind: "obstacle",
    messy: true,
    name: "Picnic raid",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-picnic-buy-lunch",
          effects: [
            { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Buy a new lunch",
        },
        {
          art: "card-picnic-drop-it",
          effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
          name: "Drop it!",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
  puddle: {
    affects: { catches: ["big", "medium"], kind: "caught" },
    hitLabel: "SOAKED!",
    kind: "obstacle",
    messy: true,
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
    skins: {
      park: {
        art: "splash-mud",
        cardArtPrefix: "card-splash-mud",
        hitLabel: "MUDDY!",
        name: "Mud patch",
        statusArt: "fx-status-soaked-mud",
      },
      pawsPromenade: {
        art: "splash-shore",
        cardArtPrefix: "card-splash-shore",
        hitLabel: "SOAKED!",
        name: "Splashy shore",
      },
      shops: {
        art: "splash-milkshake",
        cardArtPrefix: "card-splash-milkshake",
        hitLabel: "STICKY!",
        name: "Spilled milkshake",
        statusArt: "fx-status-soaked-milkshake",
      },
      snoozeCrescent: {
        art: "splash-sprinkler",
        cardArtPrefix: "card-splash-sprinkler",
        hitLabel: "SPRINKLED!",
        name: "Lawn sprinkler",
      },
    },
  },
  skunk: {
    affects: { catches: ["big", "medium", "small"], kind: "caught" },
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
    skins: {
      homeStretch: {
        art: "stink-garbage-truck",
        cardArtPrefix: "card-stink-garbage-truck",
        hitLabel: "PEE-YEW!",
        name: "Garbage truck",
      },
      pawsPromenade: {
        art: "stink-seaweed",
        cardArtPrefix: "card-stink-seaweed",
        hitLabel: "PEE-YEW!",
        name: "Seaweed heap",
      },
      shops: {
        art: "stink-fish-crate",
        cardArtPrefix: "card-stink-fish-crate",
        cloudArt: "stink-fish-crate-cloud",
        hitLabel: "FISHY!",
        name: "Fish crate",
      },
      snoozeCrescent: {
        art: "stink-compost",
        cardArtPrefix: "card-stink-compost",
        hitLabel: "PEE-YEW!",
        name: "Compost heap",
      },
    },
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
          chase: true,
          effects: [
            {
              amount: "squirrelChase",
              change: "lose",
              kind: "money",
              quirkMultipliers: { ratter: "ratterChaseTips" },
            },
          ],
          name: "Let them chase",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    skins: {
      homeStretch: {
        art: "chase-rabbit",
        cardArtPrefix: "card-chase-rabbit",
        hitLabel: "BOING!",
        name: "Rabbit",
      },
      pawsPromenade: {
        art: "chase-ducklings",
        cardArtPrefix: "card-chase-ducklings",
        hitLabel: "QUACK!",
        name: "Ducklings",
      },
      shops: {
        art: "chase-pigeons",
        cardArtPrefix: "card-chase-pigeons",
        hitLabel: "COO COO!",
        name: "Pigeon flock",
      },
      snoozeCrescent: {
        art: "chase-cat",
        cardArtPrefix: "card-chase-cat",
        hitLabel: "HISS!",
        name: "Cat on a lawn",
      },
    },
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
        {
          art: "card-thief-let-them-run",
          effects: [{ debuff: "spooked", kind: "debuff" }],
          name: "Let them run",
        },
      ],
    },
    shape: { lanes: 1, rows: 1 },
    skins: {
      homeStretch: {
        art: "snatch-raccoon",
        cardArtPrefix: "card-snatch-raccoon",
        hitLabel: "SNATCHED!",
        name: "Raccoon",
      },
      park: {
        art: "snatch-seagull",
        cardArtPrefix: "card-snatch-seagull",
        hitLabel: "SNATCHED!",
        name: "Seagull",
      },
      pawsPromenade: {
        art: "snatch-seagull",
        cardArtPrefix: "card-snatch-seagull",
        hitLabel: "SNATCHED!",
        name: "Seagull",
      },
      snoozeCrescent: {
        art: "snatch-raccoon",
        cardArtPrefix: "card-snatch-raccoon",
        hitLabel: "SNATCHED!",
        name: "Raccoon",
      },
    },
  },
  trash: {
    affects: { kind: "all" },
    hitLabel: "TRASH DAY!",
    kind: "obstacle",
    messy: true,
    name: "Trash day",
    resolution: {
      kind: "card",
      options: [
        {
          art: "card-trash-sniff",
          effects: [
            { kind: "fulfilNeed", need: "nosy" },
            { amount: -1, kind: "hearts", target: { kind: "trait", trait: "fancy" } },
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
          ],
          name: "Sniff it all",
        },
        {
          art: "card-trash-tidy-up",
          effects: [
            { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
            { amount: 1, kind: "hearts", target: { kind: "temperament", temperament: "fussy" } },
          ],
          name: "Tidy up",
        },
        {
          art: "card-trash-drag-on",
          effects: [
            {
              amount: -1,
              kind: "hearts",
              target: { kind: "affected" },
              traitAmounts: { foodDriven: -2 },
            },
          ],
          name: "Drag them on",
        },
      ],
    },
    shape: { lanes: 2, rows: 1 },
  },
} as const satisfies Record<EncounterId, Encounter>;
