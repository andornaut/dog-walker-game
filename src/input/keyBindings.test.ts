import { describe, expect, it } from "vitest";

import type { GestureAction } from "./gestures";
import {
  cardNumberForKey,
  dogSlotForKey,
  isConfirmKey,
  isMuteKey,
  isPauseKey,
  laneDirectionForKey,
  walkKeyAction,
} from "./keyBindings";

describe("key bindings", () => {
  // Each binding read over every key listed, by key; undefined or false for a key it ignores.
  it.each<{
    expected: Record<string, boolean | number | undefined>;
    name: string;
    read: (key: string) => unknown;
  }>([
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
      expected: { "0": undefined, "1": 0, "3": 2, "4": undefined, a: undefined },
      name: "dogSlotForKey maps the digits 1..3 to slots 0..2",
      read: (key) => dogSlotForKey(3, key),
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
  ])("$name", ({ expected, read }) => {
    for (const [key, value] of Object.entries(expected)) {
      expect(read(key), JSON.stringify(key)).toBe(value);
    }
  });
});

describe("walkKeyAction", () => {
  // A key going down during a walk with 3 dog slots, first pressed or auto-repeated.
  it.each<{ action: GestureAction | undefined; key: string; repeat: boolean }>([
    { action: { direction: -1, kind: "move" }, key: "ArrowLeft", repeat: false },
    { action: { direction: 1, kind: "move" }, key: "d", repeat: false },
    { action: { kind: "treat", slot: 1 }, key: "2", repeat: false },
    { action: undefined, key: "4", repeat: false },
    { action: undefined, key: "w", repeat: false },
    { action: undefined, key: "ArrowLeft", repeat: true },
    { action: undefined, key: "d", repeat: true },
    { action: undefined, key: "2", repeat: true },
  ])("acts on $key, repeat $repeat", ({ action, key, repeat }) => {
    expect(walkKeyAction(3, key, repeat)).toEqual(action);
  });
});
