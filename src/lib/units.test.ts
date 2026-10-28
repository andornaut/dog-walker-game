import { describe, expect, it } from "vitest";

import { clampHearts, probability } from "./units";

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
});
