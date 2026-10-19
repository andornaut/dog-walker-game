import type { GameObjects, Scene } from "phaser";

import { badgeKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { AchievementId } from "../data/types";
import type { Rect } from "../layout/rect";
import { addBadge, BADGE_SIZE } from "./badges";
import { PALETTE } from "./palette";
import { addPixelText, scalePixelText } from "./pixelText";
import { soundboardOf } from "./soundboard";
import { addPanel } from "./uiKit";

// A badge earned mid-walk: a small banner filling its lane, at the top-left of the backdrop
// band, which cards leave uncovered, with the badge, an "Achievement!" line and its name. It
// drops in, holds, and fades; with reduced motion it appears in place. Badges earned together
// show one after another. The end screen still celebrates them in full.
const TOAST = { holdMs: 2000, inMs: 180, nameY: 24, outMs: 300, padding: 6, rise: 12 };

export class AchievementToasts {
  private queue: AchievementId[] = [];
  private showing = false;

  constructor(
    private readonly scene: Scene,
    private readonly lane: Rect,
    private readonly reduced: () => boolean,
  ) {}

  show(ids: readonly AchievementId[]): void {
    this.queue.push(...ids);
    if (!this.showing) {
      this.next();
    }
  }

  private next(): void {
    const id = this.queue.shift();
    if (id === undefined) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const { lane, scene } = this;
    const achievement = gameData.achievements.find((candidate) => candidate.id === id);
    const { x, y: top } = lane;
    const parts: GameObjects.GameObject[] = [addPanel(scene, lane)];
    const badgeX = x + TOAST.padding + BADGE_SIZE / 2;
    parts.push(addBadge(scene, badgeKey(id), true, badgeX, top + lane.height / 2));
    const textX = x + 2 * TOAST.padding + BADGE_SIZE;
    const nameY = top + TOAST.nameY;
    const name = addPixelText(scene, textX, nameY, achievement?.name ?? id, {
      color: PALETTE.plum,
      scale: 2,
    });
    // A name too long for the banner at double size is set at single size.
    if (name.width > x + lane.width - TOAST.padding - textX) {
      scalePixelText(name, 1, textX, nameY + 3);
    }
    parts.push(
      addPixelText(scene, textX, top + 9, "Achievement!", { color: PALETTE.rust, font: "title" }),
      name,
    );
    soundboardOf(scene).play("badge");
    const targets = parts as (GameObjects.GameObject & { alpha: number; y: number })[];
    const still = this.reduced();
    if (!still) {
      targets.forEach((part) => {
        part.alpha = 0;
        part.y -= TOAST.rise;
      });
      scene.tweens.add({
        alpha: 1,
        duration: TOAST.inMs,
        ease: "Back.easeOut",
        targets,
        y: `+=${TOAST.rise}`,
      });
    }
    scene.tweens.add({
      alpha: 0,
      delay: TOAST.holdMs + (still ? 0 : TOAST.inMs),
      duration: TOAST.outMs,
      onComplete: () => {
        parts.forEach((part) => part.destroy());
        this.next();
      },
      targets,
    });
  }
}
