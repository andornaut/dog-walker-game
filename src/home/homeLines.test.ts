import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, LiveTuning, WalkerId } from "../data/types";
import { fillNames } from "../lib/lines";
import { cents } from "../lib/units";
import type { StorageState } from "../save/profile";
import type { LastWalk } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import type { HomeLoadout } from "./home";
import {
  bubbleSpeech,
  type HomeAction,
  HOW_TO_WALKS,
  messageLine,
  packBonusLine,
  storageNotice,
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
const firing = { dog: "kilo", zone: 2 } as const;

describe("walkerLineKey", () => {
  const later = HOW_TO_WALKS + 1;
  const fired = { firings: [firing] };
  const kept = { firings: [] };
  const both = { affordable: true, walker: true };
  const affordable = { affordable: true, walker: false };
  const none = { affordable: false, walker: false };

  it("orders a first visit, a new walker, a firing, something new, installing and the how-to", () => {
    const cases: readonly [
      string,
      Pick<LastWalk, "firings"> | null,
      VisitNews,
      boolean,
      number,
      WalkerLine,
    ][] = [
      [
        "greets a player who has never walked, whatever else holds",
        null,
        both,
        true,
        0,
        "firstVisit",
      ],
      ["puts a new walker ahead of a firing", fired, both, true, 1, "newWalker"],
      ["puts a firing ahead of something new to buy", fired, affordable, true, 1, "afterFiring"],
      ["puts a firing ahead of the how-to", fired, none, false, 1, "afterFiring"],
      [
        "puts something new to buy ahead of the install suggestion",
        kept,
        affordable,
        true,
        1,
        "newAffordable",
      ],
      ["suggests installing in place of the how-to", kept, none, true, 1, "install"],
      ["suggests installing in place of the welcome back", kept, none, true, later, "install"],
      ["says how to use the screen after the first walk", kept, none, false, 1, "howTo"],
      [
        "says how to use the screen up to the last how-to walk",
        kept,
        none,
        false,
        HOW_TO_WALKS,
        "howTo",
      ],
      ["welcomes back after the how-to walks", kept, none, false, later, "afterWalk"],
    ];
    for (const [, lastWalk, news, suggestInstall, walks, expected] of cases) {
      expect(walkerLineKey(lastWalk, news, suggestInstall, walks)).toBe(expected);
    }
  });
});

describe("walkerUnlockedSince", () => {
  it("finds a walker owned now and not at the last visit, and none with no last visit", () => {
    const cases: readonly [string, WalkerId[] | undefined, WalkerId[], boolean][] = [
      ["finds a walker owned now and not at the last visit", ["casey"], ["casey", "mrB"], true],
      ["finds none when the walkers are unchanged", ["casey", "mrB"], ["casey", "mrB"], false],
      ["finds none with no last visit to compare with", undefined, ["casey", "mrB"], false],
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
        { kind: "focus", text: "Kilo: big chaser." },
        "Kilo: big chaser.",
      ],
      ["says nothing after an action that leaves no message", { kind: "none" }, null],
      [
        "announces a bought dog",
        { kind: "bought", name: "Reggie", purchase: { dog: "reggie", kind: "dog" } },
        "Reggie joined.",
      ],
      [
        "announces bought gear",
        { kind: "bought", name: "Lucky collar", purchase: { gear: "luckyCollar", kind: "gear" } },
        "Got Lucky collar.",
      ],
      [
        "announces a bought slot",
        { kind: "bought", name: "Dog slot 2", purchase: { kind: "dogSlot", slot: 2 } },
        "Dog slot 2 open.",
      ],
      [
        "says how much more an unaffordable item needs",
        { amount: dollars(480), kind: "cantAfford", name: "Reggie" },
        "$480 short for Reggie.",
      ],
    ];
    for (const [, action, expected] of cases) {
      expect(messageLine(text, action)).toBe(expected);
    }
  });
});

describe("bubbleSpeech", () => {
  const quips = new Map<DogId, string>([
    ["kilo", "He already did 10K."],
    ["biscuit", "Snacks are in the left pocket."],
    ["reggie", "Tag me in everything."],
  ]);
  const none: HomeAction = { kind: "none" };

  it("puts the last message first, then the owner of the latest pick, else the walker", () => {
    const cases: readonly {
      action: HomeAction;
      dogs: HomeLoadout["dogs"];
      expected: { owner: DogId | null; paragraphs: string[] };
      line: WalkerLine;
      name: string;
    }[] = [
      {
        action: none,
        dogs: ["kilo", "biscuit"],
        expected: { owner: "biscuit", paragraphs: ["Snacks are in the left pocket."] },
        line: "afterWalk",
        name: "lets the owner of the latest pick still in the pack speak",
      },
      {
        action: none,
        dogs: [],
        expected: { owner: null, paragraphs: [text.bubble.howTo] },
        line: "howTo",
        name: "returns to the walker's line once the speakers leave the pack",
      },
      {
        action: { kind: "bought", name: "Reggie", purchase: { dog: "reggie", kind: "dog" } },
        dogs: [],
        expected: { owner: "reggie", paragraphs: ["Reggie joined.", "Tag me in everything."] },
        line: "firstVisit",
        name: "announces a just-bought dog, then lets its owner speak though the dog is not picked",
      },
      {
        action: { amount: dollars(480), kind: "cantAfford", name: "Reggie" },
        dogs: ["kilo"],
        expected: { owner: null, paragraphs: ["$480 short for Reggie."] },
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

describe("storageNotice", () => {
  it.each<[StorageState, string[]]>([
    ["available", []],
    ["newer", [gameData.homeText.newerSave]],
    ["unavailable", [gameData.homeText.unsaved]],
  ])("says for %s storage %j", (state, expected) => {
    expect(storageNotice(gameData.homeText, state)).toEqual(expected);
  });
});

describe("packBonusLine", () => {
  const { hearts } = TEST_TUNING;
  // The pinned tuning with the owner cap at a large dog's own max, so no large dog's max can rise.
  const capped: LiveTuning = {
    ...TEST_TUNING,
    hearts: { ...hearts, maxOwnerHearts: hearts.maxBySize.large },
  };
  const line = (raise: number) =>
    raise > 0 ? fillNames(data.homeText.packBonus, { hearts: String(raise) }) : null;
  // Kilo is large, so leads any pack it is in.
  it.each<[string, LiveTuning, readonly DogId[], string | null]>([
    ["no dog picked", TEST_TUNING, [], null],
    ["a lone dog", TEST_TUNING, ["kilo"], line(hearts.packSizeBonus[1])],
    ["a pair", TEST_TUNING, ["duchess", "kilo"], line(hearts.packSizeBonus[2])],
    ["a full pack", TEST_TUNING, ["kilo", "duchess", "pierre"], line(hearts.packSizeBonus[3])],
    ["a lead already at the cap", capped, ["duchess", "kilo"], null],
  ])("shows how far the lead's owner's max rises for %s", (_name, tuning, dogs, expected) => {
    expect(packBonusLine({ ...data, tuning }, { dogs, gear: null })).toBe(expected);
  });
});
