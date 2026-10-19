import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HOME_QUESTION_ANSWERS } from "./pauseMenu";

describe("the Home button's answers", () => {
  it("put Keep walking first, as the primary and key 1, then Head home", () => {
    const question = gameData.runText.homeQuestion;
    expect(HOME_QUESTION_ANSWERS.map((answer) => question[answer])).toEqual([
      question.keepWalking,
      question.headHome,
    ]);
  });
});
