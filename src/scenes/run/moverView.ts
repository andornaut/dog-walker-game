import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import {
  IDLE_TAG,
  moverBodyTag,
  prizeMoverTag,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
  WARNING_UP_TAG,
} from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import type { EncounterId, MinorObstacleId } from "../../data/types";
import { moverBodyArt } from "../../layout/obstacleArt";
import { project } from "../../layout/projection";
import { read } from "../../rules/units";
import {
  drawnLanes,
  facesLeft,
  hasStopped,
  inMotion,
  isMerging,
  isSliding,
  type MoverOnRoad,
  moverPlace,
  moverTell,
} from "../../runner/movers";
import { itemCategory, type WalkItem } from "../../runner/walkItems";
import { firstTag, playTag, showAtDepth } from "../sprites";
import type { ItemPart, ItemView } from "./itemViews";
import { drawSignatureTrail } from "./signatureView";
import { DEPTH, JUNCTURE_Y, laneX, LAYOUT, PROJECTION, showOnRoad } from "./stage";
import { type StandFrame, standPart } from "./standPart";

// A mover's cue, in road pixels before projection: its sign inset from the road's edge, or
// down from the far end of the road for an in-lane mover, and the arrow a sign's width beside
// it or below it on screen. The wander mark's top-left corner is at wander from the top
// centre of the stepper's art.
const CUE = { inset: 10, size: 16, top: 20, wander: { x: -8, y: -18 } };

// The pose a mover holds while its cue shows, and the poses played once through, not looped: the
// cue into its move and a diver's dive into lying down.
const CUE_POSE = "cue";
const ONCE_POSES: ReadonlySet<string> = new Set([CUE_POSE, "dive"]);

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

// How many cue sprites follow a mover's body among its parts: the sign, the arrow and the
// wander mark. Any after them go with the body.
export const MOVER_CUE_PARTS = 3;

// What drawMover reads of a mover on the road.
type MoverItemView = Pick<WalkItem, "height" | "kind" | "laneSpan" | "y"> & {
  readonly mover: MoverOnRoad;
};

// A mover's body sprite (moverBodyArt), of the art loaded.
export function moverBodyKey(scene: Scene, kind: EncounterId | MinorObstacleId): string {
  return moverBodyArt(gameData, (key) => scene.textures.exists(key), kind);
}

// Each position is the frame's blended one, rounded to whole pixels, and the body is cut off at the
// juncture; a cue shows only once wholly below it. A mover stands on the road through the
// projection, across the middle of the lanes it is drawn over (drawnLanes), while it is solid,
// sized by showAtDepth on its body part's feet, mirrored while it faces left (facesLeft), playing
// the tag moverBodyTag picks, in its cue, dive or merge pose while it holds one (the cue and the
// dive played once through, not looped), or prizeMoverTag for a lucky find. Before a dart or
// in-lane move only its cue shows, at 1x, each part only while its art is loaded: a sign at the
// road's edge on its row with the arrow pointing across, or a sign at the top of its lanes with the
// arrow pointing down or up. A crosser with an idle tag also stands at the edge, playing it, while
// it waits there before its cue and during its cue. A crosser that has stopped plays its idle tag
// if it has one, and otherwise stands on the first frame of the tag it would play. A stepper stands
// on the road throughout, with the wander mark over it before each step. A lucky find shows no cue.
// Its other sprites, after the wander mark, such as a skunk's cloud, go with its body wherever it
// shows, standing as an obstacle's do.
export function drawMover(
  item: MoverItemView,
  view: ItemView,
  roadTop: number,
  halted: boolean,
  frame: StandFrame,
): void {
  const { shadow, still } = frame;
  const { road } = LAYOUT;
  const { path, since } = item.mover;
  const footY = item.y + item.height;
  const [body, cue, arrow, wander] = view.parts;
  const place = moverPlace(LANE_COUNT, path, since);
  const span = drawnLanes(item.laneSpan, path);
  const centreX = laneX(place.lanePosition + (span - 1) / 2);
  const leftward = facesLeft(path, since);
  const lucky = itemCategory(gameData, item.kind) === "lucky";
  const tell = lucky ? null : moverTell(path, since);
  const moving = inMotion(path, since);
  const trail = drawSignatureTrail(view, halted, frame, item);
  if (!trail && body !== undefined) {
    const scene = body.sprite.scene;
    const idle = firstTag(scene, body.key, [IDLE_TAG]);
    const shown = place.solid || (path.motion === "cross" && idle !== undefined);
    body.sprite.setVisible(shown);
    for (const part of view.parts.slice(MOVER_CUE_PARTS + 1)) {
      part.sprite.setVisible(shown);
      if (shown) {
        standPart(item, part, centreX, frame);
      }
    }
    if (shown) {
      const distance = PROJECTION.footY - body.footY(item);
      const placed = project(PROJECTION, { distance, x: centreX });
      const drawn = showAtDepth(body.sprite, body.key, placed.scale, body.feet);
      const has = (candidate: string) => scene.anims.exists(animationKey(drawn.key, candidate));
      const pose = isSliding(path, since)
        ? "dive"
        : isMerging(path, since)
          ? "merge"
          : tell === null
            ? null
            : CUE_POSE;
      const tag = lucky
        ? prizeMoverTag(has, path.movement, moving && !halted, halted)
        : moverBodyTag(has, path.movement, moving && !halted, pose);
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      body.sprite
        .setPosition(x, y)
        .setDepth(DEPTH.sprite + placed.y)
        .setFlipX(leftward);
      showOnRoad(y, 1, body.sprite);
      if (tag !== undefined) {
        const standing = hasStopped(path, since) && !has(IDLE_TAG);
        playTag(body.sprite, drawn.key, tag, still || standing, ONCE_POSES.has(tag));
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
  const showCue = (part: ItemPart | undefined, shown: boolean) =>
    part?.sprite
      .setVisible(shown && part.sprite.scene.textures.exists(part.key))
      .setDepth(DEPTH.fx);
  showCue(cue, signed);
  showCue(arrow, signed);
  showCue(wander, tell?.kind === "wander");
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
      : { distance: PROJECTION.footY - (roadTop + CUE.top), x: centreX },
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
