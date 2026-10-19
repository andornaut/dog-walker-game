import { gameData } from "../../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../../data/screen";
import { laneCenterXs } from "../../layout/lanes";
import { screenLayout } from "../../layout/screenLayout";
import { read } from "../../rules/units";
import { laneMotionX } from "../../runner/laneMotion";
import type { Walk } from "../../runner/walk";
import { walkerFootY, walkProjection } from "../../runner/walkGeometry";

// The walk's fixed screen geometry and draw order, shared by the run scene's views.

export const LAYOUT = screenLayout(SCREEN_CONFIG);
// Every road sprite, the road and its verge are drawn through this one projection.
export const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
export const LANE_XS = laneCenterXs(LANE_COUNT, LAYOUT.road);

// The backdrop band draws over the road's sprites, so what enters at the top of the road
// comes out from behind the curb. The road's approach in the band draws over the backdrop,
// under its gags.
export const DEPTH = {
  approach: 2400.5,
  backdrop: 2400,
  banner: 3100,
  decal: 2,
  fx: 2500,
  gag: 2401,
  leash: 2000,
  popup: 3000,
  road: 0,
  shadow: 3,
  sprite: 10,
};

// An item plays the first of these tags it has: its own motion while the walk goes on, and
// standing still while a card or the pause menu holds the walk.
export const ITEM_TAGS = {
  halted: ["idle", "loop", "walk", "wave"],
  walking: ["walk", "wave", "loop", "idle"],
} as const;

// A shadow under a sprite drawn from key's art steps at depth, its drawn size over its 1x.
export type Shadow = (key: string, depth: number, x: number, footY: number) => void;

// The pack's centre at the leading dog's feet, in screen pixels.
export function packPoint(walk: Walk | undefined): { x: number; y: number } {
  const road = LAYOUT.road;
  const x =
    walk === undefined ? road.x + road.width / 2 : laneMotionX(LANE_XS, walk.road.control.motion);
  return { x, y: walkerFootY(road) - 20 };
}

// How long a firing holds the walk, read live from the tuning.
export function firingSeconds(): number {
  return read(gameData.tuning, "seconds", "firingHoldSeconds");
}
