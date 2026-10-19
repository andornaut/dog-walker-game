import type { Need, NeedCard, NeedId, NeedSpot } from "./types";

// Each dog's need: met at a matching spot on the road, and urgent once it has filled for the
// dog's energy's share of seconds.needUrgentByEnergy.
export const NEEDS = {
  friendly: {
    goneWrong: {
      effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
      kind: "effects",
    },
    met: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
    name: "Friendly",
    payoff: "strangerLoves",
  },
  nosy: {
    goneWrong: {
      effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
      kind: "effects",
    },
    met: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
    name: "Nosy",
    payoff: "peeMail",
  },
  playful: {
    goneWrong: {
      effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
      kind: "effects",
    },
    met: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
    name: "Playful",
    payoff: "playDate",
  },
  regular: {
    goneWrong: { card: "accident", kind: "card" },
    met: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
    name: "Regular",
    payoff: "goodSpot",
  },
  thirsty: {
    goneWrong: {
      effects: [{ amount: -1, kind: "hearts", target: { kind: "affected" } }],
      kind: "effects",
    },
    met: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
    name: "Thirsty",
    payoff: "waterStop",
  },
} as const satisfies Record<NeedId, Need>;

// The road spots that meet each need. Each zone's weights in world.ts set how often each
// appears there.
export const NEED_SPOTS = {
  fireHydrant: { name: "Hydrant", need: "regular" },
  lampPost: { name: "Lamp post", need: "nosy" },
  playmate: { name: "Another dog", need: "playful" },
  stranger: { name: "A stranger waving", need: "friendly" },
  tree: { name: "Tree", need: "regular" },
  waterBowl: { name: "Water bowl", need: "thirsty" },
} as const satisfies Record<string, NeedSpot>;

// Placeholder cards, seeded from the rulebook's examples, for gameplay to write.
export const NEED_CARDS = {
  accident: {
    kind: "trouble",
    name: "Accident!",
    options: [
      {
        art: "card-accident-bag",
        effects: [{ amount: "accidentCleanUp", change: "lose", kind: "money" }],
        name: "Clean up with a bag",
      },
      {
        art: "card-accident-walk-on",
        cause: "grumpy neighbour",
        effects: [{ amount: -2, kind: "hearts", target: { kind: "affected" } }],
        name: "Walk on",
      },
    ],
  },
  goodSpot: {
    kind: "payoff",
    name: "The perfect spot",
    options: [
      {
        art: "card-good-spot-take-time",
        effects: [
          { amount: 2, kind: "hearts", target: { kind: "affected" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "Take your time",
      },
      { art: "card-good-spot-keep-walking", effects: [], name: "Keep walking" },
    ],
  },
  peeMail: {
    kind: "payoff",
    name: "Pee-mail for {dog}",
    options: [
      {
        art: "card-pee-mail-sniff",
        effects: [
          { amount: 2, kind: "hearts", target: { kind: "affected" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "Read it all",
      },
      { art: "card-pee-mail-keep-walking", effects: [], name: "Keep walking" },
    ],
  },
  playDate: {
    kind: "payoff",
    name: "Play date!",
    options: [
      {
        art: "card-play-date-play",
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "all" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
        ],
        name: "Let them play",
      },
      {
        art: "card-play-date-sniff",
        effects: [{ amount: 1, kind: "hearts", target: { kind: "need", need: "playful" } }],
        name: "Just a sniff",
      },
    ],
  },
  strangerLoves: {
    kind: "payoff",
    name: "A stranger loves {dog}",
    options: [
      {
        art: "card-stranger-loves-fuss",
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "affected" } },
          { amount: "strangerTip", change: "gain", kind: "money" },
        ],
        name: "Let them fuss",
      },
      { art: "card-stranger-loves-keep-walking", effects: [], name: "Keep walking" },
    ],
  },
  waterStop: {
    kind: "payoff",
    name: "Water stop",
    options: [
      {
        art: "card-water-stop-drink",
        effects: [
          { amount: 2, kind: "hearts", target: { kind: "affected" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "affected" } },
        ],
        name: "A long drink",
      },
      {
        art: "card-water-stop-sip",
        effects: [{ amount: 1, kind: "hearts", target: { kind: "affected" } }],
        name: "Just a sip",
      },
    ],
  },
} as const satisfies Record<string, NeedCard>;
