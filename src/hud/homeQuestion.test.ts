import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText } from "../home/home";
import { fillNames } from "../lib/lines";
import { currentZone, defaultRoute, walkLength } from "../rules/route";
import { cents, read } from "../rules/units";
import { testState } from "../testing/runState";
import { homeQuestionNote } from "./homeQuestion";

type Slots = Readonly<Partial<Record<DogId, number | "fired">>>;

describe("homeQuestionNote", () => {
  const words = gameData.runText.homeQuestion;
  const zones = walkLength(gameData);
  const route = defaultRoute(gameData, zones);
  const pay = read(gameData.tuning, "money", "payPerDog");

  it.each([
    ["three dogs walking", { duchess: 5, kilo: 2, zippy: 3 }, 1],
    ["one dog walking of two", { duchess: 5, kilo: "fired" }, 1],
    ["a lone dog in the last zone", { zippy: 4 }, zones - 1],
  ] satisfies [string, Slots, number][])(
    "states the zone's pay and the zones left that going home gives up: %s",
    (_name, slots, zoneIndex) => {
      const run = testState(slots, { route, zoneIndex });
      const walking = Object.values(slots).filter((hearts) => hearts !== "fired").length;
      const left = zones - zoneIndex - 1;
      const named = {
        fees: dollarText(cents(pay * walking)),
        zone: currentZone(gameData, run).name,
      };
      expect(homeQuestionNote(gameData, run)).toEqual([
        { kind: "lose", text: fillNames(words.lose, named) },
        ...(left > 0
          ? [{ kind: "zonesLeft", text: fillNames(words.zonesLeft, { count: String(left) }) }]
          : []),
      ]);
    },
  );

  it.each([
    ["a full pack", { duchess: 5 }],
    ["an owner who fired you", { duchess: 5, kilo: "fired" }],
  ] satisfies [string, Slots][])("gives up nothing at a fork, with %s", (_name, slots) => {
    const fork = { route: route.slice(0, 1), zoneIndex: 1 };
    const lines = homeQuestionNote(gameData, testState(slots, fork));
    expect(lines.filter(({ kind }) => kind === "lose")).toEqual([]);
  });
});
