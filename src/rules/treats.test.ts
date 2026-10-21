import { describe, expect, it } from "vitest";

import { TEST_TUNING } from "../testing/tuning";
import { faceMood } from "./treats";

describe("faceMood", () => {
  const { faceHappyFrom, faceNeutralFrom } = TEST_TUNING.hearts;

  it.each([
    [faceHappyFrom + 1, "happy"],
    [faceHappyFrom, "happy"],
    [faceHappyFrom - 1, faceHappyFrom - 1 >= faceNeutralFrom ? "neutral" : "upset"],
    [faceNeutralFrom, "neutral"],
    [faceNeutralFrom - 1, "upset"],
    [0, "upset"],
  ])("shows %i hearts as %s", (hearts, mood) => {
    expect(faceMood({ tuning: TEST_TUNING }, hearts)).toBe(mood);
  });
});
