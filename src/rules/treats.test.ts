import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type { DogId, Modifier, Size } from "../data/types";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts } from "./dogs";
import { modifiersOf } from "./modifiers";
import { type FaceMood, faceMood, treatRecipient } from "./treats";

describe("faceMood", () => {
  const { faceHappyWithin, faceNeutralFrom } = TUNING.hearts;
  const data = { tuning: TUNING };
  const collar = modifiersOf(SHOP_GEAR.luckyCollar.effects);
  const GEAR: readonly (readonly [string, readonly Modifier[]])[] = [
    ["", []],
    [" with the Lucky collar", collar],
  ];
  // Upset below faceNeutralFrom; neutral at it, which wins over happy; happy within
  // faceHappyWithin of max; neutral between.
  const expected = (max: number, hearts: number): FaceMood => {
    if (hearts < faceNeutralFrom) {
      return "upset";
    }
    if (hearts === faceNeutralFrom) {
      return "neutral";
    }
    return max - hearts <= faceHappyWithin ? "happy" : "neutral";
  };

  // Every size, with and without the Lucky collar, at every hearts from its max down to 0.
  it.each(
    (Object.keys(TUNING.hearts.maxBySize) as Size[]).flatMap((size) =>
      GEAR.flatMap(([gear, modifiers]) => {
        const max = maxHearts(TUNING, modifiers, { size });
        return Array.from(
          { length: max + 1 },
          (_, below) => [size + gear, max, max - below] as const,
        );
      }),
    ),
  )("shows a %s dog (max %i) at %i hearts as its mood", (_, max, hearts) => {
    expect(faceMood(data, max, hearts)).toBe(expected(max, hearts));
  });

  it("raises the max with the Lucky collar", () => {
    expect(maxHearts(TUNING, collar, { size: "small" })).toBeGreaterThan(
      maxHearts(TUNING, [], { size: "small" }),
    );
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
