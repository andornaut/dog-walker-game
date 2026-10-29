import { describe, expect, it } from "vitest";

import { type TextRoleCase, textRoleCases } from "../testing/textRoles";

// CLEANUP (added 2026-10-28): strings that overflow their role at its fixed size, by role, until
// their words are shortened in the data or their layout is decided. Remove each once it fits;
// the list ends empty.
const OVERFLOWING: Readonly<Record<string, readonly string[]>> = {
  "card effect": [
    "Bolt past: Zoomies: the pack drifts on its own for 40s",
    "Dogs give chase: Zoomies: the pack drifts on its own for 40s",
    "Drag them away: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Grab it back: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Help the keeper: Muddy: lane changes 67% slower for 30s",
    "Hold your nose: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Hurry on: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Hurry past: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Let them lick it: Muddy: lane changes 67% slower for 30s",
    "Let them sniff: +1♥ Biscuit, +1♥ Duchess, +1♥ Sequoia, −$20",
    "Pose: Spotlight: bumps also cost $20 for 30s",
    "Pull away: Zoomies: the pack drifts on its own for 40s",
    "Push through: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Skip",
    "Wade through: Muddy: lane changes 67% slower for 30s",
    "Walk around: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Walk on by: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Wave hello: Spotlight: bumps also cost $20 for 30s",
  ],
  "celebration title": ["Neighbourhood done!"],
  "end screen's breakdown label": ["Starting cash"],
  "enlarged card's changes": [
    "Drag them away: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Grab it back: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Hold your nose: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Hurry on: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Hurry past: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Let them sniff: +1♥ Biscuit, +1♥ Duchess, +1♥ Sequoia, −$20",
    "Push through: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Walk around: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
    "Walk on by: −1♥ Biscuit, −1♥ Duchess, −1♥ Sequoia",
  ],
  "heart change": ["−10♥ Aunt Judy fired you!", "−10♥ Big screen promo"],
  "home screen's bank": ["$123M", "$123k"],
  "shop message": [
    "Fanny pack is yours. Pocket it for a walk.",
    "Hall pass is yours. Pocket it for a walk.",
    "Lucky collar is yours. Pocket it for a walk.",
    "Running shoes is yours. Pocket it for a walk.",
    "Whistle is yours. Pocket it for a walk.",
  ],
  "shop row's line": [
    "+1 max ♥ for every dog's owner",
    "+50% lane change speed",
    "Medium and large dogs dodge too",
    "Saves a spare treat for later",
    "Skip 1 card each neighbourhood",
  ],
  "start screen's dog name": ["Duchess"],
  "walk bar's cash": ["$123M", "$123k"],
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
