import { type GameObjects, Math as PhaserMath, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { ZONE_CELEBRATION_ART as ART } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  type CelebrationText,
  celebrationText,
  type LinePart,
  type ZoneCelebration,
} from "../hud/zoneCelebration";
import { cardNumberForKey, isConfirmKey, isPauseKey } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { containsPoint, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { PHONE_EVENTS } from "../pwa";
import { addConfetti } from "./badges";
import { addDisplayText } from "./displayText";
import { addDim } from "./draw";
import { closeOverlay, onWindowEvent, type OverlayData } from "./overlay";
import { PALETTE } from "./palette";
import { addPixelText, wrapPixelText } from "./pixelText";
import { currentSettings, walkerSpriteKey } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addStandingSprite, firstTag, playTag } from "./sprites";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addPanel, listenButtonTap, TEXT_SCALE } from "./uiKit";

export interface ZoneCelebrationSceneData extends OverlayData {
  celebration: ZoneCelebration;
  // Called once the celebration has closed and the run scene is resumed.
  onDone: () => void;
  // Opens the pause menu over the celebration, which pauses it.
  openPause: () => void;
}

type NewWalkerText = Extract<CelebrationText, { kind: "newWalker" }>;

// Zone done moves on by itself after this long.
const ZONE_DONE_MS = 2000;
// One stack, centred in the dimmed road, as offsets from its top: the 2x title and the
// subtitle under it, the starburst with the walker at 2x on it, then the plate or the bubble
// and the button. Text lines are 12 apart at 2x.
const HEAD = { subtitleY: 30, titleY: 0 };
const BURST = { centerY: 105, height: 132, spikes: 18, width: 148 };
const WALKER = { footY: 160, hopInMs: 700, scale: 2 };
const LINES = { lineHeight: 12, pad: 9, y: 176 };
const PLATE = { width: 280 };
const BUBBLE = { tailHeight: 6, tailWidth: 8, width: 312 };
const INFO = { gap: 3, icon: 16 };
const BUTTON = { gap: 16, height: 44, keyRise: 14, width: 264 };
const HOP = { durationMs: 180, height: 6, repeatDelayMs: 420 };
// About this many confetti bits fall down the road over totalMs, each for a while from a
// staggered start.
const CONFETTI = { bits: 60, fallMs: [800, 1400], size: 6, totalMs: 2000 } as const;

// Between zones, over the paused walk: the walker cheers on a starburst under the zone's name
// and earnings, and moves on after ZONE_DONE_MS or a tap; or a newly unlocked walker hops in,
// greets the pack in a bubble with their pace and style, and waits for Welcome! (key 1).
// Confetti falls in both, unless motion is reduced.
export class ZoneCelebrationScene extends Scene {
  private done = false;

  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    this.done = false;
    const reduced = currentSettings(this).reducedMotion;
    const { roadView: road } = screenLayout(SCREEN_CONFIG);
    addDim(this, road);
    if (!reduced) {
      this.dropConfetti(road);
    }
    const text = celebrationText(gameData, data.celebration);
    const centerX = road.x + road.width / 2;
    const button = text.kind === "newWalker" ? BUTTON.gap + BUTTON.height : 0;
    const height = LINES.y + this.linesHeight(text) + button;
    const top = Math.round(road.y + (road.height - height) / 2);
    this.addHeadline(centerX, top, text);
    this.addBurst(centerX, top + BURST.centerY);
    this.addWalker(data.celebration, reduced, centerX, top + WALKER.footY);
    soundboardOf(this).play("badge");

