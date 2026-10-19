import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { opaqueBounds } from "../layout/pixelShapes";

// feetY is the line the sprite stands on, measured from the top of its frame, and
// opaqueWidth how wide its drawn pixels are; both from its first frame.
export interface SpriteMetrics {
  feetY: number;
  frameHeight: number;
  opaqueWidth: number;
}

const measured = new Map<string, SpriteMetrics>();

// Measures a loaded sprite once, so sprites of different sizes stand on the same line.
export function measureSprite(scene: Scene, key: string): void {
  const texture = scene.textures.get(key);
  const frameName = texture.getFrameNames()[0] ?? "__BASE";
  const frame = texture.get(frameName);
  const bounds = opaqueBounds(
    frame.width,
    frame.height,
    (x, y) => scene.textures.getPixelAlpha(x, y, key, frameName) > 0,
  );
  measured.set(key, {
    feetY: bounds?.bottom ?? frame.height,
    frameHeight: frame.height,
    opaqueWidth: bounds === undefined ? frame.width : bounds.right - bounds.left,
  });
}

export function spriteMetrics(key: string): SpriteMetrics {
  return measured.get(key) ?? { feetY: 32, frameHeight: 32, opaqueWidth: 24 };
}

// A coloured box standing in for a sprite the art has not delivered or that failed to
// load: drawn with its bottom on the feet line, so it lines up with real sprites.
export function ensurePlaceholder(
  scene: Scene,
  key: string,
  size: { color: number; height: number; width: number },
): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const { color, height, width } = size;
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(color).fillRect(2, 2, width - 4, height - 2);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
  measured.set(key, { feetY: height, frameHeight: height, opaqueWidth: width - 4 });
}

// A sprite placed by the middle of its feet.
export function addStandingSprite(
  scene: Scene,
  key: string,
  x: number,
  footY: number,
): GameObjects.Sprite {
  const { feetY, frameHeight } = spriteMetrics(key);
  return scene.add
    .sprite(Math.round(x), Math.round(footY), key)
    .setOrigin(0.5, feetY / frameHeight);
}

// Plays one of the sprite's Aseprite tags, if it has it; a placeholder has none. still shows
// the tag's first frame instead, for reduced motion.
export function playTag(sprite: GameObjects.Sprite, key: string, tag: string, still = false): void {
  const animation = animationKey(key, tag);
  if (!sprite.scene.anims.exists(animation)) {
    return;
  }
  const current = sprite.anims.currentAnim?.key === animation;
  if (still) {
    if (!current || sprite.anims.isPlaying) {
      sprite.play(animation);
      sprite.anims.pause(sprite.anims.currentAnim?.frames[0]);
    }
    return;
  }
  if (!current) {
    sprite.play(animation);
  } else if (sprite.anims.isPaused) {
    sprite.anims.resume();
  }
}

// Plays a tag once, then calls done; done is called at once when the sprite lacks the tag.
export function playTagOnce(
  sprite: GameObjects.Sprite,
  key: string,
  tag: string,
  done: () => void,
): void {
  const animation = animationKey(key, tag);
  if (!sprite.scene.anims.exists(animation)) {
    done();
    return;
  }
  sprite.play({ key: animation, repeat: 0 });
  sprite.once(`animationcomplete-${animation}`, done);
}

// A one-shot effect, such as a burst, at a point: it plays its tag once and is destroyed.
// Nothing is drawn when the art is missing.
export function playEffect(
  scene: Scene,
  key: string,
  tag: string,
  point: { x: number; y: number },
  depth: number,
): void {
  if (!scene.textures.exists(key) || !scene.anims.exists(animationKey(key, tag))) {
    return;
  }
  const sprite = scene.add.sprite(Math.round(point.x), Math.round(point.y), key).setDepth(depth);
  playTagOnce(sprite, key, tag, () => sprite.destroy());
}
