import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { DogId, Size } from "../data/types";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts } from "./dogs";
import { faceMood, treatRecipient } from "./treats";

describe("faceMood", () => {
  const { faceHappyWithin, faceNeutralFrom, maxBySize } = TEST_TUNING.hearts;
  const data = { tuning: TEST_TUNING };

  // Every size's max, and hearts placed against the happy and neutral edges.
  it.each(
    Object.entries(maxBySize).flatMap(([size, max]) => {
      const happyFrom = max - faceHappyWithin;
      return [
        [size, max, max, "happy"],
        [size, max, happyFrom, "happy"],
        [size, max, happyFrom - 1, happyFrom - 1 >= faceNeutralFrom ? "neutral" : "upset"],
        [size, max, faceNeutralFrom, faceNeutralFrom >= happyFrom ? "happy" : "neutral"],
        [size, max, faceNeutralFrom - 1, "upset"],
        [size, max, 0, "upset"],
      ] as const;
    }),
  )("shows a %s dog (max %i) at %i hearts as %s", (_, max, hearts, mood) => {
    expect(faceMood(data, max, hearts)).toBe(mood);
  });
});

describe("treatRecipient", () => {
  const data = { dogs: DOGS, tuning: TEST_TUNING };
  const ofSize = (size: Size) =>
    (Object.keys(DOGS) as DogId[]).filter((dog) => DOGS[dog].size === size);
  const max = (dog: DogId) => maxHearts(TEST_TUNING, [], DOGS[dog]);
  const [first, second, third] = ofSize("medium") as [DogId, DogId, DogId];
  const [small] = ofSize("small") as [DogId];
  const [big] = ofSize("big") as [DogId];

  // Each pack in front-to-back order, each owner's hearts given as how many below their max.
  it.each<[string, [DogId, number][], DogId, DogId]>([
    [
      "its own owner below their max",
      [
        [first, 0],
        [second, 1],
        [third, 2],
      ],
      second,
      second,
    ],
    [
      "the owner with the fewest hearts",
      [
        [first, 0],
        [second, 1],
        [third, 2],
      ],
      first,
      third,
    ],
    [
      "the dog nearer the front on a tie",
      [
        [first, 0],
        [second, 1],
        [third, 1],
      ],
      first,
      second,
    ],
    [
      "the touched dog with every owner at their max",
      [
        [first, 0],
        [second, 0],
      ],
      second,
      second,
    ],
    [
      "an owner below their max over a full one with fewer",
      [
        [big, 0],
        [small, 0],
        [first, 1],
      ],
      big,
      first,
    ],
  ])("gives the treat to %s", (_, pack, touched, expected) => {
    const run = testState(Object.fromEntries(pack.map(([dog, below]) => [dog, max(dog) - below])));
    expect(treatRecipient(data, run, touched)).toBe(expected);
  });
});
