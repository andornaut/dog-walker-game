import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Time } from "phaser";

import { debuffIconKey } from "../../assets/iconKeys";
import type { DebuffId } from "../../data/types";
import {
  DEBUFF_BADGE,
  DEBUFF_GROUND,
  debuffBadgeRect,
  type DebuffHitEffect,
  HIT_ART,
} from "../../layout/hitEffects";
import { playTagOnce } from "../sprites";
import { addPanel, tagFrame } from "../uiKit";

interface BadgeLease {
  readonly debuff: DebuffId;
  readonly slot: number;
}

const activeBadges = new WeakMap<Scene, Set<BadgeLease>>();

// Reapplications may share their kind's slot; distinct kinds retain separate slots until
// their cues finish, including cues started by an earlier contact batch.
function reserveBadge(scene: Scene, debuff: DebuffId): { release: () => void; slot: number } {
  const active = activeBadges.get(scene) ?? new Set<BadgeLease>();
  activeBadges.set(scene, active);
  const existing = [...active].find((lease) => lease.debuff === debuff);
  const occupied = new Set([...active].map(({ slot }) => slot));
  let slot = existing?.slot ?? 0;
  if (existing === undefined) {
    while (occupied.has(slot)) {
      slot++;
    }
  }
  const lease = { debuff, slot };
  active.add(lease);
  return {
    release: () => {
      active.delete(lease);
      if (active.size === 0) {
        activeBadges.delete(scene);
      }
    },
    slot,
  };
}

// One ground animation per visible actor, plus one foreground badge beside the walker.
// Every copy plays once. Reduced motion holds the readable pose for the same loaded duration.
export function playContactDebuff(
  scene: Scene,
  context: {
    readonly badgeDepth: number;
    readonly depth: number;
    readonly feet: () => readonly Point[];
    readonly view: Rect;
    readonly walkerFeet: () => Point | undefined;
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
  const feet = context.feet();
  if (feet.length === 0) {
    return;
  }
  const bursts = feet.map(() => {
    const burst: GameObjects.Image | GameObjects.Sprite =
      cue.frame === null ? scene.add.sprite(0, 0, cue.key) : scene.add.image(0, 0, cue.key, frame);
    return burst.setOrigin(0.5, DEBUFF_GROUND.groundRow / DEBUFF_GROUND.height);
  });
  const group = scene.add.container(0, 0, bursts).setDepth(context.depth);
  const graphics = scene.make.graphics({}, false);
  const { view } = context;
  graphics.fillStyle(0xffffff).fillRect(view.x, view.y, view.width, view.height);
  const mask = graphics.createGeometryMask();
  group.setMask(mask);
  const { iconInset, iconSize, size } = DEBUFF_BADGE;
  const iconKey = debuffIconKey(cue.debuff);
  const badge = scene.textures.exists(iconKey)
    ? addPanel(scene, { height: size, width: size, x: 0, y: 0 })
    : undefined;
  const icon =
    badge === undefined
      ? undefined
      : scene.add
          .image(iconInset, iconInset, iconKey)
          .setOrigin(0)
          .setDisplaySize(iconSize, iconSize);
  const badgeGroup =
    badge === undefined || icon === undefined
      ? undefined
      : scene.add.container(0, 0, [badge, icon]).setDepth(context.badgeDepth).setMask(mask);

  const badgeLease = badgeGroup === undefined ? undefined : reserveBadge(scene, cue.debuff);

  let ended = false;
  let timer: Time.TimerEvent | undefined;
  const place = () => {
    const places = context.feet();
    bursts.forEach((burst, index) => {
      const at = places[index];
      burst.setVisible(at !== undefined);
      if (at !== undefined) {
        burst.setPosition(at.x, at.y + DEBUFF_GROUND.yOffset);
      }
    });
    const walker = context.walkerFeet();
    badgeGroup?.setVisible(walker !== undefined);
    if (walker !== undefined) {
      const rect = debuffBadgeRect(view, walker, badgeLease?.slot);
      badgeGroup?.setPosition(rect.x, rect.y);
    }
  };
  const stopTracking = () => {
    if (ended) {
      return;
    }
    ended = true;
    scene.events.off("postupdate", place);
    scene.events.off("shutdown", finish);
    timer?.remove(false);
    badgeGroup?.destroy();
    badgeLease?.release();
    mask.destroy();
    graphics.destroy();
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
    bursts.forEach((burst, index) => {
      playTagOnce(
        burst as GameObjects.Sprite,
        cue.key,
        HIT_ART.tag,
        index === 0 ? finish : () => {},
      );
    });
  } else {
    timer = scene.time.delayedCall(animation.duration, finish);
  }
  place();
}
