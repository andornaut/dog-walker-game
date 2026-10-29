import { fillNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { CardSource, DogId } from "../data/types";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { firedByText } from "./causes";
import { cardFor, firesText } from "./choices";

const data = { ...gameData, tuning: TEST_TUNING };
// Skunk's hearts option, its name, and what it costs each owner.
const SKUNK_OPTIONS = (() => {
  const { resolution } = gameData.encounters.skunk;
  return resolution.kind === "card" ? resolution.options : [];
})();
const HOLD_YOUR_NOSE = SKUNK_OPTIONS.findIndex(({ effects }) =>
  effects.some((effect) => effect.kind === "hearts"),
);
const NOSE_NAME = SKUNK_OPTIONS[HOLD_YOUR_NOSE]?.name;
const NOSE_EFFECT = (() => {
  const effect = SKUNK_OPTIONS[HOLD_YOUR_NOSE]?.effects.find(({ kind }) => kind === "hearts");
  return effect?.kind === "hearts" ? -effect.amount : 0;
})();
const owner = (dog: DogId) => gameData.dogs[dog].owner.name;

const skunk = (affected: DogId[]): CardSource => ({
  affected,
  encounter: "skunk",
  kind: "encounter",
});

describe("an option that would fire an owner", () => {
  it("flags each option that can fire an owner", () => {
    for (const { fires, hearts } of [
      { fires: ["kilo"], hearts: NOSE_EFFECT, why: "a meter landing on 0" },
      { fires: [], hearts: NOSE_EFFECT + 1, why: "a meter left above 0" },
    ]) {
      const option = cardFor(data, testState({ kilo: hearts }), skunk(["kilo"])).options.find(
        ({ index }) => index === HOLD_YOUR_NOSE,
      );
      expect(option?.fires).toEqual(fires);
    }
  });

  it("says who fires you in plain words, not as a meter held at 0", () => {
    const option = cardFor(data, testState({ kilo: NOSE_EFFECT }), skunk(["kilo"])).options.find(
      ({ index }) => index === HOLD_YOUR_NOSE,
    );
    expect(option?.breakdown.map(({ dog, name, text }) => [dog, text, name])).toEqual([
      ["kilo", `−${NOSE_EFFECT}♥`, NOSE_NAME],
      ["kilo", "", firedByText(data, "kilo")],
    ]);
  });
});

describe("firesText", () => {
  it("names each fatal option", () => {
    const [kilo, ginger, lady] = [owner("kilo"), owner("ginger"), owner("lady")];
    for (const { dogs, owners } of [
      { dogs: ["kilo"], owners: kilo },
      { dogs: ["kilo", "ginger"], owners: `${kilo} and ${ginger}` },
      { dogs: ["kilo", "ginger", "lady"], owners: `${kilo}, ${ginger} and ${lady}` },
    ] as const) {
      expect(firesText(data, dogs)).toBe(fillNames(gameData.runText.card.fires, { owners }));
    }
  });
});
