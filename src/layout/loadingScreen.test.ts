import { describe, expect, it } from "vitest";

import {
  bootProgress,
  byteFraction,
  LOADING_TRACK,
  LOADING_WALKER,
  LOADING_WALKER_SIZE,
  loadingBarWidth,
  loadingWalkerAt,
  stepFraction,
} from "./loadingScreen";

describe("bootProgress", () => {
  // The first 0.9 over the network load, the rest while the assets are processed, and a
  // fraction outside 0 to 1 held to its phase.
  it.each([
    ["network", 0, 0],
    ["network", 0.5, 0.45],
    ["network", 1, 0.9],
    ["processing", 0, 0.9],
    ["processing", 0.5, 0.95],
    ["processing", 1, 1],
    ["network", -1, 0],
    ["network", 2, 0.9],
    ["processing", 2, 1],
  ] as const)("fills %s at %d to %d", (phase, fraction, expected) => {
    expect(bootProgress(phase, fraction)).toBeCloseTo(expected);
  });
});

describe("byteFraction", () => {
  // Each file weighed by its size, its fraction held to 0 to 1; no bytes is done.
  it.each([
    {
      expected: 160_000 / 400_000,
      files: [
        { bytes: 300_000, fraction: 0.5 },
        { bytes: 10_000, fraction: 1 },
        { bytes: 90_000, fraction: 0 },
      ],
      name: "three files of different sizes",
    },
    { expected: 1, files: [{ bytes: 100, fraction: 2 }], name: "a fraction over 1" },
    { expected: 0, files: [{ bytes: 100, fraction: -1 }], name: "a fraction under 0" },
    { expected: 1, files: [], name: "no bytes" },
  ])("is $expected for $name", ({ expected, files }) => {
    expect(byteFraction(files)).toBeCloseTo(expected);
  });
});

describe("stepFraction", () => {
  // The share of steps done, and a phase with no steps is done.
  it.each([
    [4, 0, 0],
    [4, 1, 0.25],
    [4, 4, 1],
    [0, 0, 1],
  ])("of %d steps with %d done is %d", (steps, done, expected) => {
    expect(stepFraction(steps, done)).toBe(expected);
  });
});

describe("loadingWalkerAt", () => {
  // From the start to the gate, staying on the track past either end.
  it.each([
    [0, LOADING_WALKER.x],
    [0.4, LOADING_WALKER.x + Math.round(LOADING_WALKER.travel * 0.4)],
    [1, LOADING_WALKER.x + LOADING_WALKER.travel],
    [-0.5, LOADING_WALKER.x],
    [1.5, LOADING_WALKER.x + LOADING_WALKER.travel],
  ])("walks at %d to x %d", (fraction, x) => {
    expect(loadingWalkerAt(fraction)).toEqual({ x, y: LOADING_WALKER.y });
  });

  it("ends with its right edge on the track's end", () => {
    expect(loadingWalkerAt(1).x + LOADING_WALKER_SIZE.width).toBeLessThanOrEqual(
      LOADING_TRACK.x + LOADING_TRACK.width,
    );
  });
});

describe("loadingBarWidth", () => {
  // The track in whole pixels.
  it.each([
    [0, 0],
    [0.333, Math.round(LOADING_TRACK.width * 0.333)],
    [1, LOADING_TRACK.width],
  ])("fills %d as %dpx", (fraction, width) => {
    expect(loadingBarWidth(fraction)).toBe(width);
  });
});
