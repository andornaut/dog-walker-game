import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText } from "../home/home";
import { currentZone, defaultRoute, walkLength } from "../rules/route";
import { cents, read, roundDollars } from "../rules/units";
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
  const pay = read(gameData.tuning, "money", "payPerDog");

  it.each<[string, Readonly<Partial<Record<DogId, number | "fired">>>, number, boolean]>([
    ["at the walk's start, with the bonus", { duchess: 5, zippy: 3 }, 0, true],
    ["mid walk, with the bonus", { duchess: 5, koda: 2, zippy: 3 }, 1, true],
    [
      "with a fired dog, whose pay is not counted, and no bonus",
      { duchess: 5, koda: "fired" },
      1,
      false,
    ],
    ["in the last zone, with no zones left", { zippy: 4 }, zones - 1, true],
  ])("states what going home gives up %s", (_name, slots, zoneIndex, bonus) => {
    const run = testState(slots, { route, zoneIndex });
    const walking = Object.values(slots).filter((hearts) => hearts !== "fired").length;
    const fees = roundDollars(pay * currentZone(gameData, run).fees * walking);
    const left = zones - zoneIndex - 1;
    const named = { fees: dollarText(cents(fees)), zone: currentZone(gameData, run).name };
    expect(homeQuestionNote(gameData, run)).toEqual([
      { kind: "lose", text: fillNames(bonus ? words.loseWithBonus : words.lose, named) },
      ...(left > 0
        ? [{ kind: "zonesLeft", text: fillNames(words.zonesLeft, { count: String(left) }) }]
        : []),
    ]);
  });

  it("gives up only the bonus at a fork, and nothing once an owner has fired you", () => {
    const fork = { route: route.slice(0, 1), zoneIndex: 1 };
    const lines = (slots: Readonly<Partial<Record<DogId, number | "fired">>>) =>
      homeQuestionNote(gameData, testState(slots, fork)).filter(({ kind }) => kind === "lose");
    expect(lines({ duchess: 5 })).toEqual([{ kind: "lose", text: words.loseBonus }]);
    expect(lines({ duchess: 5, koda: "fired" })).toEqual([]);
  });
});
