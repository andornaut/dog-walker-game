import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { testState } from "../testing/runState";
import { dogsTouching, itemBox } from "./collision";
import { stillInLane } from "./laneMotion";
import { dogBoxes, itemHeight, type WalkItemKind } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const DATA = { encounters: ENCOUNTERS, minorObstacles: MINOR_OBSTACLES };
const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const ROAD_VIEW_BOTTOM = LAYOUT.roadView.y + LAYOUT.roadView.height;
// How finely the road's scroll is sampled, in road pixels.
const SCROLL_STEP = 0.25;

const KINDS: readonly WalkItemKind[] = [
  ...(Object.keys(ENCOUNTERS) as WalkItemKind[]),
  ...(Object.keys(MINOR_OBSTACLES) as WalkItemKind[]),
  "tip",
  "treat",
];
const PACK_SIZES = Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) => i + 1);
const CASES = [...new Set(KINDS)].flatMap((kind) =>
  PACK_SIZES.map((dogs) => [kind, dogs] as const),
);

describe("screenRoadGeometry", () => {
  it.each(CASES)(
    "hits %s only while its far edge is drawn in view, not below a pack of %i",
    (kind, dogs) => {
      const geometry = walkGeometry(LANE_COUNT, dogs, PROJECTION, LAYOUT.road);
      const height = itemHeight(DATA, geometry, kind);
      const slots = Object.fromEntries(
        (Object.keys(gameData.dogs) as DogId[]).slice(0, dogs).map((dog) => [dog, 3]),
      );
      const boxes = dogBoxes(geometry, stillInLane(0), testState(slots));
      const hitRows: number[] = [];
      // From where the item spawns until it has scrolled off the road and is dropped.
      for (let y = geometry.roadTop - height; y < geometry.roadBottom; y += SCROLL_STEP) {
        const item = { height, id: 0, kind, lane: 0, laneSpan: 1, y };
        if (dogsTouching(boxes, itemBox(geometry.cell, item)).length > 0) {
          // Its far edge as the item views draw it, through the projection.
          hitRows.push(screenYAt(PROJECTION, PROJECTION.footY - y));
        }
      }
      expect(hitRows.length).toBeGreaterThan(0);
      expect(Math.max(...hitRows)).toBeLessThan(ROAD_VIEW_BOTTOM);
      expect(Math.max(...hitRows)).toBeLessThanOrEqual(PROJECTION.footY);
    },
  );
});
