import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
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
    const state = giveTreat(data, "koda", testState({ duchess: 3, koda: 4 }, { treats: 2 }));
    expect(heartsByDog(state)).toEqual({ duchess: 3, koda: 5 });
    expect(state.treats).toBe(1);
  });

  it("counts double for a dramatic owner", () => {
    const state = giveTreat(data, "nugget", testState({ nugget: 2 }, { treats: 1 }));
    expect(heartsByDog(state)).toEqual({ nugget: 4 });
  });

  it("does nothing without a treat", () => {
    const before = testState({ koda: 4 }, { treats: 0 });
    expect(giveTreat(data, "koda", before)).toBe(before);
  });

  it("keeps the treat when the owner is already at their max", () => {
    const before = testState({ duchess: 6 }, { treats: 1 });
    expect(giveTreat(data, "duchess", before)).toBe(before);
  });

  it("does nothing for a dog that is not walking", () => {
    const before = testState({ duchess: 3, koda: "fired" }, { treats: 1 });
    expect(giveTreat(data, "koda", before)).toBe(before);
    expect(giveTreat(data, "biscuit", before)).toBe(before);
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
