import type { GameObjects, Scene } from "phaser";

import { shadowFrame, uploadShadowFrames } from "../../ui/phaser/draw";
import { spriteMetrics } from "../sprites";
import { DEPTH, type Shadow } from "./stage";

// A Shadow placer that takes each shadow's colour and opacity.
type ColouredShadow = (
  colour: number,
  alpha: number,
  key: string,
  depth: number,
  x: number,
  footY: number,
) => void;

// Shadow images, reused frame to frame: the first `used` are in use this frame.
export class ShadowPool {
  private colour = 0;
  private readonly colouredPlacer: ColouredShadow = (colour, alpha, key, depth, x, footY) =>
    this.place(colour, alpha, key, depth, x, footY);
  private readonly images: GameObjects.Image[] = [];
  private readonly placer: Shadow = (key, depth, x, footY) =>
    this.place(this.colour, 1, key, depth, x, footY);
  private readonly scene: Scene;
  private used = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // The shadow placer for a frame drawn in colour. Call hideUnused once the frame is drawn.
  frame(colour: number): Shadow {
    this.used = 0;
    this.colour = colour;
    return this.placer;
  }

  // The shadow placer for a frame whose shadows each name their colour. Call hideUnused once
  // the frame is drawn.
  frameInColours(): ColouredShadow {
    this.used = 0;
    return this.colouredPlacer;
  }

  hideUnused(): void {
    uploadShadowFrames(this.scene);
    for (let i = this.used; i < this.images.length; i++) {
      this.images[i]?.setVisible(false);
    }
  }

  // A shadow under a sprite, centred on its x a pixel above its feet, in colour at opacity
  // alpha. It is sized from the sprite's 1x art at its depth, whichever art step draws it.
  private place(
    colour: number,
    alpha: number,
    key: string,
    depth: number,
    x: number,
    footY: number,
  ): void {
    const width = spriteMetrics(key).opaqueWidth * depth;
    const shadow = shadowFrame(this.scene, width, depth);
    if (shadow === undefined) {
      return;
    }
    const { anchor, frame, key: texture } = shadow;
    let image = this.images[this.used];
    if (image === undefined) {
      image = this.scene.add.image(0, 0, texture, frame).setOrigin(0).setDepth(DEPTH.shadow);
      this.images.push(image);
    }
    this.used += 1;
    image
      .setTexture(texture, frame)
      .setTint(colour)
      .setPosition(Math.round(x) - anchor.x, Math.round(footY) - 1 - anchor.y)
      .setAlpha(alpha)
      .setVisible(true);
  }
}
