import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type { DogId, Modifier, Size } from "../data/types";
import { keysOf } from "../lib/records";
import { PACK_PLACES, placeName } from "../testing/packPlaces";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts, packPlace } from "./dogs";
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
  // Happy at max; below it, upset below faceNeutralFrom; neutral at it, which wins over happy;
  // happy within faceHappyWithin of max; neutral between.
  const expected = (max: number, hearts: number): FaceMood => {
    if (hearts >= max) {
      return "happy";
    }
    if (hearts < faceNeutralFrom) {
      return "upset";
    }
    if (hearts === faceNeutralFrom) {
      return "neutral";
    }
    return max - hearts <= faceHappyWithin ? "happy" : "neutral";
  };

  // Every max from 1 to the owner cap, at every hearts from it down to 0.
  const maxes = Array.from({ length: TUNING.hearts.maxOwnerHearts }, (_, i) => i + 1);
  it.each(maxes)("shows a face's mood by its hearts below a max of %i", (max) => {
    const wrong = Array.from({ length: max + 1 }, (_, below) => max - below).filter(
      (hearts) => faceMood(data, max, hearts) !== expected(max, hearts),
    );
    expect(wrong).toEqual([]);
    expect(faceMood(data, max, max)).toBe("happy");
  });

  // Every size, with and without the Lucky collar, in a pack of every size: its max is one the
  // table above covers.
  it("gives every owner a max within the owner cap", () => {
    const outside = keysOf(TUNING.hearts.maxBySize).flatMap((size) =>
      GEAR.flatMap(([gear, modifiers]) =>
        PACK_PLACES.filter(
          (place) => !maxes.includes(maxHearts(TUNING, modifiers, place, { size })),
        ).map((place) => `${size}${gear} ${placeName(place)}`),
      ),
    );
    expect(outside).toEqual([]);
  });
});

describe("treatRecipient", () => {
  const data = { dogs: DOGS, tuning: TEST_TUNING };
  const ofSize = (size: Size) => keysOf(DOGS).filter((dog) => DOGS[dog].size === size);
  const max = (order: readonly DogId[], dog: DogId) =>
    maxHearts(TEST_TUNING, [], packPlace(order, dog), DOGS[dog]);
  const [first, second, third] = ofSize("medium") as [DogId, DogId, DogId];
  const [small] = ofSize("small") as [DogId];
  const [large] = ofSize("large") as [DogId];

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
        [large, 0],
        [small, 0],
        [first, 1],
      ],
      large,
      first,
    ],
  ];

  it("gives the treat to its own owner, else the neediest owner below their max", () => {
    for (const [name, pack, touched, expected] of cases) {
      const run = testState(
        Object.fromEntries(
          pack.map(([dog, below]) => [
            dog,
            max(
              pack.map(([each]) => each),
              dog,
            ) - below,
          ]),
        ),
      );
      expect(treatRecipient(data, run, touched), name).toBe(expected);
    }
  });
});
