import { describe, expect, it } from "vitest";

import { getOrInsert } from "./maps";

describe("getOrInsert", () => {
  it("makes a key's value once and returns the stored one after", () => {
    const store = new Map<string, number[]>();
    let made = 0;
    const make = () => {
      made += 1;
      return [made];
    };
    const first = getOrInsert(store, "a", make);
    expect(getOrInsert(store, "a", make)).toBe(first);
    expect(getOrInsert(store, "b", make)).toEqual([2]);
    expect(made).toBe(2);
  });
});
