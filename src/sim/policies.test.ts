import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { CardOptions, CardSource, EncounterId } from "../data/types";
import { type Random, seededRandom } from "../lib/random";
import { cents } from "../lib/units";
import { cardFor } from "../rules/choices";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import {
  chooseCardOption,
  choosePath,
  LOW_HEARTS,
  MIXED_PAY_SHARE,
  pickCardOption,
  type PolicyId,
} from "./policies";

// The thief's card less its debuff option: a money option and a hearts option, and no debuff.
const THIEF: CardSource = { affected: ["ginger"], encounter: "thief", kind: "encounter" };
const THIEF_OPTIONS = ((): CardOptions => {
  const { resolution } = gameData.encounters.thief;
  const options = resolution.kind === "card" ? resolution.options : [];
  const [first, second] = options.filter(({ effects }) =>
    effects.every(({ kind }) => kind !== "debuff"),
  );
  if (first === undefined || second === undefined) {
    throw new Error("The thief has no two options without a debuff");
  }
  return [first, second];
})();
const NO_DEBUFF_DATA = ((): typeof gameData => {
  const thief = gameData.encounters.thief;
  if (thief.kind !== "obstacle" || !("hitLabel" in thief)) {
    throw new Error("The thief opens no card");
  }
  const resolution = { kind: "card", options: THIEF_OPTIONS } as const;
  return { ...gameData, encounters: { ...gameData.encounters, thief: { ...thief, resolution } } };
})();
const PAY = THIEF_OPTIONS.findIndex(({ effects }) => effects.some(({ kind }) => kind === "money"));
const HEARTS = THIEF_OPTIONS.findIndex(({ effects }) =>
  effects.some(({ kind }) => kind === "hearts"),
);
// What the hearts option costs Ginger's owner. At SAFE hearts it leaves the owner above
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
  return chooseCardOption(
    NO_DEBUFF_DATA,
    random,
    policy,
    state,
    cardFor(NO_DEBUFF_DATA, state, THIEF),
  );
}

describe("chooseCardOption", () => {
  it("takes each policy's option at safe and low hearts", () => {
    for (const [policy, hearts, expected] of [
      ["heartsUnlessLow", SAFE, HEARTS],
      ["heartsUnlessLow", LOW, PAY],
      ["alwaysHearts", LOW, HEARTS],
      ["alwaysPay", SAFE, PAY],
    ] as const) {
      const state = testState({ ginger: hearts }, { money: cents(5000) });

      expect(thiefChoice(policy, state)).toBe(expected);
    }
  });

  it("takes hearts when no money option is affordable", () => {
    const state = testState({ ginger: SAFE }, { money: cents(0) });

    expect(thiefChoice("heartsUnlessLow", state)).toBe(HEARTS);
    expect(thiefChoice("alwaysPay", state)).toBe(HEARTS);
  });

  // A card with Hall pass's Skip: the encounter, the policy and the owner's hearts, and
  // whether the policy's pick costs hearts or a debuff, so the policy walks on by.
  it.each([
    ["thief", "heartsUnlessLow", SAFE, "skip"],
    ["thief", "alwaysPay", SAFE, PAY],
    ["otherDog", "alwaysHearts", SAFE, "skip"],
  ] as const)(
    "on a %s card, %s at %i hearts takes %s with Hall pass",
    (encounter, policy, hearts, expected) => {
      const state = testState(
        { ginger: hearts },
        { money: cents(5000), skipPass: { gear: "hallPass", kind: "gear" } },
      );
      const source: CardSource = { affected: ["ginger"], encounter, kind: "encounter" };

      expect(
        chooseCardOption(
          NO_DEBUFF_DATA,
          NO_DRAWS,
          policy,
          state,
          cardFor(NO_DEBUFF_DATA, state, source),
        ),
      ).toBe(expected);
    },
  );
});

