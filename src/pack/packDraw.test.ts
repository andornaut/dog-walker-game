import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { END_LAYOUT } from "../home/endLayout";
import { HOME_LAYOUT } from "../home/homeLayout";
import { everyPack, formationOrder, packDogOf, packPlacements } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import { walkProjection } from "../runner/walkGeometry";
import { type Feet, packLayers, type StandingDog } from "./packDraw";

const PROJECTION = walkProjection(ROAD_CAMERA, screenLayout(SCREEN_CONFIG).road);
const WALKER: Feet = { footY: 100, x: 180 };

// Each dog standing at its placement from the walker's feet.
function standAt(dogs: readonly DogId[], placements: readonly { dx: number; footDy: number }[]) {
  return dogs.map((dog, rank): StandingDog => {
    const placement = itemAt(placements, rank);
    const feet = { footY: WALKER.footY + placement.footDy, x: WALKER.x + placement.dx };
    return { dog, feet, placement, rank };
  });
}

const returnHome = END_LAYOUT.returnHome;
// A pack as large as any screen stands.
const FULL_PACK = formationOrder(
  itemAt(
    everyPack().filter((pack) => pack.length === HOME_LAYOUT.gateSpots.length),
    0,
  ),
);
// Each screen's stands of the pack: the walk's every formation, the gate's and the walk home's
// full pack.
const STANDS: [string, StandingDog[][]][] = [
  [
    "the walk",
    everyPack().map((pack) => {
      const dogs = formationOrder(pack);
      return standAt(dogs, packPlacements(PROJECTION, dogs.map(packDogOf)));
    }),
  ],
  ["the start screen's gate", [standAt(FULL_PACK, HOME_LAYOUT.gateSpots)]],
  [
    "the end screen's walk home",
    [
      standAt(
        FULL_PACK,
        returnHome.dogs.map(({ x, y }) => ({
          dx: x - returnHome.walker.x,
          footDy: y - returnHome.walker.y,
        })),
      ),
    ],
  ],
];

describe("packLayers", () => {
  it.each(STANDS)("draws %s's dogs, then the leashes, then the walker", (_, stands) => {
    for (const dogs of stands) {
      expect(packLayers(WALKER, dogs).map(({ layer }) => layer.kind)).toEqual([
        ...dogs.map(() => "dog"),
        "leash",
        "walker",
      ]);
    }
  });
});
