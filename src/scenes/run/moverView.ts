import type { GameObjects, Scene } from "phaser";

import { itemAt } from "../../arrays";
import {
  IDLE_TAG,
  MOVER_SPRITE_KEYS,
  MOVING_TAGS,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
  WARNING_UP_TAG,
} from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import type { EncounterId, MinorObstacleId, ZoneId } from "../../data/types";
import { project } from "../../layout/projection";
import { encounterLook, minorObstacleLook, skinnedArt } from "../../rules/skins";
import { read } from "../../rules/units";
import { inMotion, type MoverOnRoad, moverPlace, moverTell } from "../../runner/movers";
import { firstTag, playTag, showAtDepth } from "../sprites";
import type { ItemView } from "./itemViews";
import { clipToRoad, DEPTH, JUNCTURE_Y, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// A mover's cue, in road pixels before projection: its sign inset from the road's edge, or
// down from the far end of the road for an in-lane mover, and the arrow a sign's width beside
// it or below it on screen. The wander mark's top-left corner is at wander from the top
// centre of the stepper's art.
const CUE = { inset: 10, size: 16, top: 20, wander: { x: -8, y: -18 } };

// The ball carries its own shadow, bouncing on the road.
const BALL_KEY = "ball-bounce";

// How far a sprite's top lies above the juncture, or 0 when it lies wholly below it.
function aboveJuncture(sprite: GameObjects.Sprite): number {
  return Math.max(0, JUNCTURE_Y - (sprite.y - sprite.originY * sprite.displayHeight));
}

// Shows a cue only while it lies wholly below the juncture, as the road shows past it.
function showBelowJuncture(sprite: GameObjects.Sprite): void {
  sprite.setVisible(sprite.visible && aboveJuncture(sprite) === 0);
}

// A mover's body sprite: its kind's road art, or the sprite MOVER_SPRITE_KEYS names for that art
// once it is loaded.
export function moverBodyKey(
  scene: Scene,
  zone: ZoneId,
  kind: EncounterId | MinorObstacleId,
): string {
  const has = (key: string) => scene.textures.exists(key);
  const look = Object.hasOwn(gameData.minorObstacles, kind)
    ? minorObstacleLook(gameData, zone, kind as MinorObstacleId)
    : encounterLook(gameData, zone, kind as EncounterId);
  const art = skinnedArt(has, look);
  const sprite = MOVER_SPRITE_KEYS[art];
  return sprite !== undefined && has(sprite) ? sprite : art;
}

// Each position is the frame's blended one, rounded to whole pixels, and the body is cut off at
// the juncture; a cue shows only once wholly below it. A mover stands on the road through the
// projection while it is solid, sized by showAtDepth,
// a crosser mirrored when it runs left, playing its movement's first tag that its sprite has
// while it moves and its idle tag otherwise. Before a dart or in-lane move only its cue shows,
// at 1x: a sign at the road's edge on its row with the arrow pointing across, or a sign at the
// top of its lanes with the arrow pointing down or up. A crosser with an idle tag also stands
// at the edge during its cue. A stepper stands on the road throughout, with the wander mark over
// it before each step.
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
  const { path, since } = mover;
  const [body, cue, arrow, wander] = view.parts;
  const place = moverPlace(LANE_COUNT, path, since);
  const span = path.motion === "ride" ? path.lanes : 1;
  const laneX =
    itemAt(LANE_XS, 0) + ((place.lanePosition + (span - 1) / 2) * road.width) / LANE_COUNT;
  const leftward = path.motion === "cross" && path.direction === -1;
  const tell = moverTell(path, since);
  const moving = inMotion(path, since);
  if (body !== undefined) {
    const scene = body.sprite.scene;
    const idle = firstTag(scene, body.key, [IDLE_TAG]);
    const shown = place.solid || (path.motion === "cross" && idle !== undefined);
    body.sprite.setVisible(shown);
    if (shown) {
      const placed = project(PROJECTION, { distance: PROJECTION.footY - footY, x: laneX });
      const drawn = showAtDepth(body.sprite, body.key, placed.scale);
      const movingTag =
        path.movement === "still"
          ? undefined
          : firstTag(scene, drawn.key, MOVING_TAGS[path.movement]);
      const tag = moving && !halted ? (movingTag ?? idle) : (idle ?? movingTag);
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      body.sprite
        .setPosition(x, y)
        .setDepth(DEPTH.sprite + placed.y)
        .setFlipX(leftward);
      clipToRoad(body.sprite);
      if (tag !== undefined) {
        playTag(body.sprite, drawn.key, tag, still);
      }
      const cycle = body.sprite.anims.currentAnim?.duration;
      if (body.key !== BALL_KEY) {
        shadow(body.key, drawn.depth, x, y);
      } else if (cycle !== undefined) {
        const bounce = read(gameData.tuning, "seconds", "ballBounceSeconds");
        body.sprite.anims.timeScale = cycle / (bounce * 1000);
      }
    }
  }
  const signed = tell !== null && tell.kind !== "wander";
  cue?.sprite.setVisible(signed).setDepth(DEPTH.fx);
  arrow?.sprite.setVisible(signed).setDepth(DEPTH.fx);
  wander?.sprite.setVisible(tell?.kind === "wander").setDepth(DEPTH.fx);
  if (tell === null) {
    return;
  }
  if (tell.kind === "wander") {
    if (wander !== undefined && body !== undefined) {
      const top = body.sprite.getTopCenter();
      wander.sprite
        .setOrigin(0, 0)
        .setPosition(
          Math.round((top.x ?? 0) + CUE.wander.x),
          Math.round((top.y ?? 0) + CUE.wander.y),
        );
      showBelowJuncture(wander.sprite);
      playTag(wander.sprite, wander.key, WARNING_TAG, still);
    }
    return;
  }
  const across = tell.kind === "across";
  const edgeX = leftward ? road.x + road.width - CUE.inset : road.x + CUE.inset;
  const cueAt = project(
    PROJECTION,
    across
      ? { distance: PROJECTION.footY - footY, x: edgeX }
      : { distance: PROJECTION.footY - (roadTop + CUE.top), x: laneX },
  );
  const x = Math.round(cueAt.x);
  let y = Math.round(cueAt.y);
  if (cue !== undefined) {
    cue.sprite.setPosition(x, y);
    // An in-lane mover's sign stands at the top of its lanes in view, below the juncture.
    if (!across) {
      y += Math.ceil(aboveJuncture(cue.sprite));
      cue.sprite.setY(y);
    }
    showBelowJuncture(cue.sprite);
    playTag(cue.sprite, WARNING_KEY, WARNING_TAG, still);
  }
  if (arrow === undefined) {
    return;
  }
  if (across) {
    arrow.sprite.setPosition(x + tell.direction * CUE.size, y).setFlipX(tell.direction === -1);
    showBelowJuncture(arrow.sprite);
    playTag(arrow.sprite, WARNING_ARROW_KEY, WARNING_TAG, still);
  } else {
    arrow.sprite.setPosition(x, y + CUE.size).setFlipX(false);
    showBelowJuncture(arrow.sprite);
    playTag(
      arrow.sprite,
      WARNING_ARROW_KEY,
      tell.kind === "down" ? WARNING_DOWN_TAG : WARNING_UP_TAG,
      still,
    );
  }
}
