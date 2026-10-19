import type { ForcedStop } from "./types";

// One per zone, drawn at random with no repeats in a run. Options show left to right.
export const FORCED_STOPS = {
  chattyNeighbour: {
    name: "Chatty neighbour",
    options: [
      {
        effects: [
          { amount: "chattyNeighbourTip", change: "gain", kind: "money" },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
        ],
        name: "Chat",
      },
      { effects: [], name: "Politely move on" },
    ],
  },
  constructionDetour: {
    name: "Construction detour",
    options: [
      {
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
        name: "Take the long way",
      },
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "trait", trait: "fancy" } }],
        name: "Squeeze past",
      },
    ],
  },
  iceCreamTruck: {
    name: "Ice cream truck",
    options: [
      {
        effects: [
          { amount: "encounterLow", change: "lose", kind: "money", perDog: { kind: "all" } },
          { amount: 1, kind: "hearts", target: { kind: "all" } },
        ],
        name: "Buy pup cups",
      },
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "trait", trait: "foodDriven" } }],
        name: "Walk past",
      },
    ],
  },
  kidWantsToPet: {
    name: "Kid wants to pet them",
    options: [
      {
        effects: [
          { amount: 1, kind: "hearts", target: { kind: "all" } },
          { amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } },
        ],
        name: "Let them pet",
      },
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "randomOne" } }],
        name: "Politely decline",
      },
    ],
  },
  mailCarrier: {
    name: "Mail carrier",
    options: [
      {
        effects: [{ amount: -1, kind: "hearts", target: { kind: "all" } }],
        name: "Hold them back",
      },
      {
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
        name: "Wait it out",
      },
    ],
  },
  stopSign: {
    name: "Stop sign",
    options: [
      {
        effects: [{ amount: "missedTips", change: "lose", kind: "money", perDog: { kind: "all" } }],
        name: "Wait patiently",
      },
      { effects: [{ amount: -1, kind: "hearts", target: { kind: "all" } }], name: "Dart across" },
    ],
  },
} as const satisfies Record<string, ForcedStop>;
