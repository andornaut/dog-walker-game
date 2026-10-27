import { describe, expect, it } from "vitest";

import { DEPTH_STEPS, depthStepOfScale, splitDepthKey, stepSize } from "./depthSteps";

describe("DEPTH_STEPS", () => {
  // Every 1/16 from full size down to half, largest first, so a sprite drawn between two steps
  // shrinks its larger step's art by at most 1/16.
  it("steps every 1/16 from 1 to 0.5, largest first", () => {
    const sixteenths = Array.from({ length: 9 }, (_, i) => 1 - i / 16);
    expect(DEPTH_STEPS.map(({ scale }) => scale)).toEqual(sixteenths);
  });

  // The suffix is the step's percentage, rounded half to even.
  it.each([
    [1, ""],
    [0.9375, "@94"],
    [0.875, "@88"],
    [0.8125, "@81"],
    [0.75, "@75"],
    [0.6875, "@69"],
    [0.625, "@62"],
    [0.5625, "@56"],
    [0.5, "@50"],
  ])("names the %f step's art with suffix '%s'", (scale, suffix) => {
    expect(depthStepOfScale(scale).suffix).toBe(suffix);
  });
});

describe("stepSize", () => {
  // Rounding halves up.
  it("rounds a step's size half up", () => {
    const cases = [
      [44, 0.875, 39],
      [28, 0.875, 25],
      [33, 0.5, 17],
      [32, 0.625, 20],
      [32, 1, 32],
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
      ["parked-car@62", "parked-car", { scale: 0.625, suffix: "@62" }],
      ["dog-kilo", "dog-kilo", { scale: 1, suffix: "" }],
    ] as const;
    for (const [key, base, step] of cases) {
      expect(splitDepthKey(key)).toEqual({ base, step });
    }
  });
});

describe("depthStepOfScale", () => {
  it("finds a step by its exact scale and throws for any other", () => {
    expect(depthStepOfScale(0.625).suffix).toBe("@62");
    expect(() => depthStepOfScale(0.62)).toThrow("not a depth step");
  });
});
