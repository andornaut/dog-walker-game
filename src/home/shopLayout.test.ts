import { describe, expect, it } from "vitest";

import { SHOP_LAYOUT, shopTabRects } from "./shopLayout";

// The tabs line up with the rows under them: the first starts on the rows' left edge and the
// last ends on their right edge.
describe("the shop's tabs", () => {
  const tabs = shopTabRects();
  const { row } = SHOP_LAYOUT;

  it("span the rows' width, side by side", () => {
    expect(tabs[0]?.x).toBe(row.x);
    const last = tabs[tabs.length - 1];
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(row.x + row.width);
    tabs.slice(1).forEach((tab, i) => {
      const left = tabs[i];
      expect(tab.x).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0));
    });
  });
});
