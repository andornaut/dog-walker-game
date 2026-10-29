import { describe, expect, it } from "vitest";

import { clampHearts } from "./units";

describe("units", () => {
  it("holds hearts within 0 and the max", () => {
    expect(clampHearts(6, 7)).toBe(6);
    expect(clampHearts(6, -1)).toBe(0);
    expect(clampHearts(6, 4)).toBe(4);
  });
});
