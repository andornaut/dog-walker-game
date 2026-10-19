import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cardFor } from "../rules/choices";
import { cents } from "../rules/units";
import { type Random, seededRandom } from "../runner/random";
import type { CardSource, RunState, UpgradeOffer } from "../state/runState";
import { testState } from "../testing/runState";
import {
  chooseCardOption,
  choosePath,
  chooseUpgrade,
  MIXED_PAY_SHARE,
  type PolicyId,
  treatTarget,
} from "./policies";

const SKUNK: CardSource = { affected: ["duchess"], encounter: "skunk", kind: "encounter" };
const RINSE = 1;
const IGNORE = 2;
// For a choice that must not draw.
const NO_DRAWS: Random = () => {
  throw new Error("drew");
};

function skunkChoice(policy: PolicyId, state: RunState, random: Random = NO_DRAWS) {
  return chooseCardOption(gameData, random, policy, state, cardFor(gameData, state, SKUNK));
}

describe("chooseCardOption", () => {
  // Grooming is $20, Quick rinse $10, and Ignore costs Duchess's laid-back owner 2 hearts.
  it.each([
    ["heartsUnlessLow", 4, IGNORE],
    ["heartsUnlessLow", 3, RINSE],
    ["alwaysHearts", 3, IGNORE],
    ["alwaysPay", 4, RINSE],
  ] as const)("%s at %i hearts takes option %i", (policy, hearts, expected) => {
    const state = testState({ duchess: hearts }, { money: cents(5000) });

    expect(skunkChoice(policy, state)).toBe(expected);
  });

  it("takes hearts when no money option is affordable", () => {
    const state = testState({ duchess: 3 }, { money: cents(0) });

    expect(skunkChoice("heartsUnlessLow", state)).toBe(IGNORE);
    expect(skunkChoice("alwaysPay", state)).toBe(IGNORE);
  });

  it("takes poop bags' Skip whenever it is offered", () => {
    const state = testState({ duchess: 5 }, { money: cents(5000), skipsLeft: 1 });

    expect(skunkChoice("alwaysPay", state)).toBe("skip");
  });

  it("returns a lost wallet rather than leave an owner at 1 heart", () => {
    const source: CardSource = {
      affected: ["duchess"],
      encounter: "lostWallet",
      kind: "encounter",
    };
    const choose = (hearts: number) => {
      const state = testState({ duchess: hearts });
      return chooseCardOption(
        gameData,
        NO_DRAWS,
        "heartsUnlessLow",
        state,
        cardFor(gameData, state, source),
      );
    };

    expect(choose(5)).toBe(1);
    expect(choose(2)).toBe(0);
  });
});

describe("the mixed policy", () => {
  const rich = (hearts: number) => testState({ duchess: hearts }, { money: cents(5000) });

  it("pays for the cheapest safe option on a draw below the pay share, else takes hearts", () => {
    expect(skunkChoice("mixed", rich(4), () => MIXED_PAY_SHARE - 0.01)).toBe(RINSE);
    expect(skunkChoice("mixed", rich(4), () => MIXED_PAY_SHARE)).toBe(IGNORE);
  });

  it("keeps heartsUnlessLow's guard, and takes hearts with nothing affordable, without drawing", () => {
    expect(skunkChoice("mixed", rich(3))).toBe(RINSE);
    expect(skunkChoice("mixed", testState({ duchess: 3 }, { money: cents(0) }))).toBe(IGNORE);
  });

  it("makes the same choices from the same seed, about half of them paid", () => {
    const choices = (seed: number) => {
      const random = seededRandom(seed);
      return Array.from({ length: 200 }, () => skunkChoice("mixed", rich(4), random));
    };
    const first = choices(7);
    expect(choices(7)).toEqual(first);
    const paid = first.filter((choice) => choice === RINSE).length;
    expect(paid).toBeGreaterThan(70);
    expect(paid).toBeLessThan(130);
  });
});

describe("chooseUpgrade", () => {
  const offer: UpgradeOffer = ["raincoats", "secondWind", "bigTipper"];
  const choose = (state: RunState) =>
    chooseUpgrade(
      gameData,
      state,
      cardFor(gameData, state, { kind: "upgradeOffer", offered: offer }),
    );

  it("takes a hearts upgrade when an owner looks upset", () => {
    expect(choose(testState({ biscuit: 6, duchess: 2 }))).toBe(1);
  });

  it("takes a tips upgrade otherwise", () => {
    expect(choose(testState({ biscuit: 6, duchess: 4 }))).toBe(2);
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

describe("treatTarget", () => {
  it("picks the owner with the fewest hearts among those below their max", () => {
    expect(treatTarget(gameData, testState({ biscuit: 3, duchess: 2, koda: 2 }))).toBe("duchess");
    expect(treatTarget(gameData, testState({ duchess: 6, koda: 8 }))).toBe("koda");
    expect(treatTarget(gameData, testState({ duchess: 6 }))).toBeUndefined();
  });
});
