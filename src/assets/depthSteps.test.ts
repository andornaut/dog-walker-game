import { describe, expect, it } from "vitest";

import { splitDepthKey, stepSize } from "./depthSteps";

describe("stepSize", () => {
  // Rounding halves up.
  it("rounds a step's size half up", () => {
    const cases = [
      [33, 0.5, 17],
      [32, 0.625, 20],
    ];
    expect(cases.map(([full = 0, scale = 0]) => stepSize(full, scale))).toEqual(
      cases.map(([, , expected]) => expected),
    );
  });
});

describe("splitDepthKey", () => {
  // A plain key is its own full size.
  it("splits a key into its base and step", () => {
    const cases = [
      ["dog-kilo@88", "dog-kilo", { scale: 0.875, suffix: "@88" }],
      ["dog-kilo", "dog-kilo", { scale: 1, suffix: "" }],
    ] as const;
    for (const [key, base, step] of cases) {
      expect(splitDepthKey(key)).toEqual({ base, step });
    }
  });
});
