import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { fillNames } from "../lib/lines";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { causeLabel, firedByText } from "./causes";
import { cardFor, firesText } from "./choices";
import { resolveEffects } from "./effects";

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
      { fires: ["koda"], hearts: NOSE_EFFECT, why: "a meter landing on 0" },
      { fires: [], hearts: NOSE_EFFECT + 1, why: "a meter left above 0" },
    ]) {
      const option = cardFor(data, testState({ koda: hearts }), skunk(["koda"])).options.find(
        ({ index }) => index === HOLD_YOUR_NOSE,
      );
      expect(option?.fires).toEqual(fires);
    }
  });

  it("says who fires you in plain words, not as a meter held at 0", () => {
    const option = cardFor(data, testState({ koda: NOSE_EFFECT }), skunk(["koda"])).options.find(
      ({ index }) => index === HOLD_YOUR_NOSE,
    );
    expect(option?.breakdown.map(({ dog, name, text }) => [dog, text, name])).toEqual([
      ["koda", `−${NOSE_EFFECT}♥`, NOSE_NAME],
      ["koda", "", firedByText(data, "koda")],
    ]);
  });
});

describe("firesText", () => {
  it("names each fatal option", () => {
    const [koda, duchess, biscuit] = [owner("koda"), owner("duchess"), owner("biscuit")];
    for (const { dogs, owners } of [
      { dogs: ["koda"], owners: koda },
      { dogs: ["koda", "duchess"], owners: `${koda} and ${duchess}` },
      { dogs: ["koda", "duchess", "biscuit"], owners: `${koda}, ${duchess} and ${biscuit}` },
    ] as const) {
      expect(firesText(data, dogs)).toBe(fillNames(gameData.runText.card.fires, { owners }));
    }
  });
});

describe("causeLabel at a firing", () => {
  it("names the owner who fires you", () => {
    const { changes } = resolveEffects(
      data,
      {
        affected: ["koda"],
        random: () => 0,
        source: { encounter: "skunk", kind: "encounter", option: HOLD_YOUR_NOSE },
      },
      [{ amount: -2, kind: "hearts", target: { kind: "affected" } }],
      testState({ koda: 1 }),
    );
    expect(changes.map((change) => causeLabel(data, change))).toEqual([
      `−1♥, ${firedByText(data, "koda")}`,
    ]);
  });
});
