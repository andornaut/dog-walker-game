import type { GameObjects, Scene } from "phaser";

import { badgeKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { AchievementId } from "../data/types";
import { addBadge, BADGE_SIZE } from "./badges";
import { PALETTE } from "./palette";
import { addPixelText, scalePixelText } from "./pixelText";
import { soundboardOf } from "./soundboard";
import { addPanel } from "./uiKit";

// A badge earned mid-walk: a small banner at the top of the backdrop band, which cards leave
// uncovered, with the badge, an "Achievement!" line and its name. It drops in, holds, and
// fades; with reduced motion it appears in place. Badges earned together show one after
// another. The end screen still celebrates them in full.
const TOAST = { height: 44, holdMs: 2000, inMs: 180, outMs: 300, padding: 6, rise: 12 };
const TOP = 48;
const WIDTH = 240;
const NAME_Y = TOP + 24;

export class AchievementToasts {
  private queue: AchievementId[] = [];
  private showing = false;

  constructor(
    private readonly scene: Scene,
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
    const { scene } = this;
    const achievement = gameData.achievements.find((candidate) => candidate.id === id);
    const x = Math.round((scene.scale.width - WIDTH) / 2);
    const parts: GameObjects.GameObject[] = [
      addPanel(scene, { height: TOAST.height, width: WIDTH, x, y: TOP }),
    ];
    const badgeX = x + TOAST.padding + BADGE_SIZE / 2;
    parts.push(addBadge(scene, badgeKey(id), true, badgeX, TOP + TOAST.height / 2));
    const textX = x + 2 * TOAST.padding + BADGE_SIZE;
    const name = addPixelText(scene, textX, NAME_Y, achievement?.name ?? id, {
      color: PALETTE.plum,
      scale: 2,
    });
    // A name too long for the banner at double size is set at single size.
    if (name.width > x + WIDTH - TOAST.padding - textX) {
      scalePixelText(name, 1, textX, NAME_Y + 3);
    }
    parts.push(
      addPixelText(scene, textX, TOP + 9, "Achievement!", { color: PALETTE.rust, font: "title" }),
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
