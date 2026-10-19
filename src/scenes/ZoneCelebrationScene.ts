import { type GameObjects, Math as PhaserMath, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { ZONE_CELEBRATION_ART as ART } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  type CelebrationText,
  celebrationText,
  type ZoneCelebration,
} from "../hud/zoneCelebration";
import { cardNumberForKey, isConfirmKey, isPauseKey } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { containsPoint, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { PHONE_EVENTS } from "../pwa";
import { addDim, fillRect } from "./draw";
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

// Zone done moves on by itself after this long.
const ZONE_DONE_MS = 2000;
// Over the backdrop and the road, top to bottom: the banner, the walker standing at scale,
// the panel of lines, then the button. Text lines are 12 apart at 2x.
const BANNER = { height: 48, titleY: 24, width: 248, y: 24 };
const WALKER = { footY: 236, runFromX: 72, runMs: 700, scale: 3 };
const PANEL = { lineHeight: 12, pad: 10, width: 312, y: 256 };
const BUTTON = { gap: 12, height: 44, keyRise: 14, width: 264 };
const HOP = { durationMs: 180, height: 6, repeatDelayMs: 420 };
// The drawn confetti, while fx-celebration-confetti is missing: flakes that fall the field's
// height, each starting at a random height and speed.
const FLAKES = {
  colors: ["amber", "cyan", "green", "mauve", "pink", "yellow"],
  count: 40,
} as const;
const FLAKE = { fallMs: [1600, 2800], height: 3, width: 2 } as const;

// Between zones, over the paused walk: the walker cheers under the zone's earnings and moves
// on after ZONE_DONE_MS or a tap; or a newly unlocked walker runs in, greets the pack and waits
// for Welcome! (key 1). Confetti falls in both, unless motion is reduced.
export class ZoneCelebrationScene extends Scene {
  private done = false;

  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    this.done = false;
    const { celebration } = data;
    const reduced = currentSettings(this).reducedMotion;
    const { dogRow, topBar } = screenLayout(SCREEN_CONFIG);
    const field: Rect = {
      height: dogRow.y - topBar.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: topBar.height,
    };
    addDim(this, field);
    if (!reduced) {
      this.addConfetti(field);
    }
    const text = celebrationText(gameData, celebration);
    const centerX = field.x + field.width / 2;
    this.addBanner(centerX, field.y + BANNER.y, text.title);
    this.addWalker(celebration, reduced, centerX, field.y + WALKER.footY);
    const panelBottom = this.addLines(centerX, field.y + PANEL.y, text.lines);
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
    if (text.button === null) {
      this.time.delayedCall(ZONE_DONE_MS, finish);
      listenTargetPress<Rect>(this, {
        onPressed: () => undefined,
        onTap: finish,
        targetAt: (x, y) => (containsPoint(field, x, y) ? field : undefined),
      });
      return;
    }
    this.addButton(centerX, panelBottom + BUTTON.gap, text, finish);
  }

  // The banner art with the title on it, ui-zone-banner while it is missing, or a cream band.
  private addBanner(centerX: number, y: number, title: string): void {
    const x = Math.round(centerX - BANNER.width / 2);
    const key = [ART.banner, ART.bannerStandIn].find((art) => this.textures.exists(art));
    if (key === undefined) {
      const g = this.add.graphics();
      fillRect(g, PALETTE.cream, { height: BANNER.height, width: BANNER.width, x, y });
    } else {
      this.add.image(Math.round(centerX), y, key).setOrigin(0.5, 0);
    }
    const style = { color: PALETTE.plum, font: "title", originX: 0.5, originY: 0.5 } as const;
    const label = addPixelText(this, centerX, y + BANNER.titleY, title, {
      ...style,
      scale: TEXT_SCALE,
    });
    if (label.width > BANNER.width - 16) {
      label.setScale(1);
    }
  }

  // The walker in use cheers, hopping unless motion is reduced; a new walker runs in from the
  // right, then waves.
  private addWalker(
    celebration: ZoneCelebration,
    reduced: boolean,
    centerX: number,
    footY: number,
  ): void {
    const key = walkerSpriteKey(this, celebration.walker);
    const sprite = addStandingSprite(this, key, centerX, footY).setScale(WALKER.scale);
    const play = (tags: readonly string[]) => {
      const tag = firstTag(this, key, tags);
      if (tag !== undefined) {
        playTag(sprite, key, tag, reduced);
      }
    };
    if (celebration.kind === "zoneDone") {
      play(ART.walkerTags.cheer);
      if (!reduced && !this.anims.exists(animationKey(key, ART.walkerTags.cheer[0]))) {
        this.hop(sprite);
      }
      return;
    }
    if (reduced) {
      play(ART.walkerTags.joined);
      return;
    }
    play(ART.walkerTags.run);
    sprite.setX(centerX + WALKER.runFromX * WALKER.scale);
    this.tweens.add({
      duration: WALKER.runMs,
      ease: "Sine.easeOut",
      onComplete: () => play(ART.walkerTags.joined),
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

  // The lines, wrapped, in a panel under the walker. Returns the panel's bottom.
  private addLines(centerX: number, y: number, lines: readonly string[]): number {
    const style = { color: PALETTE.plum, originX: 0.5, scale: TEXT_SCALE } as const;
    const wrapped = lines.flatMap((line) =>
      wrapPixelText(this, style, PANEL.width - PANEL.pad * 2, line),
    );
    const height = PANEL.pad * 2 + wrapped.length * PANEL.lineHeight - 4;
    const rect = { height, width: PANEL.width, x: Math.round(centerX - PANEL.width / 2), y };
    addPanel(this, rect);
    wrapped.forEach((line, i) => {
      addPixelText(this, centerX, y + PANEL.pad + i * PANEL.lineHeight, line, style);
    });
    return y + height;
  }

  // Welcome!, with the key that presses it above it once a key has been pressed.
  private addButton(centerX: number, y: number, text: CelebrationText, onTap: () => void): void {
    const rect = {
      height: BUTTON.height,
      width: BUTTON.width,
      x: Math.round(centerX - BUTTON.width / 2),
      y,
    };
    const button = addMenuButton(this, rect, text.button ?? "", {
      available: true,
      primary: true,
    });
    listenButtonTap(this, button, onTap);
    if (keyNumbersShown()) {
      addPixelText(this, centerX, y - BUTTON.keyRise, "1", {
        color: PALETTE.amber,
        font: "title",
        originX: 0.5,
      });
    }
  }

  // fx-celebration-confetti looping across the field, or drawn flakes falling through it.
  private addConfetti(field: Rect): void {
    if (this.anims.exists(animationKey(ART.confetti, ART.confettiTag))) {
      const sprite = this.add.sprite(field.x + field.width / 2, field.y, ART.confetti);
      sprite
        .setOrigin(0.5, 0)
        .play({ key: animationKey(ART.confetti, ART.confettiTag), repeat: -1 });
      return;
    }
    for (let i = 0; i < FLAKES.count; i++) {
      const color = PALETTE[FLAKES.colors[i % FLAKES.colors.length] ?? "amber"];
      const x = field.x + PhaserMath.Between(0, field.width - FLAKE.width);
      const flake = this.add.rectangle(x, field.y, FLAKE.width, FLAKE.height, color).setOrigin(0);
      const duration = PhaserMath.Between(...FLAKE.fallMs);
      const tween = this.tweens.add({
        duration,
        repeat: -1,
        targets: flake,
        y: field.y + field.height - FLAKE.height,
      });
      tween.seek(PhaserMath.Between(0, duration));
    }
  }
}
