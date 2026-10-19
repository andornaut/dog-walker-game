import { describe, expect, it } from "vitest";

import { laneCenters } from "./lanes";

describe("laneCenters", () => {
  it("puts each centre in the middle of its share of the road", () => {
    expect(laneCenters(5, { height: 600, width: 280, x: 80, y: 40 })).toEqual([
      108, 164, 220, 276, 332,
    ]);
  });

  it("returns one centre per lane", () => {
    expect(laneCenters(3, { height: 100, width: 90, x: 0, y: 0 })).toHaveLength(3);
  });
});
