import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type { DogId, Modifier, PackSize, Size } from "../data/types";
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

  // Every size, with and without the Lucky collar, in a pack of every size, at every hearts
  // from its max down to 0.
  it("shows each dog's mood by its hearts below its max", () => {
    const packSizes: readonly PackSize[] = [1, 2, 3];
    const wrong = (Object.keys(TUNING.hearts.maxBySize) as Size[]).flatMap((size) =>
      GEAR.flatMap(([gear, modifiers]) =>
        packSizes.flatMap((packSize) => {
          const max = maxHearts(TUNING, modifiers, packSize, { size });
          return Array.from({ length: max + 1 }, (_, below) => max - below)
            .filter((hearts) => faceMood(data, max, hearts) !== expected(max, hearts))
            .map((hearts) => `${size}${gear} walking ${packSize} at ${hearts}`);
        }),
      ),
    );
    expect(wrong).toEqual([]);
  });
});

describe("treatRecipient", () => {
  const data = { dogs: DOGS, tuning: TEST_TUNING };
  const ofSize = (size: Size) =>
    (Object.keys(DOGS) as DogId[]).filter((dog) => DOGS[dog].size === size);
  const max = (packSize: PackSize, dog: DogId) => maxHearts(TEST_TUNING, [], packSize, DOGS[dog]);
  const [first, second, third] = ofSize("medium") as [DogId, DogId, DogId];
  const [small] = ofSize("small") as [DogId];
  const [big] = ofSize("big") as [DogId];

  // Each pack in front-to-back order, each owner's hearts given as how many below their max.
  const cases: [string, [DogId, number][], DogId, DogId][] = [
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
  ];

  it("gives the treat to its own owner, else the neediest owner below their max", () => {
    for (const [name, pack, touched, expected] of cases) {
      const run = testState(
        Object.fromEntries(
          pack.map(([dog, below]) => [dog, max(pack.length as PackSize, dog) - below]),
        ),
      );
      expect(treatRecipient(data, run, touched), name).toBe(expected);
    }
  });
});
