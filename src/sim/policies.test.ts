import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cardFor } from "../rules/choices";
import { cents } from "../rules/units";
import type { CardSource, RunState, UpgradeOffer } from "../state/runState";
import { testState } from "../testing/runState";
import { chooseCardOption, chooseUpgrade, type PolicyId, treatTarget } from "./policies";

const SKUNK: CardSource = { affected: ["duchess"], encounter: "skunk", kind: "encounter" };
const RINSE = 1;
const IGNORE = 2;

function skunkChoice(policy: PolicyId, state: RunState) {
  return chooseCardOption(gameData, policy, state, cardFor(gameData, state, SKUNK));
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
      return chooseCardOption(gameData, "heartsUnlessLow", state, cardFor(gameData, state, source));
    };

    expect(choose(5)).toBe(1);
    expect(choose(2)).toBe(0);
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

describe("treatTarget", () => {
  it("picks the owner with the fewest hearts among those below their max", () => {
    expect(treatTarget(gameData, testState({ biscuit: 3, duchess: 2, koda: 2 }))).toBe("duchess");
    expect(treatTarget(gameData, testState({ duchess: 6, koda: 8 }))).toBe("koda");
    expect(treatTarget(gameData, testState({ duchess: 6 }))).toBeUndefined();
  });
});
