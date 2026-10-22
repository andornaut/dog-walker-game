import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText } from "../home/home";
import { fillNames } from "../lib/lines";
import { currentZone, defaultRoute, walkLength } from "../rules/route";
import { cents, read, roundDollars } from "../rules/units";
import { testState } from "../testing/runState";
import { homeQuestionNote } from "./homeQuestion";

type Slots = Readonly<Partial<Record<DogId, number | "fired">>>;

describe("homeQuestionNote", () => {
  const words = gameData.runText.homeQuestion;
  const zones = walkLength(gameData);
  const route = defaultRoute(gameData, zones);
  const pay = read(gameData.tuning, "money", "payPerDog");

  it("states the walking dogs' fees, any bonus and the zones left that going home gives up", () => {
    const cases: [Slots, number, boolean][] = [
      [{ duchess: 5, koda: 2, zippy: 3 }, 1, true],
      [{ duchess: 5, koda: "fired" }, 1, false],
      [{ zippy: 4 }, zones - 1, true],
    ];
    for (const [slots, zoneIndex, bonus] of cases) {
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
    }
  });

  it("gives up only the bonus at a fork, and nothing once an owner has fired you", () => {
    const fork = { route: route.slice(0, 1), zoneIndex: 1 };
    const lines = (slots: Slots) =>
      homeQuestionNote(gameData, testState(slots, fork)).filter(({ kind }) => kind === "lose");
    expect(lines({ duchess: 5 })).toEqual([{ kind: "lose", text: words.loseBonus }]);
    expect(lines({ duchess: 5, koda: "fired" })).toEqual([]);
  });
});
