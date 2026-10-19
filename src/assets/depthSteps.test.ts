import { describe, expect, it } from "vitest";

import table from "../../shared/depth-steps.json";
import { DEPTH_STEPS, depthStepOfScale, splitDepthKey, stepSize } from "./depthSteps";

describe("depth step table", () => {
  it("lists full size with no suffix, then the @88, @75, @62 and @50 steps at their exact scales", () => {
    expect(DEPTH_STEPS.map(({ scale, suffix }) => `${suffix}=${scale}`)).toEqual([
      "=1",
      "@88=0.875",
      "@75=0.75",
      "@62=0.625",
      "@50=0.5",
    ]);
  });
});

describe("stepSize", () => {
  it("is the table's size rule", () => {
    expect(table.size).toBe("floor(full * scale + 0.5)");
  });

  // Rounding halves up.
  it.each([
    [44, 0.875, 39],
    [28, 0.875, 25],
    [33, 0.5, 17],
    [32, 0.625, 20],
    [32, 1, 32],
  ])("sizes %d at %d to %d", (full, scale, expected) => {
    expect(stepSize(full, scale)).toBe(expected);
  });
});

describe("splitDepthKey", () => {
  // A plain key is its own full size.
  it.each([
    ["dog-koda@88", "dog-koda", { scale: 0.875, suffix: "@88" }],
    ["parked-car@62", "parked-car", { scale: 0.625, suffix: "@62" }],
    ["dog-koda", "dog-koda", { scale: 1, suffix: "" }],
  ])("splits %s into %s and its step", (key, base, step) => {
    expect(splitDepthKey(key)).toEqual({ base, step });
  });
});

describe("depthStepOfScale", () => {
  it("finds a step by its exact scale and throws for any other", () => {
    expect(depthStepOfScale(0.625).suffix).toBe("@62");
    expect(() => depthStepOfScale(0.62)).toThrow("not a depth step");
  });
});
