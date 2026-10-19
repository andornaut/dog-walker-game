import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import { TEST_TUNING } from "../testing/tuning";
import type { Purchase } from "./home";
import {
  bubbleSpeech,
  type HomeAction,
  HOW_TO_WALKS,
  messageLine,
  packCountLine,
  slotSignLines,
  walkerLineKey,
} from "./homeLines";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;
const dollars = (amount: number) => cents(amount * 100);
const firing = { dog: "koda", zone: 2 } as const;

describe("walkerLineKey", () => {
  const later = HOW_TO_WALKS + 1;

  it("greets a player who has never walked, whatever else holds", () => {
    expect(walkerLineKey(null, true, 0)).toBe("firstVisit");
  });

  it("puts a firing on the last walk ahead of something new to buy", () => {
    expect(walkerLineKey({ firings: [firing] }, true, 1)).toBe("afterFiring");
  });

  it("puts something new to buy ahead of the welcome back and the how-to", () => {
    expect(walkerLineKey({ firings: [] }, true, 1)).toBe("newAffordable");
    expect(walkerLineKey({ firings: [] }, false, later)).toBe("afterWalk");
  });

  it("says how to use the screen after each of the first walks, then welcomes back", () => {
    expect(walkerLineKey({ firings: [] }, false, 1)).toBe("howTo");
    expect(walkerLineKey({ firings: [] }, false, HOW_TO_WALKS)).toBe("howTo");
    expect(walkerLineKey({ firings: [] }, false, later)).toBe("afterWalk");
    expect(walkerLineKey({ firings: [firing] }, false, 1)).toBe("afterFiring");
  });
});

describe("slotSignLines", () => {
  it("names the next slot and price, and how much more to save", () => {
    expect(slotSignLines(data, { dogSlots: 1 }, dollars(150))).toEqual({
      short: true,
      sign: "Slot 2 · $800",
      status: "Save $650 more",
    });
  });

  it("says tap to buy once the bank covers it", () => {
    expect(slotSignLines(data, { dogSlots: 2 }, dollars(1800))).toEqual({
      short: false,
      sign: "Slot 3 · $1,800",
      status: "Tap to buy",
    });
  });

  it("is gone once every slot is owned", () => {
    expect(slotSignLines(data, { dogSlots: 3 }, dollars(0))).toBeNull();
  });
});

describe("packCountLine", () => {
  it("reads the pack against its capacity", () => {
    expect(packCountLine(data, { dogSlots: 2 }, { dogs: ["koda"], gear: null })).toBe("Pack 1/2");
  });
});

describe("messageLine", () => {
  it("says a focused item in words, and nothing after an action that leaves no message", () => {
    const focused: HomeAction = { kind: "focus", text: "Koda: big chaser." };
    expect(messageLine(text, focused)).toBe("Koda: big chaser.");
    expect(messageLine(text, { kind: "none" })).toBeNull();
  });

  it("announces a bought dog, gear item or slot, and how much more an unaffordable item needs", () => {
    const bought = (purchase: Purchase, name: string): HomeAction => ({
      kind: "bought",
      name,
      purchase,
    });
    const lines = { ...text, gearBought: "Got {gear}.", slotBought: "{slot} open." };
    expect(messageLine(text, bought({ dog: "nugget", kind: "dog" }, "Nugget"))).toBe(
      "Nugget joins your clients!",
    );
    expect(messageLine(lines, bought({ gear: "whistle", kind: "gear" }, "Whistle"))).toBe(
      "Got Whistle.",
    );
    expect(messageLine(lines, bought({ kind: "dogSlot" }, "Dog slot 2"))).toBe("Dog slot 2 open.");
    expect(messageLine(text, { amount: dollars(480), kind: "cantAfford", name: "Nugget" })).toBe(
      "Save $480 more for Nugget.",
    );
  });
});

describe("bubbleSpeech", () => {
  const quips = new Map([
    ["koda", "Jesse: He already did 10K."],
    ["biscuit", "Sam: Snacks are in the left pocket."],
  ] as const);
  const none: HomeAction = { kind: "none" };

  it("lets the owner of the latest pick still in the pack speak", () => {
    const state = { action: none, loadout: { dogs: ["koda", "biscuit"] as const, gear: null } };
    expect(bubbleSpeech(text, "afterWalk", state, quips)).toEqual([
      "Sam: Snacks are in the left pocket.",
    ]);
  });

  it("returns to the walker's line once the speakers leave the pack", () => {
    const state = { action: none, loadout: { dogs: [], gear: null } };
    expect(bubbleSpeech(text, "howTo", state, quips)).toEqual([text.bubble.howTo]);
  });

  it("announces a just-bought dog, then lets its owner speak though the dog is not picked", () => {
    const nugget = new Map([["nugget", "Ava: Tag me in everything."]] as const);
    const action: HomeAction = {
      kind: "bought",
      name: "Nugget",
      purchase: { dog: "nugget", kind: "dog" },
    };
    expect(
      bubbleSpeech(text, "firstVisit", { action, loadout: { dogs: [], gear: null } }, nugget),
    ).toEqual(["Nugget joins your clients!", "Ava: Tag me in everything."]);
  });

  it("puts the last action's message ahead of a picked dog's owner", () => {
    const action: HomeAction = { amount: dollars(480), kind: "cantAfford", name: "Nugget" };
    const state = { action, loadout: { dogs: ["koda"] as const, gear: null } };
    expect(bubbleSpeech(text, "afterWalk", state, quips)).toEqual(["Save $480 more for Nugget."]);
  });
});
