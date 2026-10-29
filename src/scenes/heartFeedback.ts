import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { insetRect, type Point, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Tweens } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import {
  FEEDBACK,
  heartLabelAt,
  heartPopBlocked,
  heartPopCovers,
  heartPopFrame,
  reachIconBeside,
} from "../hud/feedback";
import type { ChangeLabel } from "../hud/hudView";
import { arcControl } from "../hud/moments";
import { slotIndexOf } from "../state/pack";
import { PALETTE } from "../ui/palette";
import { CREAM_PANEL_COLOURS, drawFramedRect, drawRing } from "../ui/phaser/draw";
import { addPixelText, pixelFontMetrics } from "../ui/phaser/pixelText";
import { arcFlight } from "./arcFlight";
import { FEEDBACK_ART } from "./feedbackArt";
import { HUD_DEPTH } from "./hudDepth";
import type { HudWalk } from "./hudWalk";
import { playEffect, playTag, playTagOnce } from "./sprites";
import { TimedGroup } from "./timedGroup";

// The number's chip reaches this far past its 5-row capitals on every side.
const CHIP_PAD = 2;
// A dog not on the road pops this far over its card.
const OVER_CARD = 8;
// A forgiven heart blinks this empty heart over itself, under the pickup's 16x16 sparkle.
const FORGIVEN_HEART = { key: "ui-heart", tag: "empty-dark" } as const;
const SPARKLE = { key: "fx-sparkle", tag: "play" } as const;
// A heart cell on a card, and the forgiving perk's icon, size square, gap right of it.
const HEART_CELL = { height: 7, width: 8 } as const;
const FORGIVEN_PERK = { gap: 2, size: 16 } as const;

// One heart change to show: its label, the top of its dog on the road, its card's sprite
// and the parts that shake with it, and the band its label lands on.
interface HeartPop {
  card: GameObjects.Sprite;
  delayMs: number;
  dogTop: Point;
  label: ChangeLabel;
  lane: Rect;
  parts: readonly GameObjects.Components.Transform[];
  slot: number;
}

// A pop on screen: what it covers on its way, its parts, its flight once under way, and its
// landing.
interface ActivePop {
  covers: Rect[];
  land: () => void;
  parts: GameObjects.GameObject[];
  tween: Tweens.Tween | undefined;
}

// clearOf is what pops keep clear of; landed shows a change's label on its band; tabTop is the
// top of the owners' tab lane, which the pop's number keeps above.
interface HeartHooks {
  clearOf: () => readonly Rect[];
  landed: (label: ChangeLabel, lane: Rect) => void;
  still: () => boolean;
  tabTop: number;
}

interface Shake {
  base: number[];
  parts: readonly GameObjects.Components.Transform[];
}

// Every heart change, whatever its cause: the heart pops over the dog on the road with its
// number beside it, then flies down into its card's bottom rows, where the change's label
// shows; a treat grabbed by reach flies its reach icon beside the small heart
// (reachIconBeside). A lost heart flashes its card's hearts and shakes the card as it lands.
// Reduced motion keeps the pop and the flash, and drops the flight, the icon's included, and
// the shake. Everything it plays
// holds while hold says so.
export class HeartFeedback {
  private readonly active = new Set<ActivePop>();
  private readonly group = new TimedGroup();
  private readonly hooks: HeartHooks;
  private readonly scene: Scene;
  private readonly shakes = new Map<number, Shake>();

  constructor(scene: Scene, hooks: HeartHooks) {
    this.hooks = hooks;
    this.scene = scene;
  }

  hold(paused: boolean): void {
    this.group.hold(paused);
  }

  play(pop: HeartPop): void {
    if (pop.delayMs > 0) {
      this.group.after(this.scene, pop.delayMs, () => this.show(pop));
    } else {
      this.show(pop);
    }
  }

  // A heart forgiven on its card, its 8x7 cell's top-left at: the heart blinks empty and back
  // under a sparkle, reduced motion keeping both, in a 1px amber ring with the forgiving perk's
  // 16x16 icon (perkKey) to its right. Without the heart's art, the sparkle, ring and icon.
  forgive(at: Point, perkKey: string): void {
    const { blinkMs, blinks } = FEEDBACK.forgiven;
    const markMs = blinkMs * (2 * blinks - 1);
    const ring = this.scene.add.graphics().setDepth(HUD_DEPTH.heart);
    drawRing(ring, PALETTE.amber, insetRect(-1, { ...HEART_CELL, ...at }), 1);
    const marks: GameObjects.GameObject[] = [ring];
    if (this.scene.textures.exists(perkKey)) {
      const { gap, size } = FORGIVEN_PERK;
      const y = at.y + Math.floor((HEART_CELL.height - size) / 2);
      marks.push(
        this.scene.add
          .image(at.x + HEART_CELL.width + gap, y, perkKey)
          .setOrigin(0)
          .setDepth(HUD_DEPTH.heart),
      );
    }
    this.group.after(this.scene, markMs, () => marks.forEach((mark) => mark.destroy()));
    const sparkle = playEffect(
      this.scene,
      SPARKLE.key,
      SPARKLE.tag,
      { x: at.x + 4, y: at.y + 3 },
      HUD_DEPTH.heart,
    );
    if (sparkle !== undefined) {
      this.group.animate(sparkle);
    }
    if (!this.scene.anims.exists(animationKey(FORGIVEN_HEART.key, FORGIVEN_HEART.tag))) {
      return;
    }
    const empty = this.scene.add.sprite(at.x, at.y, FORGIVEN_HEART.key).setOrigin(0);
    playTag(empty.setDepth(HUD_DEPTH.heart), FORGIVEN_HEART.key, FORGIVEN_HEART.tag);
    this.group.animate(empty);
    this.group.every(this.scene, blinkMs, 2 * blinks - 2, () => empty.setVisible(!empty.visible));
    this.group.after(this.scene, markMs, () => empty.destroy());
  }

