import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import type { SpriteAnchor } from "../assets/manifest";
import { depthVariantKey, standsOnGround } from "../assets/spriteKeys";
import { opaqueBoundsOfRgba } from "../layout/pixelShapes";
import type { ScaleStep } from "../layout/projection";

// feetY is the line the sprite stands on, measured from the top of its frame, and
// opaqueWidth how wide its drawn pixels are; both from its first frame.
export interface SpriteMetrics {
  feetY: number;
  frameHeight: number;
  opaqueWidth: number;
}

const measured = new Map<string, SpriteMetrics>();
let scanCanvas: HTMLCanvasElement | undefined;

// Records a loaded sprite's feet line once, so sprites of different sizes stand on the same
// line: from the manifest's anchor, or else from one read of its first frame's pixels.
// Sprites that do not stand on the ground are not measured.
export function measureSprite(scene: Scene, key: string, anchor: SpriteAnchor | undefined): void {
  const texture = scene.textures.get(key);
  const frame = texture.get(texture.getFrameNames()[0] ?? "__BASE");
  const { height, width } = frame;
  if (anchor !== undefined) {
    measured.set(key, { ...anchor, frameHeight: height });
    return;
  }
  if (!standsOnGround(key)) {
    return;
  }
  scanCanvas ??= document.createElement("canvas");
  scanCanvas.width = width;
  scanCanvas.height = height;
  const context = scanCanvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return;
  }
  context.clearRect(0, 0, width, height);
  const image = frame.source.image as CanvasImageSource;
  context.drawImage(image, frame.cutX, frame.cutY, width, height, 0, 0, width, height);
  const bounds = opaqueBoundsOfRgba(width, height, context.getImageData(0, 0, width, height).data);
  measured.set(key, {
    feetY: bounds?.bottom ?? height,
    frameHeight: height,
    opaqueWidth: bounds === undefined ? width : bounds.right - bounds.left,
  });
}

// How a road sprite shows at a depth step: its hand-drawn variant when one is loaded, else
// the sprite scaled at runtime.
export interface DepthLook {
  key: string;
  scale: number;
}

export function depthLook(scene: Scene, key: string, step: ScaleStep): DepthLook {
  const variant = depthVariantKey(key, step);
  return variant !== null && scene.textures.exists(variant)
    ? { key: variant, scale: 1 }
    : { key, scale: step };
}

// Switches a standing sprite to a depth look, on its feet line or, with feet "bottom", its
// frame's bottom. A changed texture carries on the same tag from the same frame.
export function showDepthLook(
  sprite: GameObjects.Sprite,
  look: DepthLook,
  feet: "anchor" | "bottom" = "anchor",
): void {
  if (sprite.texture.key !== look.key) {
    const current = sprite.anims.currentAnim;
    const frame = sprite.anims.currentFrame;
    const startFrame = current !== null && frame !== null ? current.frames.indexOf(frame) : 0;
    const tag = current?.key.slice(current.key.indexOf(":") + 1);
    const paused = sprite.anims.isPaused;
    sprite.setTexture(look.key);
    const { feetY, frameHeight } = spriteMetrics(look.key);
    sprite.setOrigin(0.5, feet === "bottom" ? 1 : feetY / frameHeight);
    const next = tag === undefined ? undefined : animationKey(look.key, tag);
    if (next !== undefined && sprite.scene.anims.exists(next)) {
      sprite.play({ key: next, startFrame: Math.max(0, startFrame) });
      if (paused) {
        sprite.anims.pause();
      }
    }
  }
  sprite.setScale(look.scale);
}

// The first of tags the sprite has an animation for.
export function firstTag(scene: Scene, key: string, tags: readonly string[]): string | undefined {
  return tags.find((tag) => scene.anims.exists(animationKey(key, tag)));
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
): GameObjects.Sprite | undefined {
  if (!scene.textures.exists(key) || !scene.anims.exists(animationKey(key, tag))) {
    return undefined;
  }
  const sprite = scene.add.sprite(Math.round(point.x), Math.round(point.y), key).setDepth(depth);
  playTagOnce(sprite, key, tag, () => sprite.destroy());
  return sprite;
}
