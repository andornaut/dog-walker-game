import { describe, expect, it } from "vitest";

import { TEST_TUNING } from "../testing/tuning";
import { clampHearts, probability, readTable } from "./units";

describe("units", () => {
  it("holds hearts within 0 and the max", () => {
    expect(clampHearts(6, 7)).toBe(6);
    expect(clampHearts(6, -1)).toBe(0);
    expect(clampHearts(6, 4)).toBe(4);
  });

  it("rejects a probability outside 0 to 1", () => {
    expect(() => probability(1.5)).toThrow(RangeError);
    expect(() => probability(-0.1)).toThrow(RangeError);
    expect(probability(0.25)).toBe(0.25);
  });

  it("names a missing table row", () => {
    expect(() =>
      readTable(
        TEST_TUNING,
        "hearts",
        "maxBySize",
        "huge" as keyof typeof TEST_TUNING.hearts.maxBySize,
      ),
    ).toThrow("hearts.maxBySize.huge");
  });
});
