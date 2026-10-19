import { describe, expect, it } from "vitest";

import { insetRect } from "./rect";

describe("insetRect", () => {
  it("shrinks the rect by the amount on every side", () => {
    expect(insetRect(1, { height: 192, width: 72, x: 4, y: 44 })).toEqual({
      height: 190,
      width: 70,
      x: 5,
      y: 45,
    });
  });
});
