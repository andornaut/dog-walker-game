import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import type { DogId, GameData } from "../data/types";
import { addStandingSprite, firstTag } from "./sprites";
import { showTag } from "./uiKit";

// An owner's full-body 32x48 sprite, keyed by their dog like the faces.
export function ownerSpriteKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `owner-${data.dogs[dog].art}`;
}

// An owner standing with their feet at footY: their full-body sprite playing the first of
// tags it has, else their happy face standing on the same line.
export function addOwnerFigure(
  scene: Scene,
  data: Pick<GameData, "dogs">,
  reducedMotion: boolean,
  dog: DogId,
  at: { footY: number; x: number },
  tags: readonly string[],
): GameObjects.Sprite {
  const body = ownerSpriteKey(data, dog);
  if (scene.textures.exists(body)) {
    const sprite = addStandingSprite(scene, body, at.x, at.footY);
    const tag = firstTag(scene, body, tags);
    if (tag !== undefined) {
      showTag(reducedMotion, sprite, body, tag);
    }
    return sprite;
  }
  const face = ownerFaceKey(data, dog);
  const sprite = scene.add.sprite(Math.round(at.x), Math.round(at.footY), face).setOrigin(0.5, 1);
  showTag(true, sprite, face, "happy");
  return sprite;
}
