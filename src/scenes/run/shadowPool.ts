import type { GameObjects, Scene } from "phaser";

import { shadowTexture } from "../../ui/phaser/draw";
import { spriteMetrics } from "../sprites";
import { DEPTH, type Shadow } from "./stage";

// A Shadow placer that takes each shadow's colour.
type ColoredShadow = (color: number, key: string, depth: number, x: number, footY: number) => void;

// Shadow images, reused frame to frame: the first `used` are in use this frame.
export class ShadowPool {
  private color = 0;
  private readonly coloredPlacer: ColoredShadow = (color, key, depth, x, footY) =>
    this.place(color, key, depth, x, footY);
  private readonly images: GameObjects.Image[] = [];
  private readonly placer: Shadow = (key, depth, x, footY) =>
    this.place(this.color, key, depth, x, footY);
  private readonly scene: Scene;
  private used = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // The shadow placer for a frame drawn in color. Call hideUnused once the frame is drawn.
  frame(color: number): Shadow {
    this.used = 0;
    this.color = color;
    return this.placer;
  }

  // The shadow placer for a frame whose shadows each name their colour. Call hideUnused once
  // the frame is drawn.
  frameInColors(): ColoredShadow {
    this.used = 0;
    return this.coloredPlacer;
  }

  hideUnused(): void {
    for (let i = this.used; i < this.images.length; i++) {
      this.images[i]?.setVisible(false);
    }
  }

  // A shadow under a sprite, centred on its x a pixel above its feet. It is sized from the
  // sprite's 1x art at its depth, whichever art step draws it.
  private place(color: number, key: string, depth: number, x: number, footY: number): void {
    const width = spriteMetrics(key).opaqueWidth * depth;
    const { anchor, key: texture } = shadowTexture(this.scene, color, width, depth);
    let image = this.images[this.used];
    if (image === undefined) {
      image = this.scene.add.image(0, 0, texture).setOrigin(0).setDepth(DEPTH.shadow);
      this.images.push(image);
    }
    this.used += 1;
    image
      .setTexture(texture)
      .setPosition(Math.round(x) - anchor.x, Math.round(footY) - 1 - anchor.y)
      .setVisible(true);
  }
}
