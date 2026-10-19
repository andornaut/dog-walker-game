import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { cents } from "../rules/units";
import type { LastWalk } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import type { HomeLoadout } from "./home";
import {
  bubbleSpeech,
  type HomeAction,
  HOW_TO_WALKS,
  messageLine,
  packCountLine,
  slotSignLines,
  type WalkerLine,
  walkerLineKey,
} from "./homeLines";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;
const dollars = (amount: number) => cents(amount * 100);
const firing = { dog: "koda", zone: 2 } as const;

describe("walkerLineKey", () => {
  const later = HOW_TO_WALKS + 1;
  const fired = { firings: [firing] };
  const kept = { firings: [] };

  it.each<[string, Pick<LastWalk, "firings"> | null, boolean, number, WalkerLine]>([
    ["greets a player who has never walked, whatever else holds", null, true, 0, "firstVisit"],
    ["puts a firing ahead of something new to buy", fired, true, 1, "afterFiring"],
    ["puts a firing ahead of the how-to", fired, false, 1, "afterFiring"],
    ["puts something new to buy ahead of the how-to", kept, true, 1, "newAffordable"],
    ["says how to use the screen after the first walk", kept, false, 1, "howTo"],
    ["says how to use the screen up to the last how-to walk", kept, false, HOW_TO_WALKS, "howTo"],
    ["welcomes back after the how-to walks", kept, false, later, "afterWalk"],
  ])("%s", (_name, lastWalk, newAffordable, walks, expected) => {
    expect(walkerLineKey(lastWalk, newAffordable, walks)).toBe(expected);
  });
});

describe("slotSignLines", () => {
  it.each([
    {
      bank: 150,
      expected: { short: true, sign: "Slot 2 · $800", status: "Save $650 more" },
      name: "names the next slot and price, and how much more to save",
      slots: 1,
    },
    {
      bank: 1800,
      expected: { short: false, sign: "Slot 3 · $1,800", status: "Tap to buy" },
      name: "says tap to buy once the bank covers it",
      slots: 2,
    },
    { bank: 0, expected: null, name: "is gone once every slot is owned", slots: 3 },
  ])("$name", ({ bank, expected, slots }) => {
    expect(slotSignLines(data, { dogSlots: slots }, dollars(bank))).toEqual(expected);
  });
});

describe("packCountLine", () => {
  it("reads the pack against its capacity", () => {
    expect(packCountLine(data, { dogSlots: 2 }, { dogs: ["koda"], gear: null })).toBe("Pack 1/2");
  });
});

describe("messageLine", () => {
  const lines = { ...text, gearBought: "Got {gear}.", slotBought: "{slot} open." };

  it.each<[string, HomeAction, string | null]>([
    [
      "says a focused item in words",
      { kind: "focus", text: "Koda: big chaser." },
      "Koda: big chaser.",
    ],
    ["says nothing after an action that leaves no message", { kind: "none" }, null],
    [
      "announces a bought dog",
      { kind: "bought", name: "Nugget", purchase: { dog: "nugget", kind: "dog" } },
      "Nugget joins your clients!",
    ],
    [
      "announces bought gear",
      { kind: "bought", name: "Whistle", purchase: { gear: "whistle", kind: "gear" } },
      "Got Whistle.",
    ],
    [
      "announces a bought slot",
      { kind: "bought", name: "Dog slot 2", purchase: { kind: "dogSlot" } },
      "Dog slot 2 open.",
    ],
    [
      "says how much more an unaffordable item needs",
      { amount: dollars(480), kind: "cantAfford", name: "Nugget" },
      "Save $480 more for Nugget.",
    ],
  ])("%s", (_name, action, expected) => {
    expect(messageLine(lines, action)).toBe(expected);
  });
});

describe("bubbleSpeech", () => {
  const quips = new Map<DogId, string>([
    ["koda", "Jesse: He already did 10K."],
    ["biscuit", "Sam: Snacks are in the left pocket."],
    ["nugget", "Ava: Tag me in everything."],
  ]);
  const none: HomeAction = { kind: "none" };

  it.each<{
    action: HomeAction;
    dogs: HomeLoadout["dogs"];
    expected: string[];
    line: WalkerLine;
    name: string;
  }>([
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
      expected: ["Nugget joins your clients!", "Ava: Tag me in everything."],
      line: "firstVisit",
      name: "announces a just-bought dog, then lets its owner speak though the dog is not picked",
    },
    {
      action: { amount: dollars(480), kind: "cantAfford", name: "Nugget" },
      dogs: ["koda"],
      expected: ["Save $480 more for Nugget."],
      line: "afterWalk",
      name: "puts the last action's message ahead of a picked dog's owner",
    },
  ])("$name", ({ action, dogs, expected, line }) => {
    expect(bubbleSpeech(text, line, { action, loadout: { dogs, gear: null } }, quips)).toEqual(
      expected,
    );
  });
});
