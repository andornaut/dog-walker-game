import { describe, expect, it } from "vitest";

import { slotShown } from "./walkHud";

describe("slotShown", () => {
  it("shows a dog's slot, an owned empty slot as empty, and hides slots past those owned", () => {
    expect(slotShown(1, 0, true)).toBe("dog");
    expect(slotShown(2, 1, false)).toBe("empty");
    expect(slotShown(1, 1, false)).toBe("hidden");
    expect(slotShown(2, 2, false)).toBe("hidden");
  });
});