describe("the mixed policy", () => {
  const rich = (hearts: number) => testState({ ginger: hearts }, { money: cents(5000) });

  it("pays for the cheapest safe option on a draw below the pay share, else takes hearts", () => {
    expect(thiefChoice("mixed", rich(SAFE), () => MIXED_PAY_SHARE - 0.01)).toBe(PAY);
    expect(thiefChoice("mixed", rich(SAFE), () => MIXED_PAY_SHARE)).toBe(HEARTS);
  });

  it("keeps heartsUnlessLow's guard, and takes hearts with nothing affordable, without drawing", () => {
    expect(thiefChoice("mixed", rich(LOW))).toBe(PAY);
    expect(thiefChoice("mixed", testState({ ginger: SAFE }, { money: cents(0) }))).toBe(HEARTS);
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

// A card with a debuff option, a money option and a hearts option, each of one effect.
// At TRIPLE_SAFE hearts the hearts option is safe; at one fewer it is not.
const [TRIPLE, TRIPLE_OPTIONS, TRIPLE_SAFE] = (() => {
  const onlyOf = (kind: string) => (option: { readonly effects: readonly { kind: string }[] }) =>
    option.effects.length === 1 && option.effects[0]?.kind === kind;
  for (const [encounter, { resolution }] of Object.entries(gameData.encounters)) {
    if (
      resolution.kind === "card" &&
      ["debuff", "money", "hearts"].every((kind) => resolution.options.some(onlyOf(kind)))
    ) {
      const index = (kind: string) => resolution.options.findIndex(onlyOf(kind));
      const options = { debuff: index("debuff"), hearts: index("hearts"), pay: index("money") };
      const effect = resolution.options[options.hearts]?.effects[0];
      const lost = effect?.kind === "hearts" ? -effect.amount : 0;
      return [encounter as EncounterId, options, LOW_HEARTS + lost + 1] as const;
    }
  }
  throw new Error("No card has a debuff, a money and a hearts option");
})();

describe("the debuff policies", () => {
  // A card with each kind of option: the policy, the owner's hearts and cash, the draw (null for
  // none), and the kind of option taken.
  it.each([
    ["alwaysHearts", TRIPLE_SAFE, 5000, null, "debuff"],
    ["debuffs", TRIPLE_SAFE, 5000, null, "debuff"],
    ["debuffs", TRIPLE_SAFE - 1, 0, null, "debuff"],
    ["noDebuffs", TRIPLE_SAFE, 5000, MIXED_PAY_SHARE - 0.01, "pay"],
    ["noDebuffs", TRIPLE_SAFE, 5000, MIXED_PAY_SHARE, "hearts"],
    ["noDebuffs", TRIPLE_SAFE, 0, null, "hearts"],
    ["noDebuffs", TRIPLE_SAFE - 1, 5000, null, "pay"],
    ["noDebuffs", TRIPLE_SAFE - 1, 0, null, "debuff"],
  ] as const)(
    "%s at %i hearts with %i cents, drawing %s, takes the %s option",
    (policy, hearts, money, draw, expected) => {
      const state = testState({ ginger: hearts }, { money: cents(money) });
      const source: CardSource = { affected: ["ginger"], encounter: TRIPLE, kind: "encounter" };
      const random = draw === null ? NO_DRAWS : () => draw;

      expect(
        chooseCardOption(gameData, random, policy, state, cardFor(gameData, state, source)),
      ).toBe(TRIPLE_OPTIONS[expected]);
    },
  );

  // A card with no debuff option: the policy, the draw and the option the mixed policy takes,
  // each policy on one side of the pay share.
  it.each([
    ["debuffs", MIXED_PAY_SHARE - 0.01, PAY],
    ["noDebuffs", MIXED_PAY_SHARE, HEARTS],
  ] as const)(
    "%s plays as mixed on a card with no debuff, drawing %s",
    (policy, draw, expected) => {
      const state = testState({ ginger: SAFE }, { money: cents(5000) });

      expect(thiefChoice(policy, state, () => draw)).toBe(expected);
    },
  );
});

// Whether a policy fell back from its own rule: the policy, the card, the owner's hearts and
// cash, and the result (null for a policy with no fallback). Each draw takes the money option.
describe("pickCardOption", () => {
  it.each([
    ["heartsUnlessLow", "triple", TRIPLE_SAFE, 5000, null],
    ["mixed", "triple", TRIPLE_SAFE, 5000, null],
    ["debuffs", "triple", TRIPLE_SAFE, 5000, false],
    ["debuffs", "thief", SAFE, 5000, true],
    ["noDebuffs", "triple", TRIPLE_SAFE, 5000, false],
    ["noDebuffs", "triple", TRIPLE_SAFE - 1, 5000, false],
    ["noDebuffs", "triple", TRIPLE_SAFE - 1, 0, true],
  ] as const)(
    "%s on the %s card at %i hearts with %i cents fell back: %s",
    (policy, card, hearts, money, expected) => {
      const state = testState({ ginger: hearts }, { money: cents(money) });
      const data = card === "thief" ? NO_DEBUFF_DATA : gameData;
      const encounter = card === "thief" ? "thief" : TRIPLE;
      const source: CardSource = { affected: ["ginger"], encounter, kind: "encounter" };
      const view = cardFor(data, state, source);

      expect(pickCardOption(data, () => 0, policy, state, view).fellBack).toBe(expected);
    },
  );
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
