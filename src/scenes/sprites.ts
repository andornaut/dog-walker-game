import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import type { SpriteAnchor } from "../assets/manifest";
import { spriteAnchor } from "../assets/spriteAnchor";
import { depthVariantKey, ROAD_SPRITE_SIZE, standsOnGround } from "../assets/spriteKeys";
import { type DepthArt, type DepthDraw, depthDraw } from "../layout/depthScale";
import { opaqueBoundsOfRgba, type PixelBounds } from "../layout/pixelShapes";
import { SCALE_STEPS } from "../layout/projection";

// feetY is the line the sprite stands on, measured from the top of its frame, and
// opaqueWidth how wide its drawn pixels are; both from its first frame.
interface SpriteMetrics {
  feetY: number;
  frameHeight: number;
  frameWidth: number;
  opaqueWidth: number;
}

const measured = new Map<string, SpriteMetrics>();
const tops = new Map<string, number>();
let scanCanvas: HTMLCanvasElement | undefined;

// The opaque bounds of a loaded sprite's first frame, from one read of its pixels, in the
// whole frame: a trimmed frame's pixels are drawn at their offset in it.
function firstFrameBounds(scene: Scene, key: string): PixelBounds | undefined {
  const texture = scene.textures.get(key);
  const frame = texture.get(texture.getFrameNames()[0] ?? "__BASE");
  const { cutHeight, cutWidth, cutX, cutY, realHeight: height, realWidth: width } = frame;
  scanCanvas ??= document.createElement("canvas");
  scanCanvas.width = width;
  scanCanvas.height = height;
  const context = scanCanvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return undefined;
  }
  context.clearRect(0, 0, width, height);
  const image = frame.source.image as CanvasImageSource;
  context.drawImage(image, cutX, cutY, cutWidth, cutHeight, frame.x, frame.y, cutWidth, cutHeight);
  return opaqueBoundsOfRgba(width, height, context.getImageData(0, 0, width, height).data);
}

// Records a loaded sprite's feet line once, so sprites of different sizes stand on the same
// line: from the manifest's anchor, or else from one read of its first frame's pixels.
// Sprites that do not stand on the ground are not measured.
export function measureSprite(scene: Scene, key: string, anchor: SpriteAnchor | undefined): void {
  const texture = scene.textures.get(key);
  const frame = texture.get(texture.getFrameNames()[0] ?? "__BASE");
  const { realHeight: height, realWidth: width } = frame;
  if (anchor !== undefined) {
    measured.set(key, { ...anchor, frameHeight: height, frameWidth: width });
    return;
  }
  if (!standsOnGround(key)) {
    return;
  }
  measured.set(key, {
    ...spriteAnchor(firstFrameBounds(scene, key), width, height),
    frameHeight: height,
    frameWidth: width,
  });
}

// A loaded sprite's top opaque row in its first frame, read from its pixels on first use and
// kept: the manifest's anchors give only the feet line and width.
export function spriteTopY(scene: Scene, key: string): number {
  let top = tops.get(key);
  if (top === undefined) {
    top = scene.textures.exists(key) ? (firstFrameBounds(scene, key)?.top ?? 0) : 0;
    tops.set(key, top);
  }
  return top;
}

const depthArts = new Map<string, DepthArt[]>();

// A road sprite's loaded art steps, 1x first, read once.
function depthArtsOf(scene: Scene, key: string): DepthArt[] {
  let arts = depthArts.get(key);
  if (arts === undefined) {
    arts = SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key)
      .filter((art) => art === key || scene.textures.exists(art))
      .map((art) => {
        const { feetY, frameHeight, frameWidth } = spriteMetrics(art);
        return { feetY, height: frameHeight, key: art, width: frameWidth };
      });
    depthArts.set(key, arts);
  }
  return arts;
}

// Shows a road sprite at its projected scale by depthDraw, the one rule for every road
// sprite: on its art's feet line or, with feet "bottom", its frame's bottom. A changed
// texture carries on the same tag from the same frame.
export function showAtDepth(
  sprite: GameObjects.Sprite,
  key: string,
  projected: number,
  feet: "anchor" | "bottom" = "anchor",
): DepthDraw {
  const drawn = depthDraw(depthArtsOf(sprite.scene, key), projected);
  if (sprite.texture.key !== drawn.key) {
    const current = sprite.anims.currentAnim;
    const frame = sprite.anims.currentFrame;
    const startFrame = current !== null && frame !== null ? current.frames.indexOf(frame) : 0;
    const tag = current?.key.slice(current.key.indexOf(":") + 1);
    const paused = sprite.anims.isPaused;
    sprite.setTexture(drawn.key);
    sprite.setOrigin(0.5, feet === "bottom" ? 1 : drawn.originY);
    const next = tag === undefined ? undefined : animationKey(drawn.key, tag);
    if (next !== undefined && sprite.scene.anims.exists(next)) {
      sprite.play({ key: next, startFrame: Math.max(0, startFrame) });
      if (paused) {
        sprite.anims.pause();
      }
    }
  }
  sprite.setScale(drawn.scale);
  return drawn;
}

// The first of tags the sprite has an animation for.
export function firstTag(scene: Scene, key: string, tags: readonly string[]): string | undefined {
  return tags.find((tag) => scene.anims.exists(animationKey(key, tag)));
}

export function spriteMetrics(key: string): SpriteMetrics {
  const side = ROAD_SPRITE_SIZE;
  return (
    measured.get(key) ?? {
      feetY: side,
      frameHeight: side,
      frameWidth: side,
      opaqueWidth: side * 0.75,
    }
  );
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
  measured.set(key, {
    feetY: height,
    frameHeight: height,
    frameWidth: width,
    opaqueWidth: width - 4,
  });
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
