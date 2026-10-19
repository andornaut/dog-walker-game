import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { causeLabel } from "./causes";
import { cardFor, firesText } from "./choices";
import { resolveEffects } from "./effects";

const data = { ...gameData, tuning: TEST_TUNING };
// Skunk's "Hold your nose": −2 ♥ to each dog caught.
const HOLD_YOUR_NOSE = 2;

const skunk = (affected: DogId[]): CardSource => ({
  affected,
  encounter: "skunk",
  kind: "encounter",
});

describe("an option that would fire an owner", () => {
  it.each([
    { fires: ["koda"], hearts: { koda: 1 }, why: "a meter cut short at 0" },
    { fires: ["koda"], hearts: { koda: 2 }, why: "a meter landing on 0" },
    { fires: [], hearts: { koda: 3 }, why: "a meter left above 0" },
  ] as const)("is flagged for $why", ({ fires, hearts }) => {
    const option = cardFor(data, testState(hearts), skunk(["koda"])).options.find(
      ({ index }) => index === HOLD_YOUR_NOSE,
    );
    expect(option?.fires).toEqual(fires);
  });

  it("says who fires you in plain words, not as a meter held at 0", () => {
    const option = cardFor(data, testState({ koda: 1 }), skunk(["koda"])).options.find(
      ({ index }) => index === HOLD_YOUR_NOSE,
    );
    expect(option?.breakdown.map(({ dog, name, text }) => [dog, text, name])).toEqual([
      ["koda", "−2 ♥", "Hold your nose"],
      ["koda", "", "Jesse fires you"],
    ]);
  });
});

describe("firesText", () => {
  it.each([
    { dogs: ["koda"], text: "Fires Jesse" },
    { dogs: ["koda", "duchess"], text: "Fires Jesse and Rosa" },
    { dogs: ["koda", "duchess", "biscuit"], text: "Fires Jesse, Rosa and Sam" },
  ] as const)("names $text", ({ dogs, text }) => {
    expect(firesText(data, dogs)).toBe(text);
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
    expect(changes.map((change) => causeLabel(data, change))).toEqual(["−1 ♥, Jesse fires you"]);
  });
});
