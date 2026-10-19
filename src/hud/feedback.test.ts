import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import {
  heartLabelAt,
  heartPopFrame,
  heartPopText,
  type MoneyTick,
  retarget,
  tickMs,
  tickShown,
} from "./feedback";

describe("heartPopText", () => {
  it.each([
    [-1, "−1"],
    [-2, "−2"],
    [1, "+1"],
    [3, "+3"],
  ])("shows %i as %s, with a real minus sign", (amount, text) => {
    expect(heartPopText(amount)).toBe(text);
  });
});

describe("heartLabelAt", () => {
  const bounds = { bottom: 460, screenWidth: 360 };

  it.each([
    [
      "sets the number right of the heart, its capitals centred on the frame's middle row",
      100,
      400,
      { x: 115, y: 387 },
    ],
    [
      "sets it left of the heart when the right would run off the screen",
      330,
      400,
      { x: 295, y: 387 },
    ],
    ["raises it out of the lane below", 100, 470, { x: 115, y: 455 }],
  ])("%s", (_, x, top, at) => {
    expect(heartLabelAt(bounds, heartPopFrame({ x, y: top }), 20)).toEqual(at);
  });
});

describe("money tick", () => {
  const tick: MoneyTick = { from: cents(4_299), startMs: 1_000, to: cents(4_099) };

  it.each([
    ["counts $1 a dollar's step", cents(4_000), cents(4_100), 150],
    ["takes at most its cap however far it counts", cents(0), cents(100_000), 600],
    ["takes no time for no change", cents(500), cents(500), 0],
  ])("%s", (_, from, to, ms) => {
    expect(tickMs(from, to)).toBe(ms);
  });

  it.each([
    ["shows the start's dollars as it starts", 1_000, 4_200],
    ["shows each dollar as it passes", 1_200, 4_100],
    ["shows the amount itself once there", 1_300, 4_099],
    ["shows the amount itself long after", 9_000, 4_099],
  ])("%s", (_, now, shown) => {
    expect(tickShown(now, tick)).toBe(shown);
  });

  it.each<[string, boolean, number, MoneyTick | undefined, MoneyTick]>([
    ["keeps counting toward the same amount", true, 1_200, tick, tick],
    [
      "counts from what it shows to a new amount",
      true,
      1_200,
      { ...tick, to: cents(4_299) },
      { from: cents(4_299), startMs: 1_200, to: cents(4_099) },
    ],
    [
      "starts at the amount with nothing shown yet",
      true,
      1_200,
      undefined,
      { from: cents(4_099), startMs: 1_200, to: cents(4_099) },
    ],
    [
      "jumps there when not counting",
      false,
      1_200,
      { ...tick, to: cents(9_999) },
      { from: cents(4_099), startMs: 1_200, to: cents(4_099) },
    ],
  ])("%s", (_, counting, now, from, expected) => {
    expect(retarget(counting, now, cents(4_099), from)).toEqual(expected);
  });
});
