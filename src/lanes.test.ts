import { describe, expect, it } from "vitest";

import { laneCenters } from "./lanes";

describe("laneCenters", () => {
  it("puts each centre in the middle of its share of the width", () => {
    expect(laneCenters(5, 180)).toEqual([18, 54, 90, 126, 162]);
  });

  it("returns one centre per lane", () => {
    expect(laneCenters(3, 90)).toHaveLength(3);
  });
});
