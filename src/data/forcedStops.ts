import type { ForcedStop } from "./types";

// One per zone, drawn at random with no repeats in a run. Options show left to right.
export const FORCED_STOPS = {
  chattyNeighbour: {
    name: "Chatty neighbour",
    options: [
      {
        art: "card-chatty-neighbour-chat",
        effects: [
          { amount: "chattyNeighbourTip", change: "gain", kind: "money" },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
        ],
        name: "Have a chat",
      },
      { art: "card-chatty-neighbour-move-on", effects: [], name: "Wave and go" },
    ],
  },
  constructionDetour: {
    name: "Construction detour",
    options: [
      {
        art: "card-construction-detour-long-way",
        effects: [
          { amount: "longWayMissedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
          { debuff: "tuckeredOut", kind: "debuff" },
        ],
        name: "Take the long way",
      },
      {
        art: "card-construction-detour-squeeze",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "trait", trait: "fancy" } }],
        name: "Squeeze past",
      },
    ],
  },
  iceCreamTruck: {
    name: "Ice cream truck",
    options: [
      {
        art: "card-ice-cream-truck-pup-cups",
        effects: [
          { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "all" } },
          { amount: 1, kind: "hearts", target: { kind: "all" } },
        ],
        name: "Pup cups!",
      },
      {
        art: "card-ice-cream-truck-walk-past",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "trait", trait: "foodDriven" } }],
        name: "Not today",
      },
    ],
  },
  kidWantsToPet: {
    name: "Can I pet them?",
    options: [
      {
        art: "card-kid-wants-to-pet-pet",
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "all" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
          { kind: "fulfilNeed", need: "friendly" },
        ],
        name: "Of course!",
      },
      {
        art: "card-kid-wants-to-pet-decline",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "randomOne" } }],
        name: "Sorry, not now",
      },
    ],
  },
  mailCarrier: {
    name: "Mail carrier",
    options: [
      {
        art: "card-mail-carrier-hold",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "all" } }],
        name: "Hold them back",
      },
      {
        art: "card-mail-carrier-wait",
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
        name: "Wait it out",
      },
    ],
  },
  stopSign: {
    name: "Stop sign",
    options: [
      {
        art: "card-stop-sign-wait",
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
        name: "Wait your turn",
      },
      {
        art: "card-stop-sign-dart",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "all" } }],
        name: "Dart across",
      },
    ],
  },
} as const satisfies Record<string, ForcedStop>;