    const finish = () => {
      if (this.done) {
        return;
      }
      this.done = true;
      closeOverlay(data.resume, this);
      data.onDone();
    };
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isPauseKey(event.key)) {
        data.openPause();
      } else if (isConfirmKey(event.key) || cardNumberForKey(1, event.key) !== undefined) {
        finish();
      }
    });
    onWindowEvent(this, PHONE_EVENTS.backPressed, data.openPause);
    const linesY = top + LINES.y;
    if (text.kind === "zoneDone") {
      this.addPlate(centerX, linesY, text.earnings);
      this.time.delayedCall(ZONE_DONE_MS, finish);
      listenTargetPress<Rect>(this, {
        onPressed: () => undefined,
        onTap: finish,
        targetAt: (x, y) => (containsPoint(road, x, y) ? road : undefined),
      });
      return;
    }
    const bubbleBottom = this.addBubble(centerX, linesY, text);
    this.addButton(centerX, bubbleBottom + BUTTON.gap, text.button, finish);
  }

  private linesHeight(text: CelebrationText): number {
    const lines = text.kind === "zoneDone" ? 1 : this.greetingLines(text.greeting).length + 1;
    return LINES.pad * 2 + lines * LINES.lineHeight;
  }

  private greetingLines(greeting: string): string[] {
    const style = { color: PALETTE.plum, scale: TEXT_SCALE };
    return wrapPixelText(this, style, BUBBLE.width - LINES.pad * 2, greeting);
  }

  // The title in font-display at 2x, and the subtitle in font-display-cream under it.
  private addHeadline(centerX: number, top: number, text: CelebrationText): void {
    addDisplayText(this, centerX, top + HEAD.titleY, text.title, {
      color: PALETTE.yellow,
      font: "title",
      originX: 0.5,
      scale: 2,
    });
    addDisplayText(this, centerX, top + HEAD.subtitleY, text.subtitle, {
      color: PALETTE.cream,
      font: "title",
      originX: 0.5,
      variant: "cream",
    });
  }

  // ui-celebrate-burst, or a drawn starburst: amber spikes round a yellow disc.
  private addBurst(centerX: number, centerY: number): void {
    if (this.textures.exists(ART.burst)) {
      this.add.image(Math.round(centerX), Math.round(centerY), ART.burst);
      return;
    }
    const outer = { x: BURST.width / 2, y: BURST.height / 2 };
    const inner = { x: outer.x * 0.72, y: outer.y * 0.72 };
    const points = Array.from({ length: BURST.spikes * 2 }, (_, i) => {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (i * Math.PI) / BURST.spikes;
      return new PhaserMath.Vector2(
        centerX + Math.cos(angle) * radius.x,
        centerY + Math.sin(angle) * radius.y,
      );
    });
    const g = this.add.graphics();
    g.fillStyle(PALETTE.amber).fillPoints(points, true);
    g.lineStyle(1, PALETTE.ink).strokePoints(points, true);
    g.fillStyle(PALETTE.yellow).fillEllipse(centerX, centerY, inner.x * 1.8, inner.y * 1.8);
  }

  // The walker cheers at 2x, hopping while the cheer is missing. A new walker hops in from the
  // right edge in the cheer, and fx-confetti bursts as they land. Reduced motion shows the
  // cheer's first frame, in place.
  private addWalker(
    celebration: ZoneCelebration,
    reduced: boolean,
    centerX: number,
    footY: number,
  ): void {
    const key = walkerSpriteKey(this, celebration.walker);
    const sprite = addStandingSprite(this, key, centerX, footY).setScale(WALKER.scale);
    const tag = firstTag(this, key, ART.walkerTags);
    if (tag !== undefined) {
      playTag(sprite, key, tag, reduced);
    }
    if (reduced) {
      return;
    }
    if (!this.anims.exists(animationKey(key, ART.walkerTags[0]))) {
      this.hop(sprite);
    }
    if (celebration.kind === "zoneDone") {
      return;
    }
    sprite.setX(SCREEN_CONFIG.width + sprite.displayWidth / 2);
    this.tweens.add({
      duration: WALKER.hopInMs,
      ease: "Sine.easeOut",
      onComplete: () => addConfetti(this, false, 1, centerX, footY - sprite.displayHeight / 2),
      targets: sprite,
      x: Math.round(centerX),
    });
  }

  private hop(sprite: GameObjects.Sprite): void {
    this.tweens.add({
      duration: HOP.durationMs,
      ease: "Sine.easeOut",
      repeat: -1,
      repeatDelay: HOP.repeatDelayMs,
      targets: sprite,
      y: sprite.y - HOP.height,
      yoyo: true,
    });
  }

  // The zone's earnings on a cream plate.
  private addPlate(centerX: number, y: number, earnings: string): void {
    const height = LINES.pad * 2 + LINES.lineHeight;
    addPanel(this, { height, width: PLATE.width, x: Math.round(centerX - PLATE.width / 2), y });
    addPixelText(this, centerX, y + LINES.pad, earnings, {
      color: PALETTE.plum,
      originX: 0.5,
      scale: TEXT_SCALE,
    });
  }

  // The greeting in a speech bubble whose tail points up at the walker, and the walker's pace
  // and style under it. Returns the bubble's bottom.
  private addBubble(centerX: number, y: number, text: NewWalkerText): number {
    const lines = this.greetingLines(text.greeting);
    const height = LINES.pad * 2 + (lines.length + 1) * LINES.lineHeight;
    const x = Math.round(centerX - BUBBLE.width / 2);
    addPanel(this, { height, width: BUBBLE.width, x, y }, "ui-quip");
    this.addTail(centerX, y);
    const style = { color: PALETTE.plum, originX: 0.5, scale: TEXT_SCALE } as const;
    lines.forEach((line, i) => {
      addPixelText(this, centerX, y + LINES.pad + i * LINES.lineHeight, line, style);
    });
    this.addInfo(centerX, y + LINES.pad + lines.length * LINES.lineHeight, text.info);
    return y + height;
  }

  // ui-quip-tail-up over the bubble's top rim, or a drawn cream tail.
  private addTail(centerX: number, bubbleY: number): void {
    const x = Math.round(centerX - BUBBLE.tailWidth / 2);
    const y = bubbleY - BUBBLE.tailHeight + 1;
    if (this.textures.exists(ART.tailUp)) {
      this.add.image(x, y, ART.tailUp).setOrigin(0);
      return;
    }
    const bottom = bubbleY + 1;
    this.add
      .graphics()
      .fillStyle(PALETTE.cream)
      .fillTriangle(centerX, y, x, bottom, x + BUBBLE.tailWidth, bottom);
  }

  // The line's parts side by side and centred, each name after its 16x16 icon once loaded.
  private addInfo(centerX: number, capY: number, parts: readonly LinePart[]): void {
    const style = { color: PALETTE.plum, scale: TEXT_SCALE } as const;
    const placed = parts.flatMap((part) => {
      const label = { gap: 0, item: addPixelText(this, 0, capY, part.text, style) };
      if (!("icon" in part) || !this.textures.exists(part.icon)) {
        return [label];
      }
      const iconY = Math.round(capY + 5 - INFO.icon / 2);
      return [{ gap: INFO.gap, item: this.add.image(0, iconY, part.icon).setOrigin(0) }, label];
    });
    const total = placed.reduce((sum, { gap, item }) => sum + item.displayWidth + gap, 0);
    let x = Math.round(centerX - total / 2);
    for (const { gap, item } of placed) {
      item.setX(x);
      x += item.displayWidth + gap;
    }
  }

  // Welcome!, with the key that presses it above it once a key has been pressed.
  private addButton(centerX: number, y: number, label: string, onTap: () => void): void {
    const rect = {
      height: BUTTON.height,
      width: BUTTON.width,
      x: Math.round(centerX - BUTTON.width / 2),
      y,
    };
    const button = addMenuButton(this, rect, label, { available: true, primary: true });
    listenButtonTap(this, button, onTap);
    if (keyNumbersShown()) {
      addPixelText(this, centerX, y - BUTTON.keyRise, "1", {
        color: PALETTE.amber,
        font: "title",
        originX: 0.5,
      });
    }
  }

  // CONFETTI.bits fx-confetti-bit sprites, each looping one colour's tag, or drawn bits, fall
  // down the road from staggered starts over CONFETTI.totalMs.
  private dropConfetti(road: Rect): void {
    const drawn = ART.confettiBitTags.filter((tag) =>
      this.anims.exists(animationKey(ART.confettiBit, tag)),
    );
    const { bits, fallMs, size, totalMs } = CONFETTI;
    for (let i = 0; i < bits; i++) {
      const colour = ART.confettiBitTags[i % ART.confettiBitTags.length] ?? "amber";
      const x = road.x + PhaserMath.Between(0, road.width - size);
      const bit = drawn.includes(colour)
        ? this.add
            .sprite(x, road.y, ART.confettiBit)
            .setOrigin(0)
            .play({ key: animationKey(ART.confettiBit, colour), repeat: -1 })
        : this.add.rectangle(x, road.y, size / 2, size / 2, PALETTE[colour]).setOrigin(0);
      const duration = PhaserMath.Between(...fallMs);
      bit.setVisible(false);
      this.tweens.add({
        delay: PhaserMath.Between(0, totalMs - duration),
        duration,
        onComplete: () => bit.destroy(),
        onStart: () => bit.setVisible(true),
        targets: bit,
        y: road.y + road.height - size,
      });
    }
  }
}
