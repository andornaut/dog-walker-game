import type { GameObjects } from "phaser";

import { gameData } from "../../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../../data/screen";
import { laneCentreXs } from "../../layout/lanes";
import { screenLayout, walkerFootY } from "../../layout/screenLayout";
import { fadeIn, rowsHidden } from "../../road/roadClip";
import { read } from "../../rules/units";
import { laneMotionX } from "../../runner/laneMotion";
import type { Walk } from "../../runner/walk";
import { walkProjection } from "../../runner/walkGeometry";

// The walk's fixed screen geometry and draw order, shared by the run scene's views.

export const LAYOUT = screenLayout(SCREEN_CONFIG);
// Every road sprite, the road and its verge are drawn through this one projection.
export const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
export const LANE_XS = laneCentreXs(LANE_COUNT, LAYOUT.road);

// The backdrop band, the road's approach drawn over it and the band's movers lie under the
// road and its sprites: an item standing on the road draws whole over them, and showOnRoad cuts
// one standing past the juncture off at it, so nothing of it shows past the cross street.
export const DEPTH = {
  approach: -2,
  backdrop: -3,
  // Movers on the band's cross street and sky lie over the approach; nearer rows in front.
  bandMover: -1.5,
  banner: 3100,
  decal: 2,
  fx: 2500,
  popup: 3000,
  road: 0,
  // Roadside props lie under every road sprite and ambient mover, so nothing on the road, the
  // sidewalks or the lawns is ever hidden behind one; nearer rows in front. Distraction movers
  // sort with them by row.
  roadside: 4,
  shadow: 3,
  sprite: 10,
  // A struck obstacle out of play lies under every live road sprite and the pack, so it never
  // covers the dogs as they pass it; nearer rows in front.
  struck: 9,
};

// How much each screen row adds to the depth of the layers drawn nearer rows in front: the
// roadside props and the distractions, which sort by row together, and the struck obstacles. A
// thousand rows' worth stays under the next layer.
export const ROW_DEPTH = 1 / 1000;

// The row where the road's junction meets the band's cross street.
export const JUNCTURE_Y = LAYOUT.junction.y;

// The opacity of scenery with its ground on screen row groundY, fading in from the juncture to
// the road's far edge. Movers and items come into view at the far edge, opaque.
export function sceneryFade(groundY: number): number {
  return fadeIn(JUNCTURE_Y, LAYOUT.road.y, groundY);
}

// Shows a road sprite, placed and sized, with its ground on screen row groundY, at opacity
// alpha, with the part above the juncture hidden unless it stands on the road below it.
export function showOnRoad(groundY: number, alpha: number, sprite: GameObjects.Sprite): void {
  sprite.setAlpha(alpha);
  const { height } = sprite;
  const scale = Math.abs(sprite.scaleY);
  const top = sprite.y - sprite.originY * height * scale;
  const hidden = rowsHidden(JUNCTURE_Y, groundY, { height, scale, top });
  if (hidden > 0) {
    sprite.setCrop(0, hidden, sprite.width, height - hidden);
  } else if (sprite.isCropped) {
    sprite.setCrop();
  }
}

// A shadow under a sprite drawn from key's art steps at depth, its drawn size over its 1x.
export type Shadow = (key: string, depth: number, x: number, footY: number) => void;

// The pack's centre at the leading dog's feet, in screen pixels.
export function packPoint(walk: Walk | undefined): { x: number; y: number } {
  const x =
    walk === undefined ? PROJECTION.centreX : laneMotionX(LANE_XS, walk.road.control.motion);
  return { x, y: walkerFootY(LAYOUT.road) - 20 };
}

// Over the pack at pack: where pops over the pack, its sparkles and its money labels show.
export function overPack(pack: { x: number; y: number }): { x: number; y: number } {
  return { x: pack.x, y: pack.y - 24 };
}

// How long a firing holds the walk, read live from the tuning.
export function firingSeconds(): number {
  return read(gameData.tuning, "seconds", "firingHoldSeconds");
}