  // Lands at once every pop whose way crosses what must stay clear, such as a firing moment
  // that has just opened.
  clearWay(): void {
    const clearOf = this.hooks.clearOf();
    for (const active of [...this.active]) {
      if (heartPopBlocked(clearOf, active.covers)) {
        active.tween?.remove();
        active.parts.forEach((part) => part.destroy());
        this.finish(active);
      }
    }
  }

  // A pop whose way crosses what must stay clear lands at once, with no pop or flight.
  private show(pop: HeartPop): void {
    const loss = pop.label.amount < 0;
    const art = loss ? FEEDBACK_ART.heartLoss : FEEDBACK_ART.heartGain;
    const frame = heartPopFrame(pop.dogTop);
    const centre = { x: frame.x + 16, y: frame.y + 16 };
    if (!this.scene.anims.exists(animationKey(art.key, art.pop))) {
      this.land(loss, pop);
      return;
    }
    const to = { x: pop.lane.x + Math.round(pop.lane.width / 2), y: pop.lane.y };
    const number = this.addNumber(pop.label, frame);
    const covers = heartPopCovers({ chip: number.rect, frame, to }, FEEDBACK.heart.peak);
    if (heartPopBlocked(this.hooks.clearOf(), covers)) {
      number.chip.destroy();
      this.land(loss, pop);
      return;
    }
    const heart = this.scene.add.sprite(centre.x, centre.y, art.key).setDepth(HUD_DEPTH.heart);
    const active: ActivePop = {
      covers,
      land: () => this.land(loss, pop),
      parts: [heart, number.chip],
      tween: undefined,
    };
    this.active.add(active);
    playTagOnce(heart, art.key, art.pop, () => {
      number.chip.destroy();
      if (this.hooks.still()) {
        heart.destroy();
        this.finish(active);
        return;
      }
      const reachIcon = this.addReachIcon(pop.label, centre);
      if (reachIcon !== undefined) {
        active.parts.push(reachIcon);
      }
      const path = { from: centre, to };
      active.tween = this.fly({ art, heart, reachIcon }, path, () => this.finish(active));
    });
    this.group.animate(heart);
  }

  private finish(active: ActivePop): void {
    this.active.delete(active);
    active.land();
  }

  // The pop's number, its card label's text ("+1♥"), in font-title at 1x on a cream chip,
  // beside the heart, and the chip's rect on screen. The ♥, inked above the capitals, grows the
  // chip up to hold it.
  private addNumber(label: ChangeLabel, frame: Point): { chip: GameObjects.Container; rect: Rect } {
    const text = addPixelText(this.scene, 0, 0, label.text, {
      colour: label.amount < 0 ? PALETTE.darkRed : PALETTE.forest,
      font: "title",
    });
    const width = Math.ceil(text.width);
    const bottom = this.hooks.tabTop - CHIP_PAD - 1;
    const at = heartLabelAt({ bottom, screenWidth: SCREEN_CONFIG.width }, frame, width);
    const { capTop } = pixelFontMetrics(this.scene, "title");
    const tops = text
      .getTextBounds(true)
      .characters.flatMap((char) => (char.h > 0 ? [char.y] : []));
    const above = Math.max(0, capTop - Math.min(capTop, ...tops));
    text.setPosition(CHIP_PAD, CHIP_PAD + above + text.y);
    const box = this.scene.add.graphics();
    const rect = {
      height: 5 + above + 2 * CHIP_PAD,
      width: width + 2 * CHIP_PAD,
      x: at.x - CHIP_PAD,
      y: at.y - CHIP_PAD - above,
    };
    drawFramedRect(box, CREAM_PANEL_COLOURS, { ...rect, x: 0, y: 0 });
    const chip = this.scene.add.container(rect.x, rect.y, [box, text]).setDepth(HUD_DEPTH.heart);
    return { chip, rect };
  }

