import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { keysOf } from "../lib/records";
import { testState } from "../testing/runState";
import { hitDog, itemBox, pickupDog } from "./collision";
import { stillInLane } from "./laneMotion";
import { screenRoadGeometry } from "./screenGeometry";
import { isObstacle, itemHeight, obstacleHitBox, packBoxes, type WalkItemKind } from "./walk";
import { walkProjection } from "./walkGeometry";

const DATA = { encounters: ENCOUNTERS, minorObstacles: MINOR_OBSTACLES };
const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const ROAD_VIEW_BOTTOM = LAYOUT.roadView.y + LAYOUT.roadView.height;
// How finely the road's scroll is sampled, in road pixels.
const SCROLL_STEP = 0.25;

const KINDS: readonly WalkItemKind[] = [
  ...keysOf(ENCOUNTERS),
  ...keysOf(MINOR_OBSTACLES),
  "tip",
  "treat",
];
const PACK_SIZES = Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) => i + 1);
const CASES = [...new Set(KINDS)].flatMap((kind) =>
  PACK_SIZES.map((dogs) => [kind, dogs] as const),
);

describe("screenRoadGeometry", () => {
  it("hits every item only while its far edge is drawn in view, not below any pack", () => {
    for (const [kind, dogs] of CASES) {
      const slots = Object.fromEntries(
        keysOf(gameData.dogs)
          .slice(0, dogs)
          .map((dog) => [dog, 3]),
      );
      const run = testState(slots);
      const geometry = screenRoadGeometry(run);
      const height = itemHeight(DATA, geometry, kind, false);
      const pack = packBoxes(geometry, stillInLane(0), run);
      const hitRows: number[] = [];
      // From where the item spawns until it has scrolled off the road and is dropped.
      for (let y = geometry.roadTop - height; y < geometry.roadBottom; y += SCROLL_STEP) {
        const item = { height, id: 0, kind, lane: 0, laneSpan: 1, y };
        const obstacle = isObstacle(DATA, kind) ? obstacleHitBox(DATA, geometry, item) : null;
        const hit =
          obstacle === null
            ? pickupDog(pack, itemBox(geometry.cell, item))
            : hitDog(pack, obstacle);
        if (hit !== null) {
          // Its far edge as the item views draw it, through the projection.
          const far = obstacle?.top ?? y;
          hitRows.push(screenYAt(PROJECTION, PROJECTION.footY - far));
        }
      }
      expect(hitRows.length).toBeGreaterThan(0);
      expect(Math.max(...hitRows)).toBeLessThan(ROAD_VIEW_BOTTOM);
      expect(Math.max(...hitRows)).toBeLessThanOrEqual(PROJECTION.footY);
    }
  });

  it("is the run's own pack's, one per walker and dogs", () => {
    const run = testState({ duchess: 3, kilo: 3 });
    const other = { ...run, walker: "trista" } as const;
    expect(screenRoadGeometry(run)).toBe(screenRoadGeometry({ ...run }));
    expect(screenRoadGeometry(other)).not.toBe(screenRoadGeometry(run));
    expect(screenRoadGeometry(run).packParts.dogs).toHaveLength(2);
  });
});
