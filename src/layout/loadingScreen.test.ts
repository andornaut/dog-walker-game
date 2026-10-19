import { describe, expect, it } from "vitest";

import {
  bootProgress,
  byteFraction,
  loadingBarWidth,
  loadingWalkerAt,
  stepFraction,
} from "./loadingScreen";

describe("bootProgress", () => {
  it("fills the first 0.9 over the network load", () => {
    expect(bootProgress("network", 0)).toBe(0);
    expect(bootProgress("network", 0.5)).toBeCloseTo(0.45);
    expect(bootProgress("network", 1)).toBeCloseTo(0.9);
  });

  it("fills the rest while the assets are processed", () => {
    expect(bootProgress("processing", 0)).toBeCloseTo(0.9);
    expect(bootProgress("processing", 0.5)).toBeCloseTo(0.95);
    expect(bootProgress("processing", 1)).toBe(1);
  });

  it("holds a fraction outside 0 to 1 to its phase", () => {
    expect(bootProgress("network", -1)).toBe(0);
    expect(bootProgress("network", 2)).toBeCloseTo(0.9);
    expect(bootProgress("processing", 2)).toBe(1);
  });
});

describe("byteFraction", () => {
  it("weighs each file by its size", () => {
    const files = [
      { bytes: 300_000, fraction: 0.5 },
      { bytes: 10_000, fraction: 1 },
      { bytes: 90_000, fraction: 0 },
    ];
    expect(byteFraction(files)).toBeCloseTo(160_000 / 400_000);
  });

  it("holds each file's fraction to 0 to 1", () => {
    expect(byteFraction([{ bytes: 100, fraction: 2 }])).toBe(1);
    expect(byteFraction([{ bytes: 100, fraction: -1 }])).toBe(0);
  });

  it("treats a load with no bytes as done", () => {
    expect(byteFraction([])).toBe(1);
  });
});

describe("stepFraction", () => {
  it("counts the steps done", () => {
    expect(stepFraction(4, 0)).toBe(0);
    expect(stepFraction(4, 1)).toBe(0.25);
    expect(stepFraction(4, 4)).toBe(1);
  });

  it("treats a phase with no steps as done", () => {
    expect(stepFraction(0, 0)).toBe(1);
  });
});

describe("loadingWalkerAt", () => {
  it("walks from the track's first dot to the doghouse", () => {
    expect(loadingWalkerAt(0)).toEqual({ x: 76, y: 332 });
    expect(loadingWalkerAt(0.4)).toEqual({ x: 76 + 59, y: 332 });
    expect(loadingWalkerAt(1)).toEqual({ x: 76 + 148, y: 332 });
  });

  it("stays on the track past either end", () => {
    expect(loadingWalkerAt(-0.5).x).toBe(76);
    expect(loadingWalkerAt(1.5).x).toBe(224);
  });
});

describe("loadingBarWidth", () => {
  it("fills the 200px track in whole pixels", () => {
    expect(loadingBarWidth(0)).toBe(0);
    expect(loadingBarWidth(0.333)).toBe(67);
    expect(loadingBarWidth(1)).toBe(200);
  });
});
