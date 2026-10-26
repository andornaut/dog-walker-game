import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import {
  type ArtLook,
  type ButtonState,
  buttonState,
  type InteractionInput,
  type ItemTile,
  itemTile,
  type ItemTileInput,
  itemTileLook,
  PLAIN_ITEM,
  type TileState,
  tileState,
} from "./interaction";

describe("tileState", () => {
  it("shows each item as normal, selected or disabled by its pick and room", () => {
    for (const [, expected, input] of [
      ["an owned item with room", "normal", {}],
      ["an unavailable item", "disabled", { available: false }],
      ["a picked item", "selected", { picked: true }],
      ["a picked item in a full choice", "selected", { full: true, picked: true }],
      ["a picked item made unavailable", "disabled", { available: false, picked: true }],
      ["an unpicked item in a full choice", "disabled", { full: true }],
    ] satisfies readonly [string, TileState, Partial<InteractionInput>][]) {
      expect(tileState({ ...PLAIN_ITEM, ...input })).toBe(expected);
    }
  });
});

describe("buttonState", () => {
  it("shows a button as normal, primary or disabled", () => {
    for (const [, expected, input] of [
      ["an available button", "normal", {}],
      ["the call to action", "primary", { primary: true }],
      ["an unavailable button", "disabled", { available: false }],
      ["an unavailable call to action", "disabled", { available: false, primary: true }],
    ] satisfies readonly [string, ButtonState, Partial<InteractionInput>][]) {
      expect(buttonState({ ...PLAIN_ITEM, ...input })).toBe(expected);
    }
  });
});

describe("itemTile", () => {
  const owned: ItemTileInput = {
    affordable: false,
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

  // A tile not owned stays disabled, its art in color only while the player can buy it.
  it("shows each dog or item tile as available, picked, full, locked or goal-locked", () => {
    for (const [, input, tile, state, art] of [
      ["an owned dog with room", {}, { kind: "available" }, "normal", "color"],
      ["a picked dog", { picked: true, pickedCount: 1 }, { kind: "picked" }, "selected", "color"],
      [
        "a picked dog in a full pack",
        { picked: true, pickedCount: 2 },
        { kind: "picked" },
        "selected",
        "color",
      ],
      [
        "an unpicked dog in a full pack",
        { pickedCount: 2 },
        { kind: "packFull" },
        "disabled",
        "grey",
      ],
      [
        "an unpicked dog in a full one-slot pack",
        { capacity: 1, pickedCount: 1 },
        { kind: "available" },
        "normal",
        "color",
      ],
      [
        "a locked item the player can buy",
        { affordable: true, price: cents(800) },
        locked(800, true),
        "disabled",
        "color",
      ],
      [
        "a locked item the player cannot buy",
        { price: cents(800) },
        locked(800, false),
        "disabled",
        "grey",
      ],
      [
        "a locked item the player can buy in a full pack",
        { affordable: true, pickedCount: 2, price: cents(800) },
        locked(800, true),
        "disabled",
        "color",
      ],
      [
        "an item locked by a goal",
        { affordable: true, goal: "10 walks" },
        { goal: "10 walks", kind: "goal" },
        "disabled",
        "grey",
      ],
    ] satisfies readonly [string, Partial<ItemTileInput>, ItemTile, TileState, ArtLook][]) {
      const shown = itemTile({ ...owned, ...input });
      expect(shown).toEqual(tile);
      const look = itemTileLook(shown);
      expect({ art: look.art, state: look.state }).toEqual({ art, state });
    }
  });
});
