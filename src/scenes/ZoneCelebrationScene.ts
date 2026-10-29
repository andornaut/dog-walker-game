import { type GameObjects, Math as PhaserMath, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { ZONE_CELEBRATION_ART as ART } from "../assets/spriteKeys";
import { gameData } from "../data";
import {
  CELEBRATION_LAYOUT as LAYOUT,
  GREETING_FIT,
  greetingLineTops,
  infoItems,
  laidInfoLine,
  newWalkerRows,
} from "../hud/celebrationLayout";
import {
  type CelebrationText,
  celebrationText,
  type LinePart,
  type ZoneCelebration,
} from "../hud/zoneCelebration";
import { cardNumberForKey, isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { addDisplayText } from "../ui/phaser/displayText";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  pixelFontMetrics,
  scalePixelText,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { addRampDim } from "../ui/phaser/rampDim";
import { addConfetti } from "./badges";
import { closeOverlay, listenOutsideTap, type OverlayData } from "./overlay";
import { currentSettings, walkerSpriteKey } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { guardScreenInput } from "./screenGuard";
import { soundboardOf } from "./soundboard";
import { playFirstTag } from "./sprites";
import { addMenuButton, addPanel, BODY_TEXT, listenButtonTap } from "./uiKit";

export interface ZoneCelebrationSceneData extends OverlayData {
  celebration: ZoneCelebration;
  // Called once the celebration has closed.
  onDone: () => void;
  // Opens the pause menu over the celebration, which pauses it, as P and Escape do; the run
  // scene opens it on the phone's back button.
  openPause: () => void;
}

type NewWalkerText = Extract<CelebrationText, { kind: "newWalker" }>;
type ZoneDoneText = Extract<CelebrationText, { kind: "zoneDone" }>;
type Version = typeof LAYOUT.newWalker | typeof LAYOUT.zoneDone;

// Places a label made with origin y 0 by the top of its font line.
function atLineTop<T extends GameObjects.BitmapText>(label: T, top: number): T {
  return label.setY(top);
}

// Over the paused walk: between zones, the walker cheers on a starburst under the zone's name
// and earnings over a button, and waits for a tap or key 1; before the end screen, a walker the
// walk unlocked hops in, greets the pack in a bubble with their agility and perk, and waits for
// Welcome! (key 1).
// Confetti falls in both, unless motion is reduced. Both take no input for
// seconds.screenTapGuard from their first drawn frame.
export class ZoneCelebrationScene extends Scene {
  private done = false;

  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    this.done = false;
    const reduced = currentSettings(this).reducedMotion;
    addRampDim(this, LAYOUT.dim, guardScreenInput(this).drawn);
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
    // A finished neighbourhood plays its own sound; a walker unlocked plays the badge's.
    soundboardOf(this).play(text.kind === "zoneDone" ? "zoneDone" : "badge");

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
    if (text.kind === "zoneDone") {
      this.addPlate(text);
      this.addButton(version.button, text.button, finish);
      // A tap anywhere else on the dim, or on the page beside the game, moves on too.
      const area = { covered: [version.button], dim: LAYOUT.dim };
      listenOutsideTap(this, () => area, finish);
      return;
    }
    this.addButton(this.addBubble(text), text.button, finish);
  }

  // The title in font-display at 2x, and the subtitle in font-display-cream under it.
  private addHeadline(version: Version, text: CelebrationText): void {
    const { centreX, titleScale } = LAYOUT;
    const title = { colour: PALETTE.yellow, font: "title", originX: 0.5 } as const;
    // addDisplayText draws the display font at 1x, so the title is scaled after.
    const big = addDisplayText(this, centreX, 0, text.title, title);
    scalePixelText(big, titleScale, centreX, 0);
    atLineTop(big, version.titleY);
    const subtitle = { ...title, colour: PALETTE.cream, variant: "cream" } as const;
    atLineTop(addDisplayText(this, centreX, 0, text.subtitle, subtitle), version.subtitleY);
  }

  // The walker's cheer at 2x, its frame's bottom centre on the feet line. A new walker hops in
  // from past the right edge, and fx-confetti bursts as they land. Reduced motion shows the
  // cheer's first frame, in place.
  private addWalker(celebration: ZoneCelebration, reduced: boolean, feetY: number): void {
    const { centreX, runIn, walkerScale } = LAYOUT;
    const key = walkerSpriteKey(this, celebration.walker);
    const sprite = this.add.sprite(centreX, feetY, key).setOrigin(0.5, 1).setScale(walkerScale);
    playFirstTag(sprite, key, ART.walkerTags, reduced);
    if (reduced || celebration.kind === "zoneDone") {
      return;
    }
    sprite.setX(runIn.fromX);
    this.tweens.add({
      duration: runIn.durationMs,
      ease: "Cubic.easeOut",
      onComplete: () => addConfetti(this, false, 1, centreX, runIn.burstY),
      targets: sprite,
      x: centreX,
    });
  }

  // The zone's earnings on a cream plate, the amounts in forest.
  private addPlate(text: ZoneDoneText): void {
    const { centreX, zoneDone } = LAYOUT;
    addPanel(this, zoneDone.plate);
    const line = text.earnings.map((part) => part.text).join("");
    const whole = atLineTop(addPixelText(this, 0, 0, line, BODY_TEXT), zoneDone.earningsY);
    const left = Math.round(centreX - whole.width / 2);
    whole.setX(left);
    // Each amount is drawn again in forest over its place in the line, measured from the
    // line's start through the amount, since a trailing space has no width.
    withProbe(this, BODY_TEXT, (probe) => {
      const widthOf = (shown: string) => {
        setPixelText(probe, shown);
        return probe.width;
      };
      let before = "";
      for (const part of text.earnings) {
        if (part.kind === "money") {
          const x = left + widthOf(before + part.text) - widthOf(part.text);
          const amount = addPixelText(this, x, 0, part.text, {
            ...BODY_TEXT,
            colour: PALETTE.forest,
          });
          atLineTop(amount, zoneDone.earningsY);
        }
        before += part.text;
      }
    });
  }

  // The walker's line in a speech bubble whose tail points up at them, a dotted rule, and
  // their agility over their perk under it, the bubble sized to its lines. Returns the button's
  // place under the bubble.
  private addBubble(text: NewWalkerText): typeof LAYOUT.newWalker.button {
    const { centreX, newWalker } = LAYOUT;
    const { greeting, tail } = newWalker;
    const fitted = withProbe(this, BODY_TEXT, (probe) => {
      setPixelText(probe, text.greeting);
      return fitPixelText(probe, GREETING_FIT, 0, 0);
    });
    const { lines, style } = fitted;
    const body = pixelFontMetrics(this, "body");
    const rows = newWalkerRows(body, text.info.length, fitted);
    addPanel(this, rows.bubble, "ui-quip");
    if (this.textures.exists(ART.tailUp)) {
      this.add.image(tail.x, tail.y, ART.tailUp).setOrigin(0);
    }
    const tops = greetingLineTops(body, style.scale, lines.length);
    lines.forEach((line, i) => {
      const label = addPixelText(this, centreX, 0, line, {
        ...BODY_TEXT,
        originX: 0.5,
        scale: style.scale,
      });
      atLineTop(label, tops[i] ?? greeting.top);
    });
    const { rule } = rows;
    const dots = this.add.graphics();
    for (let x = rule.fromX; x <= rule.toX; x += rule.step) {
      fillRect(dots, PALETTE.tan, { height: 1, width: 1, x, y: rule.y });
    }
    text.info.forEach((parts, i) => {
      const row = rows.info[i];
      if (row !== undefined) {
        this.addInfoLine(row, parts);
      }
    });
    return rows.button;
  }

  // An info line, centred: each word after its icon, if it has one; the gaps from the layout.
  private addInfoLine(row: { iconY: number; y: number }, parts: readonly LinePart[]): void {
    const items = infoItems(parts).filter(
      (item) => item.kind === "text" || this.textures.exists(item.icon),
    );
    const objects: (GameObjects.BitmapText | GameObjects.Image)[] = items.map((item) =>
      item.kind === "text"
        ? atLineTop(addPixelText(this, 0, 0, item.text, BODY_TEXT), row.y)
        : this.add.image(0, row.iconY, item.icon).setOrigin(0),
    );
    const widths = new Map(items.map((item, i) => [item, objects[i]?.displayWidth ?? 0]));
    const laid = laidInfoLine((item) => widths.get(item) ?? 0, items);
    const left = Math.round(LAYOUT.centreX - laid.width / 2);
    objects.forEach((object, i) => object.setX(left + (laid.xs[i] ?? 0)));
  }

  // The version's button, with the key that presses it in its left end once a key has been
  // pressed.
  private addButton(place: Version["button"], label: string, onTap: () => void): void {
    const button = addMenuButton(this, place, label, {
      available: true,
      primary: true,
      ...(keyNumbersShown() ? { keyNumber: "1" } : {}),
    });
    listenButtonTap(this, button, onTap);
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
