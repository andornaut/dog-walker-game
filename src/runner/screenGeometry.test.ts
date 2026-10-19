import { describe, expect, it } from "vitest";

import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { NEED_SPOTS } from "../data/needs";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { touchesPack } from "./collision";
import { MOVER_CONTACTS } from "./movers";
import { itemHeight, type WalkItemKind } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const DATA = { encounters: ENCOUNTERS, minorObstacles: MINOR_OBSTACLES, needSpots: NEED_SPOTS };
const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const ROAD_VIEW_BOTTOM = LAYOUT.roadView.y + LAYOUT.roadView.height;
// How finely the road's scroll is sampled, in road pixels.
const SCROLL_STEP = 0.25;

const KINDS: readonly WalkItemKind[] = [
  ...(Object.keys(ENCOUNTERS) as WalkItemKind[]),
  ...(Object.keys(MINOR_OBSTACLES) as WalkItemKind[]),
  ...(Object.keys(NEED_SPOTS) as WalkItemKind[]),
  ...Object.values(MOVER_CONTACTS),
  "tip",
  "treat",
];
const PACK_SIZES = Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) => i + 1);
const CASES = [...new Set(KINDS)].flatMap((kind) =>
  PACK_SIZES.map((dogs) => [kind, dogs] as const),
);

describe("screenRoadGeometry", () => {
  it.each(CASES)(
    "hits %s only while it is drawn standing in view, not below a pack of %i",
    (kind, dogs) => {
      const geometry = walkGeometry(LANE_COUNT, dogs, PROJECTION, LAYOUT.road);
      const height = itemHeight(DATA, geometry, kind);
      const pack = { ...geometry.packBand, lanes: [0] };
      const hitRows: number[] = [];
      // From where the item spawns until it has scrolled off the road and is dropped.
      for (let y = geometry.roadTop - height; y < geometry.roadBottom; y += SCROLL_STEP) {
        const item = { height, id: 0, kind, lane: 0, laneSpan: 1, y };
        if (touchesPack(pack, item)) {
          // Drawn as the item views draw it: standing on its near edge, through the projection.
          hitRows.push(screenYAt(PROJECTION, PROJECTION.footY - (y + height)));
        }
      }
      expect(hitRows.length).toBeGreaterThan(0);
      expect(Math.max(...hitRows)).toBeLessThan(ROAD_VIEW_BOTTOM);
      expect(Math.max(...hitRows)).toBeLessThanOrEqual(PROJECTION.footY);
    },
  );
});
