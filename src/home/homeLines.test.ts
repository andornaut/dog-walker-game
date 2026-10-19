import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import { TEST_TUNING } from "../testing/tuning";
import {
  bubbleLine,
  type HomeAction,
  messageLine,
  packCountLine,
  slotSignLines,
  startWalkLine,
  stepHeading,
  walkerLineKey,
} from "./homeLines";

const data = { ...gameData, tuning: TEST_TUNING };
const text = data.homeText;
const dollars = (amount: number) => cents(amount * 100);
const firing = { dog: "koda", zone: 2 } as const;

describe("walkerLineKey", () => {
  it("greets a player who has never walked, whatever else holds", () => {
    expect(walkerLineKey(null, true)).toBe("firstVisit");
  });

  it("puts a firing on the last walk ahead of something new to buy", () => {
    expect(walkerLineKey({ firings: [firing] }, true)).toBe("afterFiring");
  });

  it("puts something new to buy ahead of the plain welcome back", () => {
    expect(walkerLineKey({ firings: [] }, true)).toBe("newAffordable");
    expect(walkerLineKey({ firings: [] }, false)).toBe("afterWalk");
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

describe("stepHeading", () => {
  it("drops the leading number, which the badge shows, and splits off a note", () => {
    expect(stepHeading("1 Walker")).toEqual({ label: "Walker", note: "" });
    expect(stepHeading("3 Gear (optional)")).toEqual({ label: "Gear", note: "(optional)" });
  });

  it("keeps a heading with no number whole", () => {
    expect(stepHeading("Pick your dogs")).toEqual({ label: "Pick your dogs", note: "" });
  });
});

describe("the start button and pack count", () => {
  it("counts one dog, then several", () => {
    expect(startWalkLine(data, { dogs: ["koda"], gear: null })).toMatch(
      /^Start walk · 1 dog · \$\d+\/zone$/,
    );
    expect(startWalkLine(data, { dogs: ["koda", "biscuit"], gear: null })).toMatch(
      /^Start walk · 2 dogs · \$\d+\/zone$/,
    );
  });

  it("reads the pack against its capacity", () => {
    expect(packCountLine(data, { dogSlots: 2 }, { dogs: ["koda"], gear: null })).toBe("Pack 1/2");
  });
});

describe("messageLine", () => {
  it("shows the hint after an action that only changes the loadout, such as dropping a dog", () => {
    const focused: HomeAction = { kind: "focus", text: "Koda: big chaser." };
    expect(messageLine(text, focused)).toBe("Koda: big chaser.");
    expect(messageLine(text, { kind: "loadout" })).toBe(text.hint);
    expect(messageLine(text, { kind: "none" })).toBe(text.hint);
  });

  it("announces a bought dog, and how much more an unaffordable item needs", () => {
    expect(messageLine(text, { dog: "nugget", kind: "bought", name: "Nugget" })).toBe(
      "Nugget joins your clients!",
    );
    expect(messageLine(text, { amount: dollars(480), kind: "cantAfford", name: "Nugget" })).toBe(
      "Save $480 more for Nugget.",
    );
  });
});

describe("bubbleLine", () => {
  const quips = new Map([
    ["koda", "Jesse: He already did 10K."],
    ["biscuit", "Sam: Snacks are in the left pocket."],
  ] as const);

  it("lets the owner of the latest pick still in the pack speak", () => {
    const state = {
      action: { kind: "loadout" } as const,
      loadout: { dogs: ["koda", "biscuit"] as const, gear: null },
    };
    expect(bubbleLine(text, "afterWalk", state, quips)).toBe("Sam: Snacks are in the left pocket.");
  });

  it("returns to the walker's line once the speakers leave the pack", () => {
    const state = { action: { kind: "loadout" } as const, loadout: { dogs: [], gear: null } };
    expect(bubbleLine(text, "afterWalk", state, quips)).toBe(text.bubble.afterWalk);
  });

  it("lets a just-bought dog's owner speak though the dog is not picked", () => {
    const nugget = new Map([["nugget", "Ava: Tag me in everything."]] as const);
    const action: HomeAction = { dog: "nugget", kind: "bought", name: "Nugget" };
    expect(
      bubbleLine(text, "firstVisit", { action, loadout: { dogs: [], gear: null } }, nugget),
    ).toBe("Ava: Tag me in everything.");
  });
});
