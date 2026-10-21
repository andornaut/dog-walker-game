import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { PULL_ART } from "../assets/spriteKeys";
import type { DogId } from "../data/types";
import { PALETTE } from "./palette";
import { playEffect, playTag, playTagOnce, spriteTopY } from "./sprites";

// A frame of a texture: its first frame when frame is absent.
interface IconArt {
  readonly frame?: string | undefined;
  readonly key: string;
}

// What a straining dog shows over its head. top is its centre column and top opaque row on
// screen. The bubble holds icon; target is what the dotted line and arrow point to, and
// blocked marks a strain the fairness rule holds back.
export interface DogSignal {
  readonly blocked: boolean;
  readonly dog: DogId;
  readonly icon: IconArt;
  readonly target: { readonly x: number; readonly y: number } | null;
  readonly top: { readonly x: number; readonly y: number };
}

// The bubble's frame is 32x28: its tail tip, row 27, sits a row above the dog's top, the icon
// at (8,6) and the blocked mark at (21,1).
const BUBBLE = { blocked: { x: 21, y: 1 }, height: 28, icon: { x: 8, y: 6 }, width: 32 };
const ICON_SIZE = 16;
// The pull line: 2x2 dots in a 1px rim, every 7px, ending in a 7x7 arrowhead in a rim.
const LINE = { arrow: 7, dot: 2, spacing: 7 };
// The show tag's frames during which the bubble is too small to hold the icon.
const SHOW_FRAMES_WITHOUT_ICON = 2;

// The first frame of a texture, so a sprite sheet such as the treat's can stand in as an icon.
function firstFrame(scene: Scene, key: string): string | undefined {
  return scene.textures.exists(key) ? scene.textures.get(key).getFrameNames()[0] : undefined;
}

// The bubble's texture: the art's, or a drawn white bubble with a tail.
function bubbleKey(scene: Scene): string {
  if (scene.textures.exists(PULL_ART.bubble)) {
    return PULL_ART.bubble;
  }
  const key = `${PULL_ART.bubble}-drawn`;
  if (!scene.textures.exists(key)) {
    const { height, width } = BUBBLE;
    const g = scene.make.graphics({}, false);
    g.fillStyle(PALETTE.plum).fillRect(2, 0, width - 4, height - 5);
    g.fillStyle(PALETTE.white).fillRect(3, 1, width - 6, height - 7);
    g.fillStyle(PALETTE.plum).fillRect(width / 2 - 2, height - 5, 4, 4);
    g.fillStyle(PALETTE.white).fillRect(width / 2 - 1, height - 6, 2, 4);
    g.fillStyle(PALETTE.plum).fillRect(width / 2, height - 1, 1, 1);
    g.generateTexture(key, width, height);
    g.destroy();
  }
  return key;
}

// A 16x16 letter in a circle, standing in for icon art not loaded.
function letterIcon(scene: Scene, key: string, letter: string, color: number): string {
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    const context = canvas?.getContext();
    if (canvas === null || context === undefined) {
      return key;
    }
    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.beginPath();
    context.arc(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "bold 11px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(letter, ICON_SIZE / 2, ICON_SIZE / 2 + 1);
    canvas.refresh();
  }
  return key;
}

// Any icon key: the art's first frame, or a letter for it.
export function iconArt(scene: Scene, key: string, letter: string): IconArt {
  return scene.textures.exists(key)
    ? { frame: firstFrame(scene, key), key }
    : { key: letterIcon(scene, `${key}-drawn`, letter, PALETTE.blue) };
}

// The blocked mark's texture: the art's, or a red X.
function blockedKey(scene: Scene): string {
  return scene.textures.exists(PULL_ART.pullBlocked)
    ? PULL_ART.pullBlocked
    : letterIcon(scene, `${PULL_ART.pullBlocked}-drawn`, "X", PALETTE.red);
}

interface Bubble {
  readonly blocked: GameObjects.Image;
  readonly frame: GameObjects.Sprite;
  readonly icon: GameObjects.Image;
}

// The bubbles over the dogs and the strain's dotted line and arrow, redrawn every frame.
export class PullSignals {
  private readonly bubbles = new Map<DogId, Bubble>();
  private readonly lines: GameObjects.Graphics;

  constructor(
    private readonly scene: Scene,
    private readonly depth: number,
  ) {
    this.lines = scene.add.graphics().setDepth(depth);
  }

