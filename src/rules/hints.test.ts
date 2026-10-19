import { describe, expect, it } from "vitest";

import { HINTS } from "../data/hints";
import { hintFor } from "./hints";

const data = { hints: HINTS };

describe("hintFor", () => {
  it("returns the hint whose trigger matches the event", () => {
    expect(hintFor(data, [], { kind: "tip" })).toEqual({ id: "tip", text: HINTS.tip.text });
    expect(hintFor(data, [], { encounter: "puddle", kind: "encounter" })?.id).toBe("puddle");
    expect(hintFor(data, [], { debuff: "stinky", kind: "debuff" })?.id).toBe("stinky");
  });

  it("returns nothing for a hint already shown", () => {
    expect(hintFor(data, ["tip"], { kind: "tip" })).toBeNull();
  });

  it("returns nothing for an event no hint waits for", () => {
    expect(hintFor(data, [], { encounter: "thief", kind: "encounter" })).toBeNull();
  });
});
