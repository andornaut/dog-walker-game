import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { DogId } from "../data/types";
import type { RunState } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { faceMood, giveTreat } from "./treats";

const tuning = {
  ...TEST_TUNING,
  hearts: { ...TEST_TUNING.hearts, faceHappyFrom: 6, faceNeutralFrom: 3, treat: 1 },
};
const data = { dogs: DOGS, tuning };

describe("giveTreat", () => {
  it("raises the dog's owner by one heart and uses up a treat", () => {
    const { state } = giveTreat(data, "koda", testState({ duchess: 3, koda: 4 }, { treats: 2 }));
    expect(heartsByDog(state)).toEqual({ duchess: 3, koda: 5 });
    expect(state.treats).toBe(1);
  });

  it("counts double for a dramatic owner", () => {
    const { change, state } = giveTreat(data, "nugget", testState({ nugget: 2 }, { treats: 1 }));
    expect(heartsByDog(state)).toEqual({ nugget: 4 });
    expect(change?.causes).toEqual([
      { amount: 1, kind: "treat" },
      { amount: 1, kind: "temperament", temperament: "dramatic" },
    ]);
  });

  it.each<[string, DogId, RunState]>([
    ["without a treat", "koda", testState({ koda: 4 }, { treats: 0 })],
    [
      "keeping the treat, for an owner at their max",
      "duchess",
      testState({ duchess: 6 }, { treats: 1 }),
    ],
    ["for a fired owner's dog", "koda", testState({ duchess: 3, koda: "fired" }, { treats: 1 })],
    ["for a dog not in the pack", "biscuit", testState({ duchess: 3 }, { treats: 1 })],
  ])("does nothing %s", (_, dog, before) => {
    expect(giveTreat(data, dog, before)).toEqual({ change: null, state: before });
  });
});

describe("faceMood", () => {
  it("is happy from faceHappyFrom, neutral from faceNeutralFrom, and upset below", () => {
    expect([7, 6, 5, 3, 2, 0].map((hearts) => faceMood({ tuning }, hearts))).toEqual([
      "happy",
      "happy",
      "neutral",
      "neutral",
      "upset",
      "upset",
    ]);
  });
});
