import { describe, expect, it } from "vitest";

import { BUFF_POP, charmByWalkerRect } from "./buffLayout";

describe("charmByWalkerRect", () => {
  it("sits beside the walker's head, left of the walker's centre", () => {
    const rect = charmByWalkerRect({ x: 100, y: 200 });
    expect(rect.x + rect.width / 2).toBe(100 + BUFF_POP.walker.dx);
    expect(rect.y).toBe(200 + BUFF_POP.walker.dy);
  });
});
