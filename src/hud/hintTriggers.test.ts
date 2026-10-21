import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { hintFor } from "../rules/hints";
import { testState } from "../testing/runState";
import {
  cardHintTriggers,
  moverHintTriggers,
  runHintTriggers,
  startHintTriggers,
} from "./hintTriggers";

describe("cardHintTriggers", () => {
  it("raises the fork hint for a fork, and the encounter's and the card's for an encounter", () => {
    expect(cardHintTriggers({ kind: "fork", paths: [], upgrades: [] })).toEqual([{ kind: "fork" }]);
    expect(cardHintTriggers({ affected: ["koda"], encounter: "skunk", kind: "encounter" })).toEqual(
      [{ encounter: "skunk", kind: "encounter" }, { kind: "card" }],
    );
  });
});

describe("moverHintTriggers", () => {
  it("raises the cue hint for an arrow, and none for no cue or the wander mark", () => {
    expect(moverHintTriggers(null)).toEqual([]);
    expect(moverHintTriggers({ direction: 1, kind: "across" })).toEqual([{ kind: "moverCue" }]);
    expect(moverHintTriggers({ kind: "up" })).toEqual([{ kind: "moverCue" }]);
    expect(moverHintTriggers({ kind: "wander" })).toEqual([]);
  });

  it("raises a hint that the data has, said once", () => {
    const [trigger] = moverHintTriggers({ kind: "down" });
    const hint = trigger === undefined ? null : hintFor(gameData, [], trigger);
    expect(hint).not.toBeNull();
    expect(hint === null ? null : hintFor(gameData, [hint.id], { kind: "moverCue" })).toBeNull();
  });
});

describe("runHintTriggers", () => {
  it("raises the fired-owner hint for an owner at 1 heart, not a calm walk or a fired owner", () => {
    const kinds = (run: ReturnType<typeof testState>) =>
      runHintTriggers(run).map(({ kind }) => kind);
    expect(kinds(testState({ biscuit: 5, duchess: 5, koda: 5 }))).toEqual([]);
    expect(kinds(testState({ duchess: 5, koda: 1 }))).toEqual(["firedOwner"]);
    expect(kinds(testState({ duchess: 5, koda: "fired" }))).toEqual([]);
  });
});

describe("startHintTriggers", () => {
  const { packSizeBonus } = gameData.tuning.hearts;

  it.each([
    ["a lone dog", testState({ koda: 5 }), packSizeBonus[1]],
    ["a pair", testState({ duchess: 5, koda: 5 }), packSizeBonus[2]],
    ["a full pack", testState({ biscuit: 5, duchess: 5, koda: 5 }), packSizeBonus[3]],
  ])(
    "raises the pack-bonus hint for %s only when its lead's owner gets a bonus",
    (_, run, bonus) => {
      expect(startHintTriggers(gameData.tuning, run)).toEqual(
        bonus > 0 ? [{ kind: "packBonus" }] : [],
      );
    },
  );
});
