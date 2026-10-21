import { type GameObjects, Math as PhaserMath, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { ZONE_CELEBRATION_ART as ART } from "../assets/spriteKeys";
import { gameData } from "../data";
import {
  CELEBRATION_LAYOUT as LAYOUT,
  GREETING_FIT,
  greetingLineTops,
} from "../hud/celebrationLayout";
import {
  type CelebrationText,
  celebrationText,
  type LinePart,
  type ZoneCelebration,
} from "../hud/zoneCelebration";
import { cardNumberForKey, isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { PHONE_EVENTS } from "../pwa";
import { addConfetti } from "./badges";
import { addDisplayText } from "./displayText";
import { fillRect } from "./draw";
import { closeOverlay, listenOutsideTap, onWindowEvent, type OverlayData } from "./overlay";
import { PALETTE } from "./palette";
import { addPixelText, fitPixelText, pixelFontMetrics, setPixelText } from "./pixelText";
import { currentSettings, walkerSpriteKey } from "./profileStore";
import { addRampDim } from "./rampDim";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { firstTag, playTag } from "./sprites";
import { addMenuButton, addPanel, listenButtonTap, TEXT_SCALE } from "./uiKit";

export interface ZoneCelebrationSceneData extends OverlayData {
  celebration: ZoneCelebration;
  // Called once the celebration has closed and the run scene is resumed.
  onDone: () => void;
  // Opens the pause menu over the celebration, which pauses it.
  openPause: () => void;
}

type NewWalkerText = Extract<CelebrationText, { kind: "newWalker" }>;
type ZoneDoneText = Extract<CelebrationText, { kind: "zoneDone" }>;
type Version = typeof LAYOUT.newWalker | typeof LAYOUT.zoneDone;

// Zone done moves on by itself after this long.
const ZONE_DONE_MS = 2000;
const BODY = { color: PALETTE.plum, scale: TEXT_SCALE } as const;
const KEY_RISE = 14;

// Places a label made with origin y 0 by the top of its font line.
function atLineTop<T extends GameObjects.BitmapText>(label: T, top: number): T {
  return label.setY(top);
}

// Between zones, over the paused walk: the walker cheers on a starburst under the zone's name
// and earnings, and moves on after ZONE_DONE_MS or a tap; or a newly unlocked walker hops in,
// greets the pack in a bubble with their agility and perk, and waits for Welcome! (key 1).
// Confetti falls in both, unless motion is reduced.
export class ZoneCelebrationScene extends Scene {
  private done = false;

  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    this.done = false;
    const reduced = currentSettings(this).reducedMotion;
    addRampDim(this, LAYOUT.dim);
    if (!reduced) {
      this.dropConfetti();
    }
    const text = celebrationText(gameData, data.celebration);
    const version: Version = text.kind === "zoneDone" ? LAYOUT.zoneDone : LAYOUT.newWalker;
    this.addHeadline(version, text);
    if (this.textures.exists(ART.burst)) {
      this.add.image(version.burst.x, version.burst.y, ART.burst).setOrigin(0);
    }
    this.addWalker(data.celebration, reduced, version.feetY);
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
      if (!menuKeyActs(event.repeat, event.key)) {
        return;
      }
      if (isPauseKey(event.key)) {
        data.openPause();
      } else if (isConfirmKey(event.key) || cardNumberForKey(1, event.key) !== undefined) {
        finish();
      }
    });
    onWindowEvent(this, PHONE_EVENTS.backPressed, data.openPause);
    if (text.kind === "zoneDone") {
      this.addPlate(text);
      this.time.delayedCall(ZONE_DONE_MS, finish);
      // A tap on the dim, or on the page beside the game, moves on.
      const area = { covered: [], dim: LAYOUT.dim };
      listenOutsideTap(this, () => area, finish);
      return;
    }
    this.addBubble(text);
    this.addButton(text.button, finish);
  }

  // The title in font-display at 2x, or smaller where it would not fit the screen, and the
  // subtitle in font-display-cream under it.
  private addHeadline(version: Version, text: CelebrationText): void {
    const { centerX, titleRoom, titleScale, titleStyles } = LAYOUT;
    const title = { color: PALETTE.yellow, font: "title", originX: 0.5 } as const;
    // addDisplayText draws the display font at 1x, so the title is scaled after.
    const big = addDisplayText(this, centerX, 0, text.title, title);
    const { scale } = fitPixelText(big, { room: titleRoom, styles: titleStyles }, centerX, 0).style;
    // A smaller title keeps its line's bottom row, so it stays over the subtitle.
    atLineTop(big, version.titleY + (big.height / scale) * (titleScale - scale));
    const subtitle = { ...title, color: PALETTE.cream, variant: "cream" } as const;
    atLineTop(addDisplayText(this, centerX, 0, text.subtitle, subtitle), version.subtitleY);
  }

  // The walker's cheer at 2x, its frame's bottom centre on the feet line. A new walker hops in
  // from past the right edge, and fx-confetti bursts as they land. Reduced motion shows the
  // cheer's first frame, in place.
  private addWalker(celebration: ZoneCelebration, reduced: boolean, feetY: number): void {
    const { centerX, runIn, walkerScale } = LAYOUT;
    const key = walkerSpriteKey(this, celebration.walker);
    const sprite = this.add.sprite(centerX, feetY, key).setOrigin(0.5, 1).setScale(walkerScale);
    const tag = firstTag(this, key, ART.walkerTags);
    if (tag !== undefined) {
      playTag(sprite, key, tag, reduced);
    }
    if (reduced || celebration.kind === "zoneDone") {
      return;
    }
    sprite.setX(runIn.fromX);
    this.tweens.add({
      duration: runIn.durationMs,
      ease: "Cubic.easeOut",
      onComplete: () => addConfetti(this, false, 1, centerX, runIn.burstY),
      targets: sprite,
      x: centerX,
    });
  }

  // The zone's earnings on a cream plate, the amounts in forest.
  private addPlate(text: ZoneDoneText): void {
    const { centerX, zoneDone } = LAYOUT;
    addPanel(this, zoneDone.plate);
    const line = text.earnings.map((part) => part.text).join("");
    const whole = atLineTop(addPixelText(this, 0, 0, line, BODY), zoneDone.earningsY);
    const left = Math.round(centerX - whole.width / 2);
    whole.setX(left);
    // Each amount is drawn again in forest over its place in the line, measured from the
    // line's start through the amount, since a trailing space has no width.
    const probe = addPixelText(this, 0, 0, "", BODY).setVisible(false);
    const widthOf = (shown: string) => {
      setPixelText(probe, shown);
      return probe.width;
    };
    let before = "";
    for (const part of text.earnings) {
      if (part.kind === "money") {
        const x = left + widthOf(before + part.text) - widthOf(part.text);
        const amount = addPixelText(this, x, 0, part.text, { ...BODY, color: PALETTE.forest });
        atLineTop(amount, zoneDone.earningsY);
      }
      before += part.text;
    }
    probe.destroy();
  }

  // The walker's line in a speech bubble whose tail points up at them, a dotted rule, and
  // their agility and perk under it.
  private addBubble(text: NewWalkerText): void {
    const { centerX, newWalker } = LAYOUT;
    const { bubble, greeting, rule, tail } = newWalker;
    addPanel(this, bubble, "ui-quip");
    if (this.textures.exists(ART.tailUp)) {
      this.add.image(tail.x, tail.y, ART.tailUp).setOrigin(0);
    }
    const probe = addPixelText(this, 0, 0, text.greeting, BODY).setVisible(false);
    const { lines, style } = fitPixelText(probe, GREETING_FIT, 0, 0);
    probe.destroy();
    const tops = greetingLineTops(pixelFontMetrics(this, "body"), style.scale, lines.length);
    lines.forEach((line, i) => {
      const label = addPixelText(this, centerX, 0, line, {
        ...BODY,
        originX: 0.5,
        scale: style.scale,
      });
      atLineTop(label.setLetterSpacing(style.letterSpacing), tops[i] ?? greeting.top);
    });
    const dots = this.add.graphics();
    for (let x = rule.fromX; x <= rule.toX; x += rule.step) {
      fillRect(dots, PALETTE.tan, { height: 1, width: 1, x, y: rule.y });
    }
    this.addInfo(text.info);
  }

  // The agility and perk row, centred: each word after its icon, if it has one; the gaps from
  // the layout.
  private addInfo(parts: readonly LinePart[]): void {
    const { centerX, newWalker } = LAYOUT;
    const { iconGap, iconY, itemGap, y } = newWalker.info;
    const items = parts.flatMap((part) => {
      const word = part.text.trim();
      const label =
        word === ""
          ? []
          : [{ gap: itemGap, item: atLineTop(addPixelText(this, 0, 0, word, BODY), y) }];
      if (part.kind !== "icon" || !this.textures.exists(part.icon)) {
        return label;
      }
      return [{ gap: iconGap, item: this.add.image(0, iconY, part.icon).setOrigin(0) }, ...label];
    });
    const last = items.at(-1);
    const total = items.reduce(
      (sum, entry) => sum + entry.item.displayWidth + (entry === last ? 0 : entry.gap),
      0,
    );
    let x = Math.round(centerX - total / 2);
    for (const { gap, item } of items) {
      item.setX(x);
      x += item.displayWidth + gap;
    }
  }

  // Welcome!, with the key that presses it above it once a key has been pressed.
  private addButton(label: string, onTap: () => void): void {
    const { centerX, newWalker } = LAYOUT;
    const button = addMenuButton(this, newWalker.button, label, { available: true, primary: true });
    listenButtonTap(this, button, onTap);
    if (keyNumbersShown()) {
      addPixelText(this, centerX, newWalker.button.y - KEY_RISE, "1", {
        color: PALETTE.amber,
        font: "title",
        originX: 0.5,
      });
    }
  }

  // About LAYOUT.confetti.bits fx-confetti-bit, each a random colour from a random frame,
  // falling and swaying down the road view under everything else, from staggered starts within
  // fallMs.
  private dropConfetti(): void {
    const { bits, fallMs, fromX, fromY, sway, swayMs, toX, toY } = LAYOUT.confetti;
    const colours = ART.confettiBitTags.filter((tag) =>
      this.anims.exists(animationKey(ART.confettiBit, tag)),
    );
    if (colours.length === 0) {
      return;
    }
    for (let i = 0; i < bits; i++) {
      const colour = colours[PhaserMath.Between(0, colours.length - 1)] ?? colours[0];
      const animation = animationKey(ART.confettiBit, colour ?? "");
      const frames = this.anims.get(animation)?.frames.length ?? 1;
      const x = PhaserMath.Between(fromX, toX);
      const bit = this.add
        .sprite(x, fromY, ART.confettiBit)
        .setOrigin(0)
        .setVisible(false)
        .play({ key: animation, repeat: -1, startFrame: PhaserMath.Between(0, frames - 1) });
      // Each falls for at least half of fallMs, starting early enough to land within it.
      const duration = PhaserMath.Between(fallMs / 2, fallMs);
      const delay = PhaserMath.Between(0, fallMs - duration);
      const swaying = this.tweens.add({
        delay,
        duration: swayMs,
        ease: "Sine.easeInOut",
        repeat: -1,
        targets: bit,
        x: x + (i % 2 === 0 ? sway : -sway),
        yoyo: true,
      });
      this.tweens.add({
        delay,
        duration,
        onComplete: () => {
          swaying.remove();
          bit.destroy();
        },
        onStart: () => bit.setVisible(true),
        targets: bit,
        y: toY,
      });
    }
  }
}
