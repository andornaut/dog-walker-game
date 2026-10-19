import type { GameObjects, Scene } from "phaser";

import type { DogId } from "../data/types";
import {
  dogDepthStep,
  type DogStatusId,
  STATUS_OVERLAY_LIFT,
  statusOverlayKey,
} from "../runner/statuses";
import { depthLook, playTag, spriteTopY } from "./sprites";

// The status loops over the dogs on the road: each dog's newest status, bottom-centre on its
// centre column a few pixels below its top opaque row, at the dog's depth step and drawn just
// over the dog. The top row is read from the dog's first frame on first use, since the
// manifest's anchors give only the feet line and width.
export class StatusOverlays {
  private readonly scene: Scene;
  private readonly sprites = new Map<DogId, GameObjects.Sprite>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  draw(
    dogs: ReadonlyMap<DogId, GameObjects.Sprite>,
    statusOf: (dog: DogId) => DogStatusId | undefined,
    still: boolean,
  ): void {
    for (const [dog, dogSprite] of dogs) {
      const status = dogSprite.visible ? statusOf(dog) : undefined;
      const dogKey = dogSprite.texture.key;
      const step = dogDepthStep(dogKey, dogSprite.scaleY);
      const look =
        status === undefined ? undefined : depthLook(this.scene, statusOverlayKey(status), step);
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
        .setPosition(Math.round(centre), Math.round(top + STATUS_OVERLAY_LIFT[step]))
        .setDepth(dogSprite.depth + 0.5);
    }
  }
}