  // A reached label's reach icon beside the small heart centred on centre, or undefined for a
  // label with none or whose icon art is missing.
  private addReachIcon(label: ChangeLabel, centre: Point): GameObjects.Image | undefined {
    const icon = label.reachIcon;
    if (icon === undefined || !this.scene.textures.exists(icon)) {
      return undefined;
    }
    const at = reachIconBeside(centre);
    return this.scene.add.image(at.x, at.y, icon).setOrigin(0).setDepth(HUD_DEPTH.heart);
  }

  // The fly tag's small heart, from the pop's centre down into the card's bottom rows, with its
  // reach icon, if any, beside it.
  private fly(
    sprites: {
      art: { fly: string; key: string };
      heart: GameObjects.Sprite;
      reachIcon: GameObjects.Image | undefined;
    },
    path: { from: Point; to: Point },
    done: () => void,
  ): Tweens.Tween {
    const { art, heart, reachIcon } = sprites;
    this.group.animate(heart.play(animationKey(art.key, art.fly)));
    const { from, to } = path;
    const control = arcControl(from, to, FEEDBACK.heart.peak);
    const flight = {
      duration: FEEDBACK.heart.flyMs,
      ease: "Sine.easeIn",
      onComplete: () => {
        heart.destroy();
        reachIcon?.destroy();
        done();
      },
    };
    return this.group.tween(
      this.scene,
      arcFlight({ control, from, to }, flight, (point) => {
        heart.setPosition(point.x, point.y);
        const at = reachIconBeside(point);
        reachIcon?.setPosition(at.x, at.y);
      }),
    );
  }

  // The label shows on the card; a lost heart flashes the card's hearts, shaking it with motion.
  private land(loss: boolean, pop: HeartPop): void {
    this.hooks.landed(pop.label, pop.lane);
    if (loss) {
      this.flash(pop);
    }
  }

  // ui-dog-card's heart-loss tag on a second card sprite over the card, flashing its hearts
  // area under its face, hearts and text; the slot shakes one step a frame.
  private flash(pop: HeartPop): void {
    const { key, tag } = FEEDBACK_ART.cardLoss;
    if (!this.scene.anims.exists(animationKey(key, tag))) {
      return;
    }
    const { card } = pop;
    const flash = this.scene.add.sprite(card.x, card.y, key).setOrigin(0).setDepth(card.depth);
    // Straight over the card in the draw order, under the labels and chips added since it.
    const { children } = this.scene;
    children.moveTo(flash, children.getIndex(card) + 1);
    const parts = [...pop.parts, flash];
    const still = this.hooks.still();
    const shake = still ? undefined : this.startShake(pop.slot, parts);
    if (shake !== undefined) {
      flash.on("animationupdate", (_: unknown, frame: { index: number }) => {
        this.shift(shake, FEEDBACK.heart.shakeDx[frame.index - 1] ?? 0);
      });
      this.shift(shake, FEEDBACK.heart.shakeDx[0]);
    }
    playTagOnce(flash, key, tag, () => {
      if (shake !== undefined) {
        this.endShake(pop.slot, shake);
      }
      flash.destroy();
    });
    this.group.animate(flash);
  }

  // A shake already under way on the slot keeps its resting places, so shakes never drift.
  private startShake(slot: number, parts: readonly GameObjects.Components.Transform[]): Shake {
    const running = this.shakes.get(slot);
    const base = parts.map((part, i) => running?.base[i] ?? part.x);
    const shake = { base, parts };
    this.shakes.set(slot, shake);
    return shake;
  }

  private shift(shake: Shake, dx: number): void {
    shake.parts.forEach((part, i) => part.setX((shake.base[i] ?? part.x) + dx));
  }

  private endShake(slot: number, shake: Shake): void {
    this.shift(shake, 0);
    if (this.shakes.get(slot) === shake) {
      this.shakes.delete(slot);
    }
  }
}

// A pop for each heart change among labels, over its dog on the road, else over its card;
// a dog's later changes in one batch wait their turn.
export function heartPops(
  hud: { lanes: readonly Rect[]; run: Pick<HudWalk, "dogPoint" | "hudView"> },
  labels: readonly ChangeLabel[],
  slotOf: (
    slot: number,
  ) => { card: GameObjects.Sprite; parts: GameObjects.Components.Transform[] } | undefined,
): HeartPop[] {
  const pack = hud.run.hudView()?.run.pack ?? [];
  const shown = new Map<DogId, number>();
  return labels.flatMap((label): HeartPop[] => {
    if (label.target.kind !== "dog") {
      return [];
    }
    const { dog } = label.target;
    const slot = slotIndexOf(pack, dog);
    const lane = hud.lanes[slot];
    const view = slotOf(slot);
    if (lane === undefined || view === undefined) {
      return [];
    }
    const before = shown.get(dog) ?? 0;
    shown.set(dog, before + 1);
    const over = { x: lane.x + Math.round(lane.width / 2), y: view.card.y - OVER_CARD };
    return [
      {
        card: view.card,
        delayMs: before * FEEDBACK.heart.staggerMs,
        dogTop: hud.run.dogPoint(dog) ?? over,
        label,
        lane,
        parts: view.parts,
        slot,
      },
    ];
  });
}
