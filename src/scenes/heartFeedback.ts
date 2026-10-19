import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { FEEDBACK, heartLabelAt, heartPopFrame, heartPopText } from "../hud/feedback";
import type { ChangeLabel } from "../hud/hudView";
import { arcControl, curvePoint } from "../hud/moments";
import type { Point, Rect } from "../layout/rect";
import { drawFramedRect } from "./draw";
import { FEEDBACK_ART } from "./feedbackArt";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import type { RunScene } from "./RunScene";
import { playTagOnce } from "./sprites";

// Over the doghouses and the HUD's own labels.
const DEPTH = 60;
// The number's chip reaches this far past its 5-row capitals on every side.
const CHIP_PAD = 2;
// A dog not on the road pops this far over its doghouse.
const OVER_HOUSE = 8;

// One heart change to show: its label, the top of its dog on the road, its doghouse's house
// sprite and the parts that shake with it, and the band its label lands on.
export interface HeartPop {
  delayMs: number;
  dogTop: Point;
  house: GameObjects.Sprite;
  label: ChangeLabel;
  lane: Rect;
  parts: readonly GameObjects.Components.Transform[];
  slot: number;
}

// landed shows a change's label on its band; quipTop is the top of the quip lane, which the
// pop's number keeps above.
interface HeartHooks {
  landed: (label: ChangeLabel, lane: Rect) => void;
  quipTop: number;
  still: () => boolean;
}

interface Shake {
  base: number[];
  parts: readonly GameObjects.Components.Transform[];
}

// Every heart change, whatever its cause: the heart pops over the dog on the road with its
// number beside it, then flies down into its doghouse's bottom band, where the change's label
// shows; a lost heart flashes its doghouse red and shakes it as it lands. Reduced motion keeps
// the pop and the flash, and drops the flight and the shake.
export class HeartFeedback {
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

  private show(pop: HeartPop): void {
    const loss = pop.label.amount < 0;
    const art = loss ? FEEDBACK_ART.heartLoss : FEEDBACK_ART.heartGain;
    const frame = heartPopFrame(pop.dogTop);
    const centre = { x: frame.x + 16, y: frame.y + 16 };
    if (!this.scene.anims.exists(animationKey(art.key, art.pop))) {
      this.land(loss, pop);
      return;
    }
    const heart = this.scene.add.sprite(centre.x, centre.y, art.key).setDepth(DEPTH);
    const number = this.addNumber(pop.label, frame);
    playTagOnce(heart, art.key, art.pop, () => {
      number.destroy();
      if (this.hooks.still()) {
        heart.destroy();
        this.land(loss, pop);
        return;
      }
      this.fly(heart, art, centre, pop, () => this.land(loss, pop));
    });
  }

  // The pop's number in font-title at 1x on a cream chip, beside the heart.
  private addNumber(label: ChangeLabel, frame: Point): GameObjects.Container {
    const text = addPixelText(this.scene, 0, 0, heartPopText(label.amount), {
      color: label.amount < 0 ? PALETTE.darkRed : PALETTE.forest,
      font: "title",
    });
    const width = Math.ceil(text.width);
    const bottom = this.hooks.quipTop - CHIP_PAD - 1;
    const at = heartLabelAt({ bottom, screenWidth: SCREEN_CONFIG.width }, frame, width);
    text.setPosition(CHIP_PAD, CHIP_PAD + text.y);
    const box = this.scene.add.graphics();
    drawFramedRect(
      box,
      { border: PALETTE.plum, fill: PALETTE.cream },
      { height: 5 + 2 * CHIP_PAD, width: width + 2 * CHIP_PAD, x: 0, y: 0 },
    );
    return this.scene.add.container(at.x - CHIP_PAD, at.y - CHIP_PAD, [box, text]).setDepth(DEPTH);
  }

  // The fly tag's small heart, from the pop's centre down into the doghouse's bottom band.
  private fly(
    heart: GameObjects.Sprite,
    art: { fly: string; key: string },
    from: Point,
    pop: HeartPop,
    done: () => void,
  ): void {
    heart.play(animationKey(art.key, art.fly));
    const to = { x: pop.lane.x + Math.round(pop.lane.width / 2), y: pop.lane.y };
    const control = arcControl(from, to, FEEDBACK.heart.peak);
    const progress = { t: 0 };
    this.scene.tweens.add({
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

  // The label shows on the band; a lost heart flashes the doghouse, shaking it with motion.
  private land(loss: boolean, pop: HeartPop): void {
    this.hooks.landed(pop.label, pop.lane);
    if (loss) {
      this.flash(pop);
    }
  }

  // ui-doghouse's heart-loss tag on a second house sprite over the house, under the faces,
  // hearts and text; the slot shakes one step a frame.
  private flash(pop: HeartPop): void {
    const { key, tag } = FEEDBACK_ART.doghouseLoss;
    if (!this.scene.anims.exists(animationKey(key, tag))) {
      return;
    }
    const { house } = pop;
    const flash = this.scene.add.sprite(house.x, house.y, key).setOrigin(0).setDepth(house.depth);
    this.scene.children.moveAbove(flash, house);
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

// A pop for each heart change among labels, over its dog on the road, else over its doghouse;
// a dog's later changes in one batch wait their turn.
export function heartPops(
  hud: { lanes: readonly Rect[]; run: Pick<RunScene, "dogPoint" | "hudView"> },
  labels: readonly ChangeLabel[],
  slotOf: (
    slot: number,
  ) => { house: GameObjects.Sprite; parts: GameObjects.Components.Transform[] } | undefined,
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
    const over = { x: lane.x + Math.round(lane.width / 2), y: view.house.y - OVER_HOUSE };
    return [
      {
        delayMs: before * FEEDBACK.heart.staggerMs,
        dogTop: hud.run.dogPoint(dog) ?? over,
        house: view.house,
        label,
        lane,
        parts: view.parts,
        slot,
      },
    ];
  });
}
