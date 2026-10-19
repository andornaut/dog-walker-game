import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { AchievementId, DogId } from "../data/types";
import { badgeStrip, badgeWall, celebrationTitle } from "../home/badgesView";
import type { Rect } from "../layout/rect";
import { PALETTE } from "./palette";
import { addPixelText, wrapPixelText } from "./pixelText";
import { playTagOnce } from "./sprites";
import { addPanel, showTag, tagFrame, TEXT_SCALE } from "./uiKit";

export const BADGE_SIZE = 32;
const BURST_TAG = "play";
const NAME_LINE_HEIGHT = 16;
const POP = { delayMs: 140, durationMs: 320 } as const;

type Placed = GameObjects.Graphics | GameObjects.Image;

// A badge's earned or locked frame centred on a point, or a box in its state's colour while the
// art is missing.
export function addBadge(
  scene: Scene,
  art: string,
  earned: boolean,
  centerX: number,
  centerY: number,
): Placed {
  const frame = tagFrame(scene, art, earned ? "earned" : "locked");
  if (frame !== undefined) {
    return scene.add.image(Math.round(centerX), Math.round(centerY), art, frame);
  }
  const half = BADGE_SIZE / 2;
  return scene.add
    .graphics({ x: Math.round(centerX), y: Math.round(centerY) })
    .fillStyle(earned ? PALETTE.amber : PALETTE.grey)
    .fillRect(-half, -half, BADGE_SIZE, BADGE_SIZE);
}

// A one-shot effect's play tag centred on a point: it plays once and is removed, or with
// reduced motion holds one still frame.
export interface Burst {
  readonly key: string;
  readonly stillFrame: number;
}

export const CONFETTI: Burst = { key: "fx-confetti", stillFrame: 4 };
export const NEW_BEST_BURST: Burst = { key: "fx-new-best", stillFrame: 3 };

export function addBurst(
  scene: Scene,
  reduced: boolean,
  burst: Burst,
  scale: number,
  centerX: number,
  centerY: number,
): void {
  if (!scene.textures.exists(burst.key)) {
    return;
  }
  const sprite = scene.add
    .sprite(Math.round(centerX), Math.round(centerY), burst.key)
    .setScale(scale);
  if (reduced) {
    const frame = tagFrame(scene, burst.key, BURST_TAG, burst.stillFrame);
    if (frame !== undefined) {
      sprite.setFrame(frame);
    }
    return;
  }
  playTagOnce(sprite, burst.key, BURST_TAG, () => sprite.destroy());
}

// fx-confetti behind a badge drawn at scale.
export function addConfetti(
  scene: Scene,
  reduced: boolean,
  scale: number,
  centerX: number,
  centerY: number,
): void {
  addBurst(scene, reduced, CONFETTI, scale, centerX, centerY);
}

// Badges just earned, side by side in a panel with confetti behind each: they pop in one after
// another, or with reduced motion are simply there over a still frame of confetti. Each name
// takes up to nameLines lines.
export function addBadgeCelebration(
  scene: Scene,
  reduced: boolean,
  nameLines: number,
  rect: Rect,
  ids: readonly AchievementId[],
): void {
  addPanel(scene, rect);
  const center = rect.x + rect.width / 2;
  addPixelText(scene, center, rect.y + 10, celebrationTitle(gameData, ids.length), {
    color: PALETTE.plum,
    font: "title",
    originX: 0.5,
    scale: TEXT_SCALE,
  });
  const badges = badgeWall(gameData, { achievements: {} }).filter(({ id }) => ids.includes(id));
  const strip = badgeStrip({ maxNamed: 3, width: rect.width - 8, x: rect.x + 4 }, badges.length);
  const badgeY = rect.y + 34 + BADGE_SIZE / 2;
  badges.forEach((badge, i) => {
    const slot = strip.slots[i];
    if (slot === undefined) {
      return;
    }
    const delay = i * POP.delayMs;
    const burst = () => addConfetti(scene, reduced, 1, slot.centerX, badgeY);
    const image = addBadge(scene, badge.art, true, slot.centerX, badgeY);
    if (strip.named) {
      const style = { color: PALETTE.plum, originX: 0.5, scale: TEXT_SCALE };
      const name = wrapPixelText(scene, style, slot.width - 4, badge.name);
      name.slice(0, nameLines).forEach((line, n) => {
        const y = badgeY + BADGE_SIZE / 2 + 6 + n * NAME_LINE_HEIGHT;
        addPixelText(scene, slot.centerX, y, line, style).setDepth(1);
      });
    }
    if (reduced) {
      burst();
      image.setDepth(1);
      return;
    }
    image.setScale(0).setDepth(1);
    scene.time.delayedCall(delay, burst);
    scene.tweens.add({
      delay,
      duration: POP.durationMs,
      ease: "Back.easeOut",
      scale: 1,
      targets: image,
    });
  });
}

// The owners cheering: their happy faces, hopping now and then unless motion is reduced.
export function addCheeringFace(
  scene: Scene,
  reduced: boolean,
  dog: DogId,
  x: number,
  y: number,
): GameObjects.Sprite {
  const key = ownerFaceKey(gameData, dog);
  const face = scene.add.sprite(x, y, key).setOrigin(0);
  showTag(reduced, face, key, "happy");
  if (!reduced) {
    scene.tweens.add({
      duration: 180,
      ease: "Sine.easeOut",
      hold: 60,
      repeat: -1,
      repeatDelay: 600,
      targets: face,
      y: y - 4,
      yoyo: true,
    });
  }
  return face;
}
