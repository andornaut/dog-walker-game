import type { Animations, GameObjects, Scene, Time, Tweens, Types } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { kebabCase, ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { DOGHOUSE } from "../hud/doghouse";
import type { ChangeLabel } from "../hud/hudView";
import {
  arcControl,
  bowRightControl,
  bubbleX,
  curvePoint,
  downTail,
  FIRING_EVENT,
  FIRING_PARTS,
  type FiringCue,
  firingLayout,
  firingShowMs,
  lowHeartDogs,
  MOMENTS,
  newlyLow,
  PAYOUT_EVENT,
  type PayoutCue,
  type PayoutFlight,
  payoutFlights,
  TOP_BAR_POINTS,
  TREAT_EVENT,
  type TreatCue,
  trotOffX,
} from "../hud/moments";
import type { Point, Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { type Cents, cents } from "../rules/units";
import type { RunState } from "../state/runState";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText } from "./pixelText";
import type { RunScene } from "./RunScene";
import { firstTag, playEffect, playTag } from "./sprites";
import { artFits, tagFrame } from "./uiKit";

const LAYOUT = screenLayout(SCREEN_CONFIG);
// Over the doghouses, labels and quips the HUD draws.
const DEPTH = 50;
// The owner's 32x32 face is drawn at 2x. The pop shows no face on its first frame, the face
// at 1x on its second and at 2x from its third.
const FACE = { fadeMs: 150, popMs: 160, scale: 2, size: 32 };
const POP = { key: "fx-fired-pop", scale: 2, tag: "play" };
const PLATE = { corner: 8, dropIn: 8, dropMs: 120, key: "ui-fired-plate" };
const LINE = { corner: 8, fadeMs: 400, maxWidth: 200, padding: 6 };
// The payout label: a three-slice with 8px caps, its amount's ink from x 9 and capitals from
// row 3, and 5px after the ink.
const PAYOUT_LABEL = { cap: 8, height: 16, inkX: 9, inkY: 3, key: "ui-payout-label", rise: 14 };
const PAYOUT_LABEL_END = 5;
const COIN = { key: "fx-coin-fly", tag: "spin" };
const TREAT_POP = { fallback: "fx-sparkle", key: "fx-treat-pop", tag: "play" };
const LOW_CHIP = { height: 20, rise: 8, text: "1 ♥ left!" };
const RIM = { minAlpha: 0.35, pulseMs: 600, width: 2 };

interface SlotWarning {
  parts: GameObjects.GameObject[];
  pulse: Tweens.Tween | undefined;
}

// The HUD's part of the in-run feedback moments: the firing moment over the doghouse, the
// low-hearts warning on a doghouse, the zone's fees flying to the bank and a treat thrown to
// its dog. Moments that play out over time stop with the pause menu, as the walk does, while
// the HUD keeps running under it.
export class HudFeedback {
  private inFlight = 0;
  private low: DogId[] = [];
  private lowShown = "";
  private paused = false;
  private readonly floatLabels: (labels: ChangeLabel[]) => void;
  private readonly run: RunScene;
  private readonly scene: Scene;
  private readonly timers = new Set<Time.TimerEvent>();
  private readonly tweens = new Set<Tweens.Tween>();
  private readonly warnings: SlotWarning[] = LAYOUT.dogSlots.map(() => ({
    parts: [],
    pulse: undefined,
  }));

  constructor(scene: Scene, run: RunScene, floatLabels: (labels: ChangeLabel[]) => void) {
    this.floatLabels = floatLabels;
    this.run = run;
    this.scene = scene;
    const onFiring = (cue: FiringCue) => this.playFiring(cue);
    const onPayout = (cues: PayoutCue[]) => this.playPayout(cues);
    const onTreat = (cue: TreatCue) => this.playTreat(cue);
    run.events.on(FIRING_EVENT, onFiring);
    run.events.on(PAYOUT_EVENT, onPayout);
    run.events.on(TREAT_EVENT, onTreat);
    scene.events.once("shutdown", () => {
      run.events.off(FIRING_EVENT, onFiring);
      run.events.off(PAYOUT_EVENT, onPayout);
      run.events.off(TREAT_EVENT, onTreat);
    });
  }

  update(): void {
    const view = this.run.hudView();
    if (view === undefined) {
      return;
    }
    this.holdWhilePaused(this.run.runPause().menu !== "closed");
    this.showLowHearts(view.run);
  }

  // The money the counter shows: the run's, less the fees still flying to it.
  shownMoney(money: Cents): Cents {
    return cents(Math.max(0, money - this.inFlight));
  }

  private holdWhilePaused(paused: boolean): void {
    if (paused === this.paused) {
      return;
    }
    this.paused = paused;
    this.tweens.forEach((tween) => (paused ? tween.pause() : tween.resume()));
    this.timers.forEach((timer) => {
      timer.paused = paused;
    });
  }

  private tween(config: Types.Tweens.TweenBuilderConfig): Tweens.Tween {
    const tween = this.scene.tweens.add(config);
    this.tweens.add(tween);
    tween.once("complete", () => this.tweens.delete(tween));
    if (this.paused) {
      tween.pause();
    }
    return tween;
  }

  private after(ms: number, callback: () => void): void {
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers.delete(timer);
      callback();
    });
    this.timers.add(timer);
    timer.paused = this.paused;
  }

  // Fades parts out over ms after delay, then destroys them.
  private fadeOut(parts: GameObjects.GameObject[], delay: number, ms: number): void {
    this.tween({
      alpha: 0,
      delay,
      duration: ms,
      onComplete: () => parts.forEach((part) => part.destroy()),
      targets: parts,
    });
  }

  // Moves target along a curve over ms, then calls done.
  private fly(
    target: { setPosition: (x: number, y: number) => unknown },
    path: { control: Point; from: Point; to: Point },
    ms: number,
    done: () => void,
  ): void {
    const progress = { t: 0 };
    this.tween({
      duration: ms,
      onComplete: done,
      onUpdate: () => {
        const point = curvePoint(path.from, path.control, path.to, progress.t);
        target.setPosition(Math.round(point.x), Math.round(point.y));
      },
      t: 1,
      targets: progress,
    });
  }

  private slotOf(dog: DogId): Rect | undefined {
    const index = this.run.hudView()?.run.pack.findIndex((slot) => slot.dog === dog) ?? -1;
    return LAYOUT.dogSlots[index];
  }

  // The owner's fired face pops up at 2x over the doghouse in front of the pop, the plate
  // drops in in their temperament's colour, and their fired line shows in a bubble pointing
  // at the face. The face, pop and plate are gone just before the hold ends; the line stays
  // up as long as a quip. Reduced motion keeps the pop and sets the rest in place.
  private playFiring(cue: FiringCue): void {
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      return;
    }
    const still = this.run.reducedMotion();
    const layout = firingLayout(rect);
    const showMs = firingShowMs(cue.seconds);
    const pop = this.addPop(layout.pop);
    const face = this.addFace(cue.dog, layout.face);
    const plate = this.addPlate(cue.dog, layout.plate);
    if (still) {
      pop?.anims.pause(pop.anims.currentAnim?.frames.at(-1));
    } else if (pop === undefined) {
      face.setScale(0);
      this.tween({ duration: FACE.popMs, ease: "Back.easeOut", scale: 1, targets: face });
    } else {
      face.setVisible(false);
      pop.on("animationupdate", (_: Animations.Animation, frame: Animations.AnimationFrame) => {
        face.setVisible(frame.index > 1).setScale(frame.index === 2 ? 1 / FACE.scale : 1);
      });
    }
    if (!still) {
      plate.setY(layout.plate.y - PLATE.dropIn).setAlpha(0);
      this.tween({
        alpha: 1,
        duration: PLATE.dropMs,
        ease: "Back.easeOut",
        targets: plate,
        y: layout.plate.y,
      });
    }
    const shown = pop === undefined ? [face, plate] : [pop, face, plate];
    this.fadeOut(shown, Math.max(0, showMs - FACE.fadeMs), Math.min(showMs, FACE.fadeMs));
    const line = this.addLine(cue.line, layout.line, layout.tail);
    this.fadeOut(line, Math.max(showMs, MOMENTS.firingLineMs), LINE.fadeMs);
  }

  // fx-fired-pop at 2x, played once and held on its last frame behind the face.
  private addPop(at: Point): GameObjects.Sprite | undefined {
    if (!this.scene.anims.exists(animationKey(POP.key, POP.tag))) {
      return undefined;
    }
    const pop = this.scene.add
      .sprite(at.x, at.y, POP.key)
      .setOrigin(0)
      .setScale(POP.scale)
      .setDepth(DEPTH);
    pop.play({ key: animationKey(POP.key, POP.tag), repeat: 0 });
    return pop;
  }

  // The owner's fired face at 2x, else a framed box with their name.
  private addFace(dog: DogId, centre: Point): GameObjects.Container {
    const container = this.scene.add.container(centre.x, centre.y).setDepth(DEPTH);
    const key = ownerFaceKey(gameData, dog);
    const size = FACE.size * FACE.scale;
    if (this.scene.textures.exists(key)) {
      const sprite = this.scene.add.sprite(0, 0, key).setScale(FACE.scale);
      playTag(sprite, key, firstTag(this.scene, key, ["fired", "upset"]) ?? "upset");
      container.add(sprite);
    } else {
      const frame = this.scene.add.graphics();
      drawFramedRect(
        frame,
        { border: PALETTE.plum, fill: PALETTE.cream },
        { height: size, width: size, x: -size / 2, y: -size / 2 },
      );
      const name = addPixelText(this.scene, 0, 0, gameData.dogs[dog].owner.name, {
        color: PALETTE.plum,
        originX: 0.5,
        originY: 0.5,
      });
      container.add([frame, name]);
    }
    return container;
  }

  // ui-fired-plate in the owner's temperament's colour, else the hit label's plate, else a
  // drawn one, with "FIRED!" across it.
  private addPlate(dog: DogId, rect: Rect): GameObjects.Container {
    const container = this.scene.add.container(rect.x, rect.y).setDepth(DEPTH);
    const { temperament } = gameData.dogs[dog].owner;
    const { corner } = PLATE;
    const slice = (key: string, frame: number | string | undefined) =>
      this.scene.add
        .nineslice(0, 0, key, frame, rect.width, rect.height, corner, corner, corner, corner)
        .setOrigin(0);
    if (this.scene.textures.exists(PLATE.key)) {
      container.add(slice(PLATE.key, tagFrame(this.scene, PLATE.key, kebabCase(temperament))));
    } else if (this.scene.textures.exists("ui-hit-label")) {
      container.add(slice("ui-hit-label", tagFrame(this.scene, "ui-hit-label", "normal")));
    } else {
      const g = this.scene.add.graphics();
      drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.darkRed }, { ...rect, x: 0, y: 0 });
      container.add(g);
    }
    const { plateText } = FIRING_PARTS;
    container.add(
      addPixelText(this.scene, plateText.x, plateText.y, "FIRED!", {
        color: PALETTE.white,
        font: "title",
        scale: 2,
      }),
    );
    return container;
  }

  // The owner's fired line in a quip bubble over the face, kept on screen, its tail pointing
  // down at the face.
  private addLine(text: string, at: Point, tail: Point): GameObjects.GameObject[] {
    const label = addPixelText(this.scene, 0, 0, text, {
      color: PALETTE.plum,
      maxWidth: (LINE.maxWidth - 2 * LINE.padding) / 2,
      scale: 2,
    });
    const width = Math.ceil(label.width) + 2 * LINE.padding;
    const height = Math.ceil(label.height) + 2 * LINE.padding;
    const x = bubbleX(SCREEN_CONFIG.width, at.x, width);
    const y = at.y - height;
    placePixelText(label, x + LINE.padding, y + LINE.padding);
    const { corner } = LINE;
    const parts: GameObjects.GameObject[] = [];
    if (this.scene.textures.exists("ui-quip")) {
      parts.push(
        this.scene.add
          .nineslice(x, y, "ui-quip", undefined, width, height, corner, corner, corner, corner)
          .setOrigin(0)
          .setDepth(DEPTH),
      );
    } else {
      const box = this.scene.add.graphics().setDepth(DEPTH);
      drawFramedRect(box, { border: PALETTE.plum, fill: PALETTE.cream }, { height, width, x, y });
      parts.push(box);
    }
    const downArt = downTail((key) => this.scene.textures.exists(key));
    if (downArt !== undefined) {
      parts.push(
        this.scene.add
          .image(tail.x - downArt.tipX, tail.y, downArt.key)
          .setOrigin(0)
          .setDepth(DEPTH + 1),
      );
    }
    parts.push(label.setDepth(DEPTH + 1));
    return parts;
  }

  // Each paid dog's coin flies from its roof to the bank while its amount rises from the
  // roof, and the counter counts each fee as it lands. Reduced motion flies nothing: the
  // amounts show and fade on the roofs and the counter shows the fees at once.
  private playPayout(cues: PayoutCue[]): void {
    const pack = this.run.hudView()?.run.pack;
    if (pack === undefined) {
      return;
    }
    for (const flight of payoutFlights(cues, pack, this.run.reducedMotion())) {
      const rect = LAYOUT.dogSlots[flight.slot];
      if (rect !== undefined) {
        this.flyFee(flight, rect);
      }
    }
  }

  private flyFee(flight: PayoutFlight, rect: Rect): void {
    const { bow, chipMs, roof } = MOMENTS.payout;
    const from = { x: rect.x + roof.x, y: rect.y + roof.y };
    const label = () => this.addPayoutLabel(flight.text, from.x, rect.y + 2);
    if (flight.landMs === flight.startMs) {
      this.fadeOut([label()], 0, chipMs);
      return;
    }
    this.inFlight += flight.amount;
    this.after(flight.startMs, () => {
      const shown = label();
      const ms = flight.landMs - flight.startMs + chipMs;
      this.tween({ duration: ms, targets: shown, y: shown.y - PAYOUT_LABEL.rise });
      this.fadeOut([shown], ms - chipMs, chipMs);
      const coin = this.addCoin(from);
      const bank = TOP_BAR_POINTS.bank;
      const path = { control: bowRightControl(from, bank, bow), from, to: bank };
      this.fly(coin, path, flight.landMs - flight.startMs, () => {
        this.inFlight -= flight.amount;
        coin.destroy();
      });
    });
  }

  // The amount on a price tag centred on x, its top at top.
  private addPayoutLabel(text: string, x: number, top: number): GameObjects.Container {
    const { cap, height, inkX, inkY, key } = PAYOUT_LABEL;
    const amount = addPixelText(this.scene, inkX, inkY, text, {
      color: PALETTE.forest,
      font: "title",
      scale: 2,
    });
    const width = inkX + Math.ceil(amount.width) + PAYOUT_LABEL_END;
    const tag: GameObjects.GameObject = this.scene.textures.exists(key)
      ? this.scene.add
          .nineslice(0, 0, key, tagFrame(this.scene, key, "normal"), width, height, cap, cap, 0, 0)
          .setOrigin(0)
      : this.scene.add.rectangle(0, 0, width, height, PALETTE.cream).setOrigin(0);
    return this.scene.add.container(Math.round(x - width / 2), top, [tag, amount]).setDepth(DEPTH);
  }

  // fx-coin-fly spinning, else a drawn coin.
  private addCoin(at: Point): GameObjects.Sprite | GameObjects.Rectangle {
    if (this.scene.anims.exists(animationKey(COIN.key, COIN.tag))) {
      const sprite = this.scene.add.sprite(at.x, at.y, COIN.key).setDepth(DEPTH + 1);
      playTag(sprite, COIN.key, COIN.tag);
      return sprite;
    }
    return this.scene.add.rectangle(at.x, at.y, 10, 10, PALETTE.amber).setDepth(DEPTH + 1);
  }

  // The treat arcs from the treat counter to the dog's face; on landing it pops, the owner
  // smiles and the heart label floats. Reduced motion lands it at once.
  private playTreat(cue: TreatCue): void {
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      this.floatLabels(cue.labels);
      return;
    }
    const half = FACE.size / 2;
    const to = { x: rect.x + DOGHOUSE.dogFace.x + half, y: rect.y + DOGHOUSE.dogFace.y + half };
    const land = () => {
      const key = this.scene.textures.exists(TREAT_POP.key) ? TREAT_POP.key : TREAT_POP.fallback;
      playEffect(this.scene, key, TREAT_POP.tag, to, DEPTH);
      this.smile(cue.dog, rect);
      this.floatLabels(cue.labels);
    };
    if (this.run.reducedMotion()) {
      land();
      return;
    }
    const from = TOP_BAR_POINTS.treats;
    const treat = this.scene.textures.exists("treat")
      ? this.scene.add.sprite(from.x, from.y, "treat").setDepth(DEPTH)
      : this.scene.add.rectangle(from.x, from.y, 8, 8, PALETTE.tan).setDepth(DEPTH);
    const path = { control: arcControl(from, to, MOMENTS.treat.peak), from, to };
    this.fly(treat, path, MOMENTS.treat.arcMs, () => {
      treat.destroy();
      land();
    });
  }

  // The owner's happy face over their window for a moment.
  private smile(dog: DogId, rect: Rect): void {
    const key = ownerFaceKey(gameData, dog);
    if (!this.scene.anims.exists(animationKey(key, "happy"))) {
      return;
    }
    const { x, y } = DOGHOUSE.ownerFace;
    const face = this.scene.add
      .sprite(rect.x + x, rect.y + y, key)
      .setOrigin(0)
      .setDepth(DEPTH);
    playTag(face, key, "happy");
    this.after(MOMENTS.treat.smileMs, () => face.destroy());
  }

  // A doghouse whose owner is on their last heart wears the warning rim, pulsing (static with
  // reduced motion), and the owner looks worried; without the art, a drawn rim and the warning
  // sign, so the warning never relies on colour alone. Dropping to the last heart also floats
  // a one-off "1 ♥ left!" beside the doghouse.
  private showLowHearts(run: RunState): void {
    const low = lowHeartDogs(run.pack);
    const still = this.run.reducedMotion();
    newlyLow(this.low, low).forEach((dog) => this.cueLow(dog, still));
    this.low = low;
    const shown = `${low.join()}|${still}`;
    if (shown === this.lowShown) {
      return;
    }
    this.lowShown = shown;
    LAYOUT.dogSlots.forEach((rect, i) => {
      const dog = run.pack[i]?.dog;
      this.warn(i, rect, dog !== undefined && low.includes(dog) ? dog : undefined, still);
    });
  }

  private warn(slot: number, rect: Rect, dog: DogId | undefined, still: boolean): void {
    const warning = this.warnings[slot];
    if (warning === undefined) {
      return;
    }
    warning.pulse?.remove();
    warning.parts.forEach((part) => part.destroy());
    warning.parts = [];
    warning.pulse = undefined;
    if (dog === undefined) {
      return;
    }
    const key = "ui-doghouse-warn";
    if (artFits(this.scene, key, DOGHOUSE.size)) {
      const rim = this.scene.add.sprite(rect.x, rect.y, key).setOrigin(0);
      playTag(rim, key, still ? "static" : "pulse");
      warning.parts.push(rim);
    } else {
      const rim = this.scene.add.graphics();
      const { width } = RIM;
      fillRect(rim, PALETTE.red, { ...rect, height: width });
      fillRect(rim, PALETTE.red, { ...rect, height: width, y: rect.y + rect.height - width });
      fillRect(rim, PALETTE.red, { ...rect, width });
      fillRect(rim, PALETTE.red, { ...rect, width, x: rect.x + rect.width - width });
      const sign = this.scene.add.sprite(rect.x + rect.width - 18, rect.y + 2, "ui-warning");
      playTag(sign.setOrigin(0), "ui-warning", "pulse", still);
      warning.parts.push(rim, sign);
      if (!still) {
        warning.pulse = this.scene.tweens.add({
          alpha: RIM.minAlpha,
          duration: RIM.pulseMs,
          ease: "Sine.easeInOut",
          repeat: -1,
          targets: rim,
          yoyo: true,
        });
      }
    }
    const face = ownerFaceKey(gameData, dog);
    if (this.scene.anims.exists(animationKey(face, "worried"))) {
      const { x, y } = DOGHOUSE.ownerFace;
      const worried = this.scene.add.sprite(rect.x + x, rect.y + y, face).setOrigin(0);
      playTag(worried, face, "worried");
      warning.parts.push(worried);
    }
  }

  private cueLow(dog: DogId, still: boolean): void {
    const rect = this.slotOf(dog);
    if (rect === undefined) {
      return;
    }
    const text = addPixelText(this.scene, 2, 2, LOW_CHIP.text, {
      color: PALETTE.darkRed,
      scale: 2,
    });
    const box = this.scene.add.graphics();
    drawFramedRect(
      box,
      { border: PALETTE.plum, fill: PALETTE.cream },
      { height: LOW_CHIP.height, width: Math.ceil(text.width) + 4, x: 0, y: -4 },
    );
    const chip = this.scene.add
      .container(rect.x + 2, rect.y - LOW_CHIP.height - 2, [box, text])
      .setDepth(DEPTH);
    if (!still) {
      this.tween({ duration: MOMENTS.lowCueMs, targets: chip, y: chip.y - LOW_CHIP.rise });
    }
    this.fadeOut([chip], MOMENTS.lowCueMs / 2, MOMENTS.lowCueMs / 2);
  }
}

// A fired dog trots off the road by its nearer edge over seconds, off the side of the screen.
// Reduced motion fades it out where it stands.
export function trotOffRoad(
  scene: Scene,
  trot: { road: Rect; seconds: number; still: boolean },
  sprite: GameObjects.Sprite,
  done: () => void,
): void {
  const duration = trot.seconds * 1000;
  if (trot.still) {
    scene.tweens.add({
      alpha: 0,
      duration,
      onComplete: () => {
        sprite.setAlpha(1);
        done();
      },
      targets: sprite,
    });
    return;
  }
  const toX = trotOffX(trot.road, sprite.displayWidth / 2, sprite.x);
  playTag(sprite, sprite.texture.key, "walk");
  sprite.setFlipX(toX < sprite.x);
  scene.tweens.add({
    duration,
    onComplete: () => {
      sprite.setFlipX(false);
      done();
    },
    targets: sprite,
    x: toX,
  });
}
