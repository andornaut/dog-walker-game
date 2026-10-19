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
        name: "Chat",
      },
      { art: "card-chatty-neighbour-move-on", effects: [], name: "Politely move on" },
    ],
  },
  constructionDetour: {
    name: "Construction detour",
    options: [
      {
        art: "card-construction-detour-long-way",
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
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
        name: "Buy pup cups",
      },
      {
        art: "card-ice-cream-truck-walk-past",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "trait", trait: "foodDriven" } }],
        name: "Walk past",
      },
    ],
  },
  kidWantsToPet: {
    name: "Kid wants to pet them",
    options: [
      {
        art: "card-kid-wants-to-pet-pet",
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "all" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
        ],
        name: "Let them pet",
      },
      {
        art: "card-kid-wants-to-pet-decline",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "randomOne" } }],
        name: "Politely decline",
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
        name: "Wait patiently",
      },
      {
        art: "card-stop-sign-dart",
        effects: [{ amount: -1, kind: "hearts", target: { kind: "all" } }],
        name: "Dart across",
      },
    ],
  },
} as const satisfies Record<string, ForcedStop>;
