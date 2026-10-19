import { describe, expect, it } from "vitest";

import table from "../../data/depth-steps.json";
import { DEPTH_STEPS, depthStepOfScale, splitDepthKey, stepSize } from "./depthSteps";

describe("depth step table", () => {
  it("lists full size with no suffix, then strictly smaller steps with distinct @ suffixes", () => {
    expect(DEPTH_STEPS[0]).toEqual({ scale: 1, suffix: "" });
    const smaller = DEPTH_STEPS.slice(1);
    smaller.forEach(({ scale, suffix }, i) => {
      expect(suffix).toMatch(/^@[0-9]+$/);
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThan(DEPTH_STEPS[i]?.scale ?? 0);
    });
    expect(new Set(smaller.map(({ suffix }) => suffix)).size).toBe(smaller.length);
  });

  it("has the @88, @75, @62 and @50 steps at their exact scales", () => {
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
  it("implements the table's size rule, rounding halves up", () => {
    expect(table.size).toBe("floor(full * scale + 0.5)");
    expect(stepSize(44, 0.875)).toBe(39);
    expect(stepSize(28, 0.875)).toBe(25);
    expect(stepSize(33, 0.5)).toBe(17);
    expect(stepSize(32, 0.625)).toBe(20);
    expect(stepSize(32, 1)).toBe(32);
  });
});

describe("splitDepthKey", () => {
  it("splits a variant into its base and step, and a plain key is its own full size", () => {
    expect(splitDepthKey("dog-koda@88")).toEqual({
      base: "dog-koda",
      step: { scale: 0.875, suffix: "@88" },
    });
    expect(splitDepthKey("parked-car@62").step.scale).toBe(0.625);
    expect(splitDepthKey("dog-koda")).toEqual({ base: "dog-koda", step: { scale: 1, suffix: "" } });
  });
});

describe("depthStepOfScale", () => {
  it("finds a step by its exact scale and throws for any other", () => {
    expect(depthStepOfScale(0.625).suffix).toBe("@62");
    expect(() => depthStepOfScale(0.62)).toThrow("not a depth step");
  });
});
