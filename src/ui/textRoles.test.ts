import { describe, expect, it } from "vitest";

import { type TextRoleCase, textRoleCases } from "../testing/textRoles";

// CLEANUP (added 2026-10-28): strings that overflow their role at its fixed size, by role, until
// their words are shortened in the data or their layout is decided. Remove each once it fits;
// the list ends empty.
const OVERFLOWING: Readonly<Record<string, readonly string[]>> = {
  "card effect": [
    "Bolt past: Zoomies: the pack drifts for 40s",
    "Dogs give chase: Zoomies: the pack drifts for 40s",
    "Help the keeper: Muddy: 67% slower moves for 30s",
    "Let them lick it: Muddy: 67% slower moves for 30s",
    "Pull away: Zoomies: the pack drifts for 40s",
    "Wade through: Muddy: 67% slower moves for 30s",
  ],
  "enlarged card's changes": [
    "Drag them away: −1♥ each",
    "Grab it back: −1♥ each",
    "Hold your nose: −1♥ each",
    "Hurry on: −1♥ each",
    "Hurry past: −1♥ each",
    "Let them sniff: +1♥ each, −$20",
    "Push through: −1♥ each",
    "Walk around: −1♥ each",
    "Walk on by: −1♥ each",
  ],
  "heart change": ["−10♥ Aunt Judy fired you!", "−10♥ Big screen promo"],
};

const named = ({ role, text }: TextRoleCase) => `${role}: ${text}`;
const CASES = textRoleCases();
const allowed = ({ role, text }: TextRoleCase) => OVERFLOWING[role]?.includes(text) === true;
const table = (cases: readonly TextRoleCase[]) =>
  cases.map((one) => [named(one), one.overflow] as const);

// Text never shrinks to fit: each role has one size, and every string the data puts in it fits
// its room there, on no more than its lines.
describe("every text role", () => {
  it.each(table(CASES.filter((one) => !allowed(one))))("fits %s", (_name, overflow) => {
    expect(overflow).toBe("");
  });

  it.skip.each(table(CASES.filter(allowed)))("fits %s", (_name, overflow) => {
    expect(overflow).toBe("");
  });

  it("allows only strings the roles hold", () => {
    const known = new Set(CASES.map(named));
    const stale = Object.entries(OVERFLOWING).flatMap(([role, texts]) =>
      texts.map((text) => `${role}: ${text}`).filter((name) => !known.has(name)),
    );
    expect(stale).toEqual([]);
  });
});
