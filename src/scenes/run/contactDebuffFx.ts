import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Time } from "phaser";

import { debuffIconKey } from "../../assets/iconKeys";
import {
  contactDebuffAnchor,
  DEBUFF_BADGE,
  debuffCueRects,
  type DebuffHitEffect,
  HIT_ART,
} from "../../layout/hitEffects";
import { playTagOnce } from "../sprites";
import { addPanel, tagFrame } from "../uiKit";

// A contact burst and matching badge that follow the affected dog after the hit stop ends.
// Normal playback owns their shared lifetime; reduced motion holds the peak for the loaded
// animation's duration. Missing burst art is skipped, as for other hit effects.
export function playContactDebuff(
  scene: Scene,
  context: {
    readonly depth: number;
    readonly dogTop: () => Point | undefined;
    readonly view: Rect;
  },
  cue: DebuffHitEffect,
): void {
  const animation = scene.anims.get(animationKey(cue.key, HIT_ART.tag));
  if (!scene.textures.exists(cue.key) || animation === undefined) {
    return;
  }
  const frame = cue.frame === null ? undefined : tagFrame(scene, cue.key, HIT_ART.tag, cue.frame);
  if (cue.frame !== null && frame === undefined) {
    return;
  }
  const burst: GameObjects.Image | GameObjects.Sprite =
    cue.frame === null ? scene.add.sprite(0, 0, cue.key) : scene.add.image(0, 0, cue.key, frame);
  const group = scene.add.container(0, 0, [burst]).setDepth(context.depth + cue.above);
  const { iconInset, iconSize, size } = DEBUFF_BADGE;
  const iconKey = debuffIconKey(cue.debuff);
  const badge = scene.textures.exists(iconKey)
    ? addPanel(scene, { height: size, width: size, x: 0, y: 0 })
    : undefined;
  const icon =
    badge === undefined
      ? undefined
      : scene.add.image(0, 0, iconKey).setOrigin(0).setDisplaySize(iconSize, iconSize);
  if (badge !== undefined && icon !== undefined) {
    group.add([badge, icon]);
  }

  let ended = false;
  let timer: Time.TimerEvent | undefined;
  let at = cue.at;
  const place = () => {
    const top = context.dogTop();
    if (top !== undefined) {
      at = contactDebuffAnchor(top);
    }
    const rects = debuffCueRects(context.view, {
      at,
      height: burst.displayHeight,
      width: burst.displayWidth,
    });
    const centre = {
      x: rects.burst.x + rects.burst.width / 2,
      y: rects.burst.y + rects.burst.height / 2,
    };
    group.setPosition(centre.x, centre.y);
    badge?.setPosition(rects.badge.x - centre.x, rects.badge.y - centre.y);
    icon?.setPosition(rects.badge.x - centre.x + iconInset, rects.badge.y - centre.y + iconInset);
  };
  const stopTracking = () => {
    if (ended) {
      return;
    }
    ended = true;
    scene.events.off("postupdate", place);
    scene.events.off("shutdown", finish);
    timer?.remove(false);
  };
  const finish = () => {
    if (ended) {
      return;
    }
    stopTracking();
    group.destroy();
  };
  group.once("destroy", stopTracking);
  scene.events.on("postupdate", place);
  scene.events.once("shutdown", finish);
  if (cue.frame === null) {
    playTagOnce(burst as GameObjects.Sprite, cue.key, HIT_ART.tag, finish);
  } else {
    timer = scene.time.delayedCall(animation.duration, finish);
  }
  place();
}
