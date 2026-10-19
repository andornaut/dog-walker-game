import { describe, expect, it } from "vitest";

import { amountText } from "./causes";

describe("a money change's amount", () => {
  it.each([
    { cents: -60, text: "−$1", why: "a part-dollar loss reads at least $1" },
    { cents: 50, text: "+$1", why: "half a dollar rounds up" },
    { cents: 150, text: "+$2", why: "a dollar and a half rounds up" },
    { cents: -1249, text: "−$12", why: "less than half a dollar over rounds down" },
    { cents: 2500, text: "+$25", why: "whole dollars stay as they are" },
  ])("shows whole dollars: $why", ({ cents, text }) => {
    expect(amountText("money", cents)).toBe(text);
  });
});
