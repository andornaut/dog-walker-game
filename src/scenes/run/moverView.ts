import type { Scene } from "phaser";

import { itemAt } from "../../arrays";
import {
  MOVER_SPRITES,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
} from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import type { ZoneId } from "../../data/types";
import { project } from "../../layout/projection";
import { encounterLook } from "../../rules/skins";
import { read } from "../../rules/units";
import {
  isMoverObstacle,
  MOVER_CONTACTS,
  type MoverKind,
  type MoverOnRoad,
  moverPlace,
} from "../../runner/movers";
import { playTag, showAtDepth } from "../sprites";
import type { ItemView } from "./itemViews";
import { clipToRoad, DEPTH, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// A mover's cue, in road pixels before projection: its sign inset from the road's edge, or
// down from the far end of the road for a cyclist, and the arrow a sign's width beside it or
// below it on screen.
const CUE = { inset: 10, size: 16, top: 20 };

// A mover's body sprite: for a mover that opens an encounter, the encounter's skin in the zone
// once its art is loaded, else the mover's own sprite.
export function moverBodyKey(scene: Scene, zone: ZoneId, mover: MoverKind): string {
  const { key } = MOVER_SPRITES[mover];
  const contact = MOVER_CONTACTS[mover];
  if (isMoverObstacle(contact)) {
    return key;
  }
  const look = encounterLook(gameData, zone, contact);
  return look.art !== look.baseArt && scene.textures.exists(look.art) ? look.art : key;
}

// A mover stands on the road through the projection once it moves, sized by showAtDepth, a
// crosser mirrored when it runs left. Until then only its cue shows, at 1x: a sign at the
// road's edge on its row with the arrow pointing across, or a cyclist's sign at the top of
// its lane with the arrow pointing down. The ball carries its own shadow. A mover with an idle
// tag, the goose, also stands at the edge during its cue, playing it then and while halted. A
// mover in an encounter's skin plays the mover's tags on the skin's sprite.
export function drawMover(
  mover: MoverOnRoad,
  view: ItemView,
  footY: number,
  roadTop: number,
  halted: boolean,
  still: boolean,
  shadow: Shadow,
): void {
  const { road } = LAYOUT;
  const { path } = mover;
  const [body, cue, arrow] = view.parts;
  const place = moverPlace(LANE_COUNT, path, mover.since);
  const laneX = itemAt(LANE_XS, 0) + (place.lanePosition * road.width) / LANE_COUNT;
  const leftward = path.motion === "cross" && path.direction === -1;
  const sprite = MOVER_SPRITES[path.mover];
  const idle = "idle" in sprite ? sprite.idle : undefined;
  if (body !== undefined) {
    const shown = place.moving || idle !== undefined;
    body.sprite.setVisible(shown);
    if (shown) {
      const placed = project(PROJECTION, { distance: PROJECTION.footY - footY, x: laneX });
      const { key } = body;
      const tag = idle !== undefined && (halted || !place.moving) ? idle : sprite.tag;
      const drawn = showAtDepth(body.sprite, key, placed.scale);
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      body.sprite
        .setPosition(x, y)
        .setDepth(DEPTH.sprite + placed.y)
        .setFlipX(leftward);
      clipToRoad(body.sprite);
      playTag(body.sprite, drawn.key, tag, still);
      const cycle = body.sprite.anims.currentAnim?.duration;
      if (path.mover !== "ball") {
        shadow(key, drawn.depth, x, y);
      } else if (cycle !== undefined) {
        const bounce = read(gameData.tuning, "seconds", "ballBounceSeconds");
        body.sprite.anims.timeScale = cycle / (bounce * 1000);
      }
    }
  }
  const edgeX = leftward ? road.x + road.width - CUE.inset : road.x + CUE.inset;
  const cueAt = project(
    PROJECTION,
    path.motion === "cross"
      ? { distance: PROJECTION.footY - footY, x: edgeX }
      : { distance: PROJECTION.footY - (roadTop + CUE.top), x: laneX },
  );
  const x = Math.round(cueAt.x);
  const y = Math.round(cueAt.y);
  cue?.sprite.setVisible(!place.moving).setPosition(x, y).setDepth(DEPTH.fx);
  arrow?.sprite.setVisible(!place.moving).setDepth(DEPTH.fx).setFlipX(leftward);
  if (place.moving) {
    return;
  }
  if (cue !== undefined) {
    playTag(cue.sprite, WARNING_KEY, WARNING_TAG, still);
  }
  if (arrow !== undefined && path.motion === "cross") {
    arrow.sprite.setPosition(x + path.direction * CUE.size, y);
    playTag(arrow.sprite, WARNING_ARROW_KEY, WARNING_TAG, still);
  } else if (arrow !== undefined) {
    arrow.sprite.setPosition(x, y + CUE.size);
    playTag(arrow.sprite, WARNING_ARROW_KEY, WARNING_DOWN_TAG, still);
  }
}
