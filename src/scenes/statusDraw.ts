import type { GameObjects, Scene } from "phaser";

import type { DogId } from "../data/types";
import {
  dogDepthStep,
  markOverlayKey,
  type StatusMark,
  statusOverlayLift,
} from "../runner/statuses";
import { depthLook, playTag, spriteTopY } from "./sprites";

// The status loops over the dogs on the road: each dog's newest status, in the art of the skin
// that started it, bottom-centre on its centre column a few pixels below its top opaque row, at
// the dog's depth step and drawn just over the dog. The top row is read from the dog's first
// frame on first use, since the manifest's anchors give only the feet line and width.
export class StatusOverlays {
  private readonly scene: Scene;
  private readonly sprites = new Map<DogId, GameObjects.Sprite>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  draw(
    dogs: ReadonlyMap<DogId, GameObjects.Sprite>,
    statusOf: (dog: DogId) => StatusMark | undefined,
    still: boolean,
  ): void {
    const has = (key: string) => this.scene.textures.exists(key);
    for (const [dog, dogSprite] of dogs) {
      const mark = dogSprite.visible ? statusOf(dog) : undefined;
      const dogKey = dogSprite.texture.key;
      const step = dogDepthStep(dogKey, dogSprite.scaleY);
      const look =
        mark === undefined ? undefined : depthLook(this.scene, markOverlayKey(has, mark), step);
      let sprite = this.sprites.get(dog);
      if (look === undefined || !this.scene.textures.exists(look.key)) {
        sprite?.setVisible(false);
        continue;
      }
      if (sprite === undefined) {
        sprite = this.scene.add.sprite(0, 0, look.key).setOrigin(0.5, 1);
        this.sprites.set(dog, sprite);
      }
      const { displayOriginX, displayOriginY, frame, scaleX, scaleY, x, y } = dogSprite;
      const centre = x + (frame.width / 2 - displayOriginX) * scaleX;
      const top = y + (spriteTopY(this.scene, dogKey) - displayOriginY) * scaleY;
      playTag(sprite, look.key, "loop", still);
      sprite
        .setVisible(true)
        .setScale(look.scale)
        .setPosition(Math.round(centre), Math.round(top + statusOverlayLift(step)))
        .setDepth(dogSprite.depth + 0.5);
    }
  }
}
