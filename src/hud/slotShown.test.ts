import { describe, expect, it } from "vitest";

import { slotShown } from "./walkHud";

describe("slotShown", () => {
  it.each([
    { hasDog: true, index: 0, owned: 1, shown: "dog" },
    { hasDog: false, index: 1, owned: 2, shown: "empty" },
    { hasDog: false, index: 1, owned: 1, shown: "hidden" },
    { hasDog: false, index: 2, owned: 2, shown: "hidden" },
  ] as const)("shows slot $index of $owned owned as $shown", ({ hasDog, index, owned, shown }) => {
    expect(slotShown(owned, index, hasDog)).toBe(shown);
  });
});
