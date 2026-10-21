import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import {
  type InteractionInput,
  type InteractionState,
  interactionState,
  type ItemTile,
  itemTile,
  type ItemTileInput,
  itemTileLook,
  PLAIN_ITEM,
  type TileState,
} from "./interaction";

const locked = (price: number, bank: number): Partial<InteractionInput> => ({
  bank: cents(bank),
  price: cents(price),
});

describe("interactionState", () => {
  it("shows each item as normal, primary, selected or disabled by its pick, room and price", () => {
    for (const [, expected, input] of [
      ["an owned item with room", "normal", {}],
      ["the call to action", "primary", { primary: true }],
      ["an unavailable item", "disabled", { available: false }],
      ["an unavailable call to action", "disabled", { available: false, primary: true }],
      ["a picked item", "selected", { picked: true }],
      ["a picked item in a full choice", "selected", { full: true, picked: true }],
      ["a picked item made unavailable", "disabled", { available: false, picked: true }],
      ["an unpicked item in a full choice", "disabled", { full: true }],
      ["a locked item the bank covers", "normal", locked(500, 800)],
      ["a locked item the bank exactly covers", "normal", locked(500, 500)],
      ["a locked item the bank cannot cover", "disabled", locked(500, 499)],
      ["a locked, covered item in a full choice", "normal", { ...locked(500, 800), full: true }],
      ["a locked, uncovered item in a full choice", "disabled", { ...locked(500, 0), full: true }],
    ] satisfies readonly [string, InteractionState, Partial<InteractionInput>][]) {
      expect(interactionState({ ...PLAIN_ITEM, ...input })).toBe(expected);
    }
  });
});

describe("itemTile", () => {
  const owned: ItemTileInput = {
    bank: cents(0),
    capacity: 2,
    goal: null,
    picked: false,
    pickedCount: 0,
    price: null,
  };
  const locked = (price: number, affordable: boolean): ItemTile => ({
    affordable,
    kind: "locked",
    price: cents(price),
  });

  it("shows each dog or item tile as available, picked, full, locked or goal-locked", () => {
    for (const [, input, tile, state] of [
      ["an owned dog with room", {}, { kind: "available" }, "normal"],
      ["a picked dog", { picked: true, pickedCount: 1 }, { kind: "picked" }, "selected"],
      [
        "a picked dog in a full pack",
        { picked: true, pickedCount: 2 },
        { kind: "picked" },
        "selected",
      ],
      ["an unpicked dog in a full pack", { pickedCount: 2 }, { kind: "packFull" }, "disabled"],
      [
        "an unpicked dog in a full one-slot pack",
        { capacity: 1, pickedCount: 1 },
        { kind: "available" },
        "normal",
      ],
      [
        "a locked item the bank covers",
        { bank: cents(800), price: cents(800) },
        locked(800, true),
        "normal",
      ],
      [
        "a locked item short of the bank",
        { bank: cents(799), price: cents(800) },
        locked(800, false),
        "disabled",
      ],
      [
        "a locked item in a full pack",
        { pickedCount: 2, price: cents(800) },
        locked(800, false),
        "disabled",
      ],
      [
        "an item locked by a goal",
        { goal: "10 walks" },
        { goal: "10 walks", kind: "goal" },
        "disabled",
      ],
    ] satisfies readonly [string, Partial<ItemTileInput>, ItemTile, TileState][]) {
      const shown = itemTile({ ...owned, ...input });
      expect(shown).toEqual(tile);
      expect(itemTileLook(shown).state).toBe(state);
    }
  });
});
