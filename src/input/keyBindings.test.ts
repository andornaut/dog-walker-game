import { describe, expect, it } from "vitest";

import type { GestureAction } from "./gestures";
import {
  cardNumberForKey,
  isConfirmKey,
  isMuteKey,
  isPauseKey,
  laneDirectionForKey,
  menuKeyActs,
  walkKeyAction,
} from "./keyBindings";

describe("key bindings", () => {
  // Each binding read over every key listed, by key; undefined or false for a key it ignores.
  it("binds each key", () => {
    for (const { expected, read } of [
      {
        expected: {
          " ": undefined,
          "1": undefined,
          A: -1,
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: undefined,
          L: 1,
          a: -1,
          d: 1,
          e: undefined,
          h: -1,
          l: 1,
          w: undefined,
        },
        name: "laneDirectionForKey moves left on Left, A and H, right on Right, D and L, in either case",
        read: laneDirectionForKey,
      },
      {
        expected: {
          " ": undefined,
          "0": undefined,
          "1": 1,
          "3": 3,
          "4": undefined,
          Enter: undefined,
          e: undefined,
        },
        name: "cardNumberForKey picks the card numbered by a digit, up to the 3 on offer",
        read: (key) => cardNumberForKey(3, key),
      },
      {
        expected: { M: true, m: true, n: false },
        name: "isMuteKey is M in either case",
        read: isMuteKey,
      },
      {
        expected: {
          "1": false,
          ArrowLeft: false,
          Enter: false,
          Escape: true,
          P: true,
          a: false,
          p: true,
        },
        name: "isPauseKey is Escape or P in either case",
        read: isPauseKey,
      },
      {
        expected: { " ": true, Enter: true, e: false },
        name: "isConfirmKey is Enter or Space only",
        read: isConfirmKey,
      },
    ] satisfies readonly {
      expected: Record<string, boolean | number | undefined>;
      name: string;
      read: (key: string) => unknown;
    }[]) {
      for (const [key, value] of Object.entries(expected)) {
        expect(read(key), JSON.stringify(key)).toBe(value);
      }
    }
  });
});

describe("walkKeyAction", () => {
  // A key going down during a walk, first pressed or auto-repeated.
  it("acts on each key, repeat or not", () => {
    for (const { action, key, repeat } of [
      { action: { direction: -1, kind: "move" }, key: "ArrowLeft", repeat: false },
      { action: { direction: 1, kind: "move" }, key: "d", repeat: false },
      { action: undefined, key: "2", repeat: false },
      { action: undefined, key: "w", repeat: false },
      { action: undefined, key: "ArrowLeft", repeat: true },
      { action: undefined, key: "d", repeat: true },
      { action: undefined, key: "2", repeat: true },
    ] satisfies readonly { action: GestureAction | undefined; key: string; repeat: boolean }[]) {
      expect(walkKeyAction(key, repeat)).toEqual(action);
    }
  });
});

describe("menuKeyActs", () => {
  // A key going down on a menu or page, first pressed or auto-repeated.
  it.each([
    { acts: true, key: "Enter", repeat: false },
    { acts: true, key: "1", repeat: false },
    { acts: true, key: "ArrowDown", repeat: true },
    { acts: true, key: "ArrowLeft", repeat: true },
    { acts: false, key: "Enter", repeat: true },
    { acts: false, key: "Escape", repeat: true },
    { acts: false, key: "1", repeat: true },
  ])("$key, repeat $repeat: acts $acts", ({ acts, key, repeat }) => {
    expect(menuKeyActs(repeat, key)).toBe(acts);
  });
});
