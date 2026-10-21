import { describe, expect, it } from "vitest";

import {
  bootProgress,
  byteFraction,
  LOADING_TRACK,
  LOADING_WALKER_SIZE,
  loadingWalkerAt,
} from "./loadingScreen";

describe("bootProgress", () => {
  // The first 0.9 over the network load, the rest while the assets are processed, and a
  // fraction outside 0 to 1 held to its phase.
  it("fills the network load to 0.9 and processing the rest, each held to its phase", () => {
    for (const [phase, fraction, expected] of [
      ["network", 0, 0],
      ["network", 0.5, 0.45],
      ["network", 1, 0.9],
      ["processing", 0, 0.9],
      ["processing", 0.5, 0.95],
      ["processing", 1, 1],
      ["network", -1, 0],
      ["network", 2, 0.9],
      ["processing", 2, 1],
    ] as const) {
      expect(bootProgress(phase, fraction)).toBeCloseTo(expected);
    }
  });
});

describe("byteFraction", () => {
  // Each file weighed by its size, its fraction held to 0 to 1; no bytes is done.
  it("weighs each file by its size, its fraction held to 0 to 1, and no bytes as done", () => {
    for (const { expected, files } of [
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
    ]) {
      expect(byteFraction(files)).toBeCloseTo(expected);
    }
  });
});

describe("loadingWalkerAt", () => {
  it("ends with its right edge on the track's end", () => {
    expect(loadingWalkerAt(1).x + LOADING_WALKER_SIZE.width).toBeLessThanOrEqual(
      LOADING_TRACK.x + LOADING_TRACK.width,
    );
  });
});
