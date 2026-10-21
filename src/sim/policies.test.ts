import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { type Random, seededRandom } from "../lib/random";
import { cardFor } from "../rules/choices";
import { cents } from "../rules/units";
import type { CardSource, RunState } from "../state/runState";
import { testState } from "../testing/runState";
import {
  chooseCardOption,
  choosePath,
  LOW_HEARTS,
  MIXED_PAY_SHARE,
  type PolicyId,
} from "./policies";

// The thief's card: a money option and a hearts option.
const THIEF: CardSource = { affected: ["duchess"], encounter: "thief", kind: "encounter" };
const THIEF_OPTIONS = (() => {
  const { resolution } = gameData.encounters.thief;
  return resolution.kind === "card" ? resolution.options : [];
})();
const PAY = THIEF_OPTIONS.findIndex(({ effects }) => effects.some(({ kind }) => kind === "money"));
const HEARTS = THIEF_OPTIONS.findIndex(({ effects }) =>
  effects.some(({ kind }) => kind === "hearts"),
);
// What the hearts option costs Duchess's owner. At SAFE hearts it leaves the owner above
// LOW_HEARTS; at LOW it does not.
const HEARTS_LOST = (() => {
  const effect = THIEF_OPTIONS[HEARTS]?.effects.find(({ kind }) => kind === "hearts");
  return effect?.kind === "hearts" ? -effect.amount : 0;
})();
const SAFE = LOW_HEARTS + HEARTS_LOST + 1;
const LOW = SAFE - 1;
// For a choice that must not draw.
const NO_DRAWS: Random = () => {
  throw new Error("drew");
};

function thiefChoice(policy: PolicyId, state: RunState, random: Random = NO_DRAWS) {
  return chooseCardOption(gameData, random, policy, state, cardFor(gameData, state, THIEF));
}

describe("chooseCardOption", () => {
  it("takes each policy's option at safe and low hearts", () => {
    for (const [policy, hearts, expected] of [
      ["heartsUnlessLow", SAFE, HEARTS],
      ["heartsUnlessLow", LOW, PAY],
      ["alwaysHearts", LOW, HEARTS],
      ["alwaysPay", SAFE, PAY],
    ] as const) {
      const state = testState({ duchess: hearts }, { money: cents(5000) });

      expect(thiefChoice(policy, state)).toBe(expected);
    }
  });

  it("takes hearts when no money option is affordable", () => {
    const state = testState({ duchess: SAFE }, { money: cents(0) });

    expect(thiefChoice("heartsUnlessLow", state)).toBe(HEARTS);
    expect(thiefChoice("alwaysPay", state)).toBe(HEARTS);
  });

  it("takes Hall pass's Skip whenever it is offered", () => {
    const state = testState({ duchess: 5 }, { money: cents(5000), skipPass: true });

    expect(thiefChoice("alwaysPay", state)).toBe("skip");
  });
});

describe("the mixed policy", () => {
  const rich = (hearts: number) => testState({ duchess: hearts }, { money: cents(5000) });

  it("pays for the cheapest safe option on a draw below the pay share, else takes hearts", () => {
    expect(thiefChoice("mixed", rich(SAFE), () => MIXED_PAY_SHARE - 0.01)).toBe(PAY);
    expect(thiefChoice("mixed", rich(SAFE), () => MIXED_PAY_SHARE)).toBe(HEARTS);
  });

  it("keeps heartsUnlessLow's guard, and takes hearts with nothing affordable, without drawing", () => {
    expect(thiefChoice("mixed", rich(LOW))).toBe(PAY);
    expect(thiefChoice("mixed", testState({ duchess: SAFE }, { money: cents(0) }))).toBe(HEARTS);
  });

  it("makes the same choices from the same seed, about half of them paid", () => {
    const choices = (seed: number) => {
      const random = seededRandom(seed);
      return Array.from({ length: 200 }, () => thiefChoice("mixed", rich(SAFE), random));
    };
    const first = choices(7);
    expect(choices(7)).toEqual(first);
    const paid = first.filter((choice) => choice === PAY).length;
    expect(paid).toBeGreaterThan(70);
    expect(paid).toBeLessThan(130);
  });
});

describe("choosePath", () => {
  it("goes straight down the middle, left to the easiest or right to the hardest", () => {
    const never = () => {
      throw new Error("A fixed route policy draws nothing");
    };
    expect(choosePath(never, "straight", 3)).toBe(1);
    expect(choosePath(never, "left", 3)).toBe(0);
    expect(choosePath(never, "right", 3)).toBe(2);
    expect(choosePath(never, "straight", 2)).toBe(0);
    expect(choosePath(never, "straight", 1)).toBe(0);
  });

  it("draws the random path from its random", () => {
    expect([0, 0.4, 0.99].map((roll) => choosePath(() => roll, "random", 3))).toEqual([0, 1, 2]);
  });
});
