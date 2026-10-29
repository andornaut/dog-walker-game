import { describe, expect, it } from "vitest";

import { textRoleCases } from "../testing/textRoles";

const CASES = textRoleCases();

// Text never shrinks to fit: each role has one size, and every string the data puts in it fits
// its room there, on no more than its lines.
describe("every text role", () => {
  it.each(CASES.map(({ overflow, role, text }) => [`${role}: ${text}`, overflow] as const))(
    "fits %s",
    (_name, overflow) => {
      expect(overflow).toBe("");
    },
  );
});
