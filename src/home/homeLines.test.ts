import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId } from "../data/types";
import { cents } from "../rules/units";
import type { LastWalk } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import type { HomeLoadout } from "./home";
import {
  bubbleSpeech,
  type HomeAction,
  HOW_TO_WALKS,
  messageLine,
  type VisitNews,
  type WalkerLine,
  walkerLineKey,
  walkerUnlockedSince,
} from "./homeLines";

const data = { ...gameData, tuning: TEST_TUNING };
// The home text, with test lines for every message these tests check.
const text = {
  ...data.homeText,
  dogBought: "{dog} joined.",
  dogCantAfford: "{amount} short for {dog}.",
  gearBought: "Got {gear}.",
  slotBought: "{slot} open.",
};
const dollars = (amount: number) => cents(amount * 100);
const firing = { dog: "koda", zone: 2 } as const;

describe("walkerLineKey", () => {
  const later = HOW_TO_WALKS + 1;
  const fired = { firings: [firing] };
  const kept = { firings: [] };
  const both = { affordable: true, walker: true };
  const affordable = { affordable: true, walker: false };
  const none = { affordable: false, walker: false };

  it("puts a first visit, a new walker, a firing, something new to buy and the how-to in that order", () => {
    const cases: readonly [
      string,
      Pick<LastWalk, "firings"> | null,
      VisitNews,
      number,
      WalkerLine,
    ][] = [
      ["greets a player who has never walked, whatever else holds", null, both, 0, "firstVisit"],
      ["puts a new walker ahead of a firing", fired, both, 1, "newWalker"],
      ["puts a firing ahead of something new to buy", fired, affordable, 1, "afterFiring"],
      ["puts a firing ahead of the how-to", fired, none, 1, "afterFiring"],
      ["puts something new to buy ahead of the how-to", kept, affordable, 1, "newAffordable"],
      ["says how to use the screen after the first walk", kept, none, 1, "howTo"],
      ["says how to use the screen up to the last how-to walk", kept, none, HOW_TO_WALKS, "howTo"],
      ["welcomes back after the how-to walks", kept, none, later, "afterWalk"],
    ];
    for (const [, lastWalk, news, walks, expected] of cases) {
      expect(walkerLineKey(lastWalk, news, walks)).toBe(expected);
    }
  });
});

describe("walkerUnlockedSince", () => {
  it("finds a walker owned now and not at the last visit, and none with no last visit", () => {
    const cases: readonly [string, WalkerId[] | undefined, WalkerId[], boolean][] = [
      ["finds a walker owned now and not at the last visit", ["casey"], ["casey", "ben"], true],
      ["finds none when the walkers are unchanged", ["casey", "ben"], ["casey", "ben"], false],
      ["finds none with no last visit to compare with", undefined, ["casey", "ben"], false],
    ];
    for (const [, remembered, owned, expected] of cases) {
      expect(walkerUnlockedSince(remembered, owned)).toBe(expected);
    }
  });
});

describe("messageLine", () => {
  it("says a focused item, a purchase or what an unaffordable item needs, and nothing after no action", () => {
    const cases: readonly [string, HomeAction, string | null][] = [
      [
        "says a focused item in words",
        { kind: "focus", text: "Koda: big chaser." },
        "Koda: big chaser.",
      ],
      ["says nothing after an action that leaves no message", { kind: "none" }, null],
      [
        "announces a bought dog",
        { kind: "bought", name: "Nugget", purchase: { dog: "nugget", kind: "dog" } },
        "Nugget joined.",
      ],
      [
        "announces bought gear",
        { kind: "bought", name: "Lucky collar", purchase: { gear: "luckyCollar", kind: "gear" } },
        "Got Lucky collar.",
      ],
      [
        "announces a bought slot",
        { kind: "bought", name: "Dog slot 2", purchase: { kind: "dogSlot" } },
        "Dog slot 2 open.",
      ],
      [
        "says how much more an unaffordable item needs",
        { amount: dollars(480), kind: "cantAfford", name: "Nugget" },
        "$480 short for Nugget.",
      ],
    ];
    for (const [, action, expected] of cases) {
      expect(messageLine(text, action)).toBe(expected);
    }
  });
});

describe("bubbleSpeech", () => {
  const quips = new Map<DogId, string>([
    ["koda", "Jesse: He already did 10K."],
    ["biscuit", "Sam: Snacks are in the left pocket."],
    ["nugget", "Ava: Tag me in everything."],
  ]);
  const none: HomeAction = { kind: "none" };

  it("puts the last message first, then the owner of the latest pick, else the walker", () => {
    const cases: readonly {
      action: HomeAction;
      dogs: HomeLoadout["dogs"];
      expected: string[];
      line: WalkerLine;
      name: string;
    }[] = [
      {
        action: none,
        dogs: ["koda", "biscuit"],
        expected: ["Sam: Snacks are in the left pocket."],
        line: "afterWalk",
        name: "lets the owner of the latest pick still in the pack speak",
      },
      {
        action: none,
        dogs: [],
        expected: [text.bubble.howTo],
        line: "howTo",
        name: "returns to the walker's line once the speakers leave the pack",
      },
      {
        action: { kind: "bought", name: "Nugget", purchase: { dog: "nugget", kind: "dog" } },
        dogs: [],
        expected: ["Nugget joined.", "Ava: Tag me in everything."],
        line: "firstVisit",
        name: "announces a just-bought dog, then lets its owner speak though the dog is not picked",
      },
      {
        action: { amount: dollars(480), kind: "cantAfford", name: "Nugget" },
        dogs: ["koda"],
        expected: ["$480 short for Nugget."],
        line: "afterWalk",
        name: "puts the last action's message ahead of a picked dog's owner",
      },
    ];
    for (const { action, dogs, expected, line } of cases) {
      expect(bubbleSpeech(text, line, { action, loadout: { dogs, gear: null } }, quips)).toEqual(
        expected,
      );
    }
  });
});
