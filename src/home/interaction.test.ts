import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import {
  type InteractionInput,
  type InteractionState,
  interactionState,
  PLAIN_ITEM,
} from "./interaction";

const locked = (price: number, bank: number): Partial<InteractionInput> => ({
  bank: cents(bank),
  price: cents(price),
});

describe("interactionState", () => {
  it.each<[string, InteractionState, Partial<InteractionInput>]>([
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
  ])("shows %s as %s", (_, expected, input) => {
    expect(interactionState({ ...PLAIN_ITEM, ...input })).toBe(expected);
  });
});