  draw(signals: readonly DogSignal[], still: boolean): void {
    this.lines.clear();
    for (const [dog, bubble] of this.bubbles) {
      if (!signals.some((signal) => signal.dog === dog)) {
        [bubble.frame, bubble.icon, bubble.blocked].forEach((part) => part.destroy());
        this.bubbles.delete(dog);
      }
    }
    for (const signal of signals) {
      const bubble = this.bubbles.get(signal.dog) ?? this.addBubble(signal.dog, still);
      const left = Math.round(signal.top.x) - BUBBLE.width / 2;
      const top = Math.round(signal.top.y) - 1 - (BUBBLE.height - 1);
      bubble.frame.setPosition(left, top);
      bubble.icon
        .setTexture(signal.icon.key, signal.icon.frame)
        .setDisplaySize(ICON_SIZE, ICON_SIZE)
        .setPosition(left + BUBBLE.icon.x, top + BUBBLE.icon.y)
        .setVisible(!this.showingSmall(bubble));
      bubble.blocked
        .setPosition(left + BUBBLE.blocked.x, top + BUBBLE.blocked.y)
        .setVisible(signal.blocked);
      if (signal.target !== null) {
        const from = { x: left + BUBBLE.width / 2, y: top + BUBBLE.height / 2 };
        this.dottedArrow(from, signal.target);
      }
    }
  }

  private addBubble(dog: DogId, still: boolean): Bubble {
    const { depth, scene } = this;
    const key = bubbleKey(scene);
    const bubble: Bubble = {
      blocked: scene.add
        .image(0, 0, blockedKey(scene), firstFrame(scene, blockedKey(scene)))
        .setOrigin(0)
        .setDepth(depth + 2),
      frame: scene.add.sprite(0, 0, key, firstFrame(scene, key)).setOrigin(0).setDepth(depth),
      icon: scene.add
        .image(0, 0, "__DEFAULT")
        .setOrigin(0)
        .setDepth(depth + 1),
    };
    if (still) {
      playTag(bubble.frame, key, "idle", true);
    } else {
      playTagOnce(bubble.frame, key, "show", () => playTag(bubble.frame, key, "idle"));
    }
    this.bubbles.set(dog, bubble);
    return bubble;
  }

  private showing(bubble: Bubble): boolean {
    return bubble.frame.anims.currentAnim?.key === animationKey(bubble.frame.texture.key, "show");
  }

  // The show tag's first frames, which the bubble swells through before the icon fits.
  private showingSmall(bubble: Bubble): boolean {
    const { currentAnim, currentFrame } = bubble.frame.anims;
    return (
      this.showing(bubble) &&
      currentAnim !== null &&
      currentFrame !== null &&
      currentAnim.frames.indexOf(currentFrame) < SHOW_FRAMES_WITHOUT_ICON
    );
  }

  // Dots from outside the bubble to the arrowhead, which points at the target.
  private dottedArrow(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= BUBBLE.width / 2 + LINE.arrow) {
      return;
    }
    const ux = dx / length;
    const uy = dy / length;
    const g = this.lines;
    for (let at = BUBBLE.width / 2; at < length - LINE.arrow; at += LINE.spacing) {
      const x = Math.round(from.x + ux * at) - LINE.dot / 2;
      const y = Math.round(from.y + uy * at) - LINE.dot / 2;
      g.fillStyle(PALETTE.plum).fillRect(x - 1, y - 1, LINE.dot + 2, LINE.dot + 2);
      g.fillStyle(PALETTE.yellow).fillRect(x, y, LINE.dot, LINE.dot);
    }
    const head = (size: number, color: number, inset: number) => {
      const tip = { x: to.x - ux * inset, y: to.y - uy * inset };
      const base = { x: tip.x - ux * size, y: tip.y - uy * size };
      const half = size / 2;
      g.fillStyle(color).fillTriangle(
        Math.round(tip.x),
        Math.round(tip.y),
        Math.round(base.x - uy * half),
        Math.round(base.y + ux * half),
        Math.round(base.x + uy * half),
        Math.round(base.y - ux * half),
      );
    };
    head(LINE.arrow + 2, PALETTE.plum, 0);
    head(LINE.arrow, PALETTE.yellow, 1);
  }
}

// A dog sprite's centre column and top opaque row on screen.
export function dogTop(sprite: GameObjects.Sprite): { x: number; y: number } {
  const { displayOriginX, displayOriginY, frame, scaleX, scaleY, x, y } = sprite;
  return {
    x: Math.round(x + (frame.realWidth / 2 - displayOriginX) * scaleX),
    y: Math.round(y + (spriteTopY(sprite.scene, sprite.texture.key) - displayOriginY) * scaleY),
  };
}

// The burst over a dog whose blocked strain ended without a pull: bottom-centre on its centre
// column, 6px below its top opaque row.
export function playPullFail(scene: Scene, top: { x: number; y: number }, depth: number): void {
  playEffect(scene, PULL_ART.pullFail, "play", { x: top.x, y: top.y + 6 }, depth)?.setOrigin(
    0.5,
    1,
  );
}
