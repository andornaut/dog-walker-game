import type { GameObjects, Scene, Tweens } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import {
  FEEDBACK,
  heartLabelAt,
  heartPopBlocked,
  heartPopCovers,
  heartPopFrame,
  heartPopText,
} from "../hud/feedback";
import type { ChangeLabel } from "../hud/hudView";
import { arcControl, curvePoint } from "../hud/moments";
import type { Point, Rect } from "../layout/rect";
import { drawFramedRect } from "./draw";
import { FEEDBACK_ART } from "./feedbackArt";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import type { RunScene } from "./RunScene";
import { playTagOnce } from "./sprites";

// Over the cards and the HUD's own labels.
const DEPTH = 60;
// The number's chip reaches this far past its 5-row capitals on every side.
const CHIP_PAD = 2;
// A dog not on the road pops this far over its card.
const OVER_CARD = 8;

// One heart change to show: its label, the top of its dog on the road, its card's sprite
// and the parts that shake with it, and the band its label lands on.
export interface HeartPop {
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

// clearOf is what pops keep clear of; landed shows a change's label on its band; quipTop is the
// top of the quip lane, which the pop's number keeps above.
interface HeartHooks {
  clearOf: () => readonly Rect[];
  landed: (label: ChangeLabel, lane: Rect) => void;
  quipTop: number;
  still: () => boolean;
}

interface Shake {
  base: number[];
  parts: readonly GameObjects.Components.Transform[];
}

// Every heart change, whatever its cause: the heart pops over the dog on the road with its
// number beside it, then flies down into its card's bottom rows, where the change's label
// shows; a lost heart flashes its card's hearts and shakes the card as it lands. Reduced
// motion keeps the pop and the flash, and drops the flight and the shake.
export class HeartFeedback {
  private readonly active = new Set<ActivePop>();
  private readonly hooks: HeartHooks;
  private readonly scene: Scene;
  private readonly shakes = new Map<number, Shake>();

  constructor(scene: Scene, hooks: HeartHooks) {
    this.hooks = hooks;
    this.scene = scene;
  }

  play(pop: HeartPop): void {
    if (pop.delayMs > 0) {
      this.scene.time.delayedCall(pop.delayMs, () => this.show(pop));
    } else {
      this.show(pop);
    }
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
    const heart = this.scene.add.sprite(centre.x, centre.y, art.key).setDepth(DEPTH);
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
      active.tween = this.fly(heart, art, { from: centre, to }, () => this.finish(active));
    });
  }

  private finish(active: ActivePop): void {
    this.active.delete(active);
    active.land();
  }

  // The pop's number in font-title at 1x on a cream chip, beside the heart, and the chip's
  // rect on screen.
  private addNumber(label: ChangeLabel, frame: Point): { chip: GameObjects.Container; rect: Rect } {
    const text = addPixelText(this.scene, 0, 0, heartPopText(label.amount), {
      color: label.amount < 0 ? PALETTE.darkRed : PALETTE.forest,
      font: "title",
    });
    const width = Math.ceil(text.width);
    const bottom = this.hooks.quipTop - CHIP_PAD - 1;
    const at = heartLabelAt({ bottom, screenWidth: SCREEN_CONFIG.width }, frame, width);
    text.setPosition(CHIP_PAD, CHIP_PAD + text.y);
    const box = this.scene.add.graphics();
    const rect = {
      height: 5 + 2 * CHIP_PAD,
      width: width + 2 * CHIP_PAD,
      x: at.x - CHIP_PAD,
      y: at.y - CHIP_PAD,
    };
    drawFramedRect(box, { border: PALETTE.plum, fill: PALETTE.cream }, { ...rect, x: 0, y: 0 });
    const chip = this.scene.add.container(rect.x, rect.y, [box, text]).setDepth(DEPTH);
    return { chip, rect };
  }

  // The fly tag's small heart, from the pop's centre down into the card's bottom rows.
  private fly(
    heart: GameObjects.Sprite,
    art: { fly: string; key: string },
    path: { from: Point; to: Point },
    done: () => void,
  ): Tweens.Tween {
    heart.play(animationKey(art.key, art.fly));
    const { from, to } = path;
    const control = arcControl(from, to, FEEDBACK.heart.peak);
    const progress = { t: 0 };
    return this.scene.tweens.add({
      duration: FEEDBACK.heart.flyMs,
      ease: "Sine.easeIn",
      onComplete: () => {
        heart.destroy();
        done();
      },
      onUpdate: () => {
        const point = curvePoint(from, control, to, progress.t);
        heart.setPosition(Math.round(point.x), Math.round(point.y));
      },
      t: 1,
      targets: progress,
    });
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
  hud: { lanes: readonly Rect[]; run: Pick<RunScene, "dogPoint" | "hudView"> },
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
    const slot = pack.findIndex((packSlot) => packSlot.dog === dog);
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
