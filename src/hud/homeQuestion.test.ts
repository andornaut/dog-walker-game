import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText } from "../home/home";
import { currentZone, defaultRoute, walkLength } from "../rules/route";
import { payZoneFees } from "../rules/run";
import { cents } from "../rules/units";
import { testState } from "../testing/runState";
import { fillNames } from "../text/lines";
import { homeQuestionNote } from "./homeQuestion";
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

describe("homeQuestionNote", () => {
  const words = gameData.runText.homeQuestion;
  const zones = walkLength(gameData);
  const route = defaultRoute(zones);

  it.each<[string, Readonly<Partial<Record<DogId, number | "fired">>>, number, number]>([
    ["at the walk's start", { duchess: 5, zippy: 3 }, 0, 0],
    ["mid walk, with money banked", { duchess: 5, koda: 2, zippy: 3 }, 1, 31_250],
    ["with a fired dog, whose fee is not counted", { duchess: 5, koda: "fired" }, 1, 12_000],
    ["in the last zone, with no zones left", { zippy: 4 }, zones - 1, 50_000],
  ])("states what going home keeps and gives up %s", (_name, slots, zoneIndex, money) => {
    const run = testState(slots, { money: cents(money), route, zoneIndex });
    const paid = payZoneFees(gameData, run).changes.reduce((sum, change) => sum + change.amount, 0);
    const left = zones - zoneIndex - 1;
    expect(homeQuestionNote(gameData, run)).toEqual([
      { kind: "keep", text: fillNames(words.keep, { money: dollarText(run.money) }) },
      {
        kind: "lose",
        text: fillNames(words.lose, {
          fees: dollarText(cents(paid)),
          zone: currentZone(gameData, run).name,
        }),
      },
      ...(left > 0
        ? [{ kind: "zonesLeft", text: fillNames(words.zonesLeft, { count: String(left) }) }]
        : []),
    ]);
  });
});
