import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText } from "../home/home";
import { fillNames } from "../lib/lines";
import { cents } from "../lib/units";
import { currentZone, defaultRoute, walkLength } from "../rules/route";
import { read } from "../rules/units";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { homeQuestionNote, pauseNote } from "./homeQuestion";

type Slots = Readonly<Partial<Record<DogId, number | "fired">>>;

const zones = walkLength(gameData);
const route = defaultRoute(gameData, zones);
const pay = read(gameData.tuning, "money", "payPerDog");
const tip = read(gameData.tuning, "money", "tip");
// The money at the last zone's end: a zone's pay for a pack of three.
const zoneEnd = cents(3 * pay);
// A run holding money, more than its last zone's end money once tips are earned, less once card
// costs spent below it.
const holding = (money: number): Partial<RunState> => ({
  money: cents(money),
  zoneEndMoney: zoneEnd,
});

describe("homeQuestionNote", () => {
  const words = gameData.runText.homeQuestion;

  it.each([
    ["three dogs walking, nothing earned yet", { buddy: 3, ginger: 5, kilo: 2 }, 1, zoneEnd],
    ["three dogs walking, with tips earned", { buddy: 3, ginger: 5, kilo: 2 }, 1, zoneEnd + tip],
    ["one dog walking of two, with tips earned", { ginger: 5, kilo: "fired" }, 1, zoneEnd + tip],
    ["card costs spent below the last zone's end money", { buddy: 3 }, 1, zoneEnd - tip],
    ["a lone dog in the last zone, with tips earned", { buddy: 4 }, zones - 1, zoneEnd + tip],
  ] satisfies [string, Slots, number, number][])(
    "states what the zone has earned and the zones left that going home gives up: %s",
    (_name, slots, zoneIndex, money) => {
      const run = testState(slots, { ...holding(money), route, zoneIndex });
      const walking = Object.values(slots).filter((hearts) => hearts !== "fired").length;
      const earned = Math.max(0, money - zoneEnd);
      const left = zones - zoneIndex - 1;
      const named = {
        lost: dollarText(cents(earned + pay * walking)),
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
    ["a full pack", { ginger: 5 }],
    ["an owner who fired you", { ginger: 5, kilo: "fired" }],
  ] satisfies [string, Slots][])("gives up nothing at a fork, with %s", (_name, slots) => {
    const fork = { ...holding(zoneEnd), route: route.slice(0, 1), zoneIndex: 1 };
    const lines = homeQuestionNote(gameData, testState(slots, fork));
    expect(lines.filter(({ kind }) => kind === "lose")).toEqual([]);
  });
});

describe("pauseNote", () => {
  const words = gameData.menuText.pause;

  it.each([
    ["with nothing earned since the last zone's end", zoneEnd],
    ["after card costs spent below the last zone's end money", zoneEnd - tip],
  ])("says Head home keeps all the cash %s", (_name, money) => {
    const run = testState({ ginger: 5 }, holding(money));
    expect(pauseNote(gameData, run)).toBe(
      fillNames(words.noteAll, { cash: dollarText(cents(money)) }),
    );
  });

  it("says how much of the cash Head home keeps once the zone has earned some", () => {
    const run = testState({ ginger: 5 }, holding(zoneEnd + tip));
    expect(pauseNote(gameData, run)).toBe(
      fillNames(words.note, { cash: dollarText(run.money), kept: dollarText(zoneEnd) }),
    );
  });
});
