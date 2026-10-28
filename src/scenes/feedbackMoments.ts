import type { Animations, GameObjects, Scene, Tweens, Types } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { ownerFaceKey, WARNING_KEY, WARNING_TAG } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { DogId } from "../data/types";
import { type MoneyTick, retarget, tickShown } from "../hud/feedback";
import type { ChangeLabel } from "../hud/hudView";
import {
  bowRightControl,
  curvePoint,
  downTail,
  FIRED_LINE,
  FIRED_LINE_FIT,
  firedLineHeight,
  firedLineX,
  FIRING_EVENT,
  FIRING_PARTS,
  type FiringCue,
  firingLayout,
  firingTimeline,
  LOW_CHIP,
  LOW_CHIP_FIT,
  lowChipPlace,
  lowHeartDogs,
  lowHeartsText,
  MOMENTS,
  newlyLow,
  PAYOUT_EVENT,
  PAYOUT_TAG,
  type PayoutCue,
  type PayoutFlight,
  payoutFlights,
  payoutTagTop,
  TOP_BAR_POINTS,
  TREAT_EVENT,
  type TreatCue,
  trotOffX,
} from "../hud/moments";
import { playerPaused, type RunPause, walkPaused } from "../hud/topBar";
import { DOG_CARD } from "../hud/walkHud";
import type { Point, Rect } from "../lib/rect";
import { type Cents, cents } from "../rules/units";
import { slotIndexOf } from "../state/pack";
import type { RunState } from "../state/runState";
import { addDisplayText } from "../ui/phaser/displayText";
import { addFilledRect, CREAM_PANEL_COLOURS, drawFramedRect, drawRing } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  pixelFontMetrics,
  placePixelText,
} from "../ui/phaser/pixelText";
import { addFaceRows, fitFaceRows } from "./faceTextView";
import type { HudWalk } from "./hudWalk";
import { onSceneEvent } from "./overlay";
import { firstTag, playEffect, playTag } from "./sprites";
import { TimedGroup } from "./timedGroup";
import { addPanel, artFits, tagFrame } from "./uiKit";

const LAYOUT = SCREEN_LAYOUT;
// Over the cards, labels and owners' tabs the HUD draws.
const DEPTH = 50;
// The owner's 32x32 face is drawn at 2x. The pop shows no face on its first frame, the face
// at 1x on its second and at 2x from its third.
const FACE = { scale: 2, size: 32 };
const POP = { key: "fx-fired-pop", scale: 2, tag: "play" };
const PLATE = { corner: 8, dropIn: 8, key: "ui-fired-plate" };
// Each fired line's bubble takes its own depth pair over the moments, panel then text, so two
// lines up at once never interleave. The tail is 8px wide.
const LINE_DEPTH = DEPTH + 2;
const LINE_TAIL_WIDTH = 8;
// The payout label: a three-slice with 8px caps, its amount's ink from x 9 and capitals from
// row 3, and 5px after the ink.
const PAYOUT_LABEL = { cap: 8, inkX: 9, inkY: 3, key: "ui-payout-label" };
const PAYOUT_LABEL_END = 5;
const COIN = { key: "fx-coin-fly", tag: "spin" };
const TREAT_POP = { fallback: "fx-sparkle", key: "fx-treat-pop", tag: "play" };
const RIM = { minAlpha: 0.35, pulseMs: 600, width: 2 };

interface FiredLine {
  at: Point;
  tail: Point;
  text: string;
}

// The callbacks the HUD gives the moments: floatLabels shows change labels, popping a heart
// change's owner in for ownerMs, firingShown runs once a firing moment is on screen, and
// popOwner pops a dog's owner in on its card, in a mood, for ms.
interface HudFeedbackHooks {
  firingShown: () => void;
  floatLabels: (ownerMs: number, labels: ChangeLabel[]) => void;
  popOwner: (dog: DogId, mood: string, ms: number) => void;
}

interface SlotWarning {
  parts: GameObjects.GameObject[];
  pulse: Tweens.Tween | undefined;
}

// The HUD's part of the in-run feedback moments: the firing moment over the card, the
// low-hearts warning on a card, the zone's fees flying to the bank and a treat thrown to its
// dog. Moments that play out over time stop with the pause menu, as the walk does, while
// the HUD keeps running under it. The firing moment stops whenever the walk does, so it plays
// out over its hold however the hold is paused.
export class HudFeedback {
  private cardUp = false;
  private inFlight = 0;
  private readonly payoutLabels = new Set<GameObjects.Container>();
  // The firing moments' faces and plates on screen.
  private firingParts = new Set<Rect>();
  // Fired lines' bubbles on screen, and lines waiting for room beside them.
  // Each bubble's cover takes in its tail.
  private lines: {
    cover: Rect;
    depth: number;
    line: FiredLine;
    parts: GameObjects.GameObject[];
    rect: Rect;
  }[] = [];
  private linesWaiting: FiredLine[] = [];
  private low: DogId[] = [];
  private lowShown = "";
  private moneyTick: MoneyTick | undefined;
  private readonly firing = new TimedGroup();
  private readonly hooks: HudFeedbackHooks;
  private readonly moments = new TimedGroup();
  private readonly run: Pick<HudWalk, "events" | "hudView" | "reducedMotion">;
  private readonly scene: Scene;
  private readonly warnings: SlotWarning[] = LAYOUT.dogSlots.map(() => ({
    parts: [],
    pulse: undefined,
  }));

  constructor(
    scene: Scene,
    run: Pick<HudWalk, "events" | "hudView" | "reducedMotion">,
    hooks: HudFeedbackHooks,
  ) {
    this.hooks = hooks;
    this.run = run;
    this.scene = scene;
    onSceneEvent(scene, run.events, FIRING_EVENT, (cue: FiringCue) => this.playFiring(cue));
    onSceneEvent(scene, run.events, PAYOUT_EVENT, (cues: PayoutCue[]) => this.playPayout(cues));
    onSceneEvent(scene, run.events, TREAT_EVENT, (cue: TreatCue) => this.playTreat(cue));
  }

  update(run: RunState, pause: RunPause): void {
    this.moments.hold(playerPaused(pause));
    this.firing.hold(walkPaused(pause));
    this.cardUp = pause.card;
    if (this.cardUp) {
      this.clearPayoutLabels();
    }
    this.showLowHearts(run);
  }

  // What heart pops keep clear of: the firing moments' faces, plates and fired lines on screen.
  firingRects(): Rect[] {
    return [...this.firingParts, ...this.lines.map(({ cover }) => cover)];
  }

  // The money the counter shows: the run's, less the fees still flying to it, counted to
  // rather than jumped to, except with reduced motion.
  shownMoney(money: Cents): Cents {
    const target = cents(Math.max(0, money - this.inFlight));
    const now = this.scene.time.now;
    this.moneyTick = retarget(!this.run.reducedMotion(), now, target, this.moneyTick);
    return tickShown(now, this.moneyTick);
  }

  private tween(
    config: Types.Tweens.TweenBuilderConfig,
    group: TimedGroup = this.moments,
  ): Tweens.Tween {
    return group.tween(this.scene, config);
  }

  private after(ms: number, callback: () => void, group: TimedGroup = this.moments): void {
    group.after(this.scene, ms, callback);
  }

  // Fades parts out over ms after delay, then destroys them.
  private fadeOut(
    parts: GameObjects.GameObject[],
    delay: number,
    ms: number,
    group: TimedGroup = this.moments,
  ): void {
    this.tween(
      {
        alpha: 0,
        delay,
        duration: ms,
        onComplete: () => parts.forEach((part) => part.destroy()),
        targets: parts,
      },
      group,
    );
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
    const index = slotIndexOf(this.run.hudView()?.run.pack ?? [], dog);
    return LAYOUT.dogSlots[index];
  }

  // The owner's fired face pops up at 2x on their tab's place over the card in front of the
  // pop, the plate drops in in their temperament's colour, and their fired line shows in a
  // bubble pointing at the face. The face, pop, plate and line stay up for the hold and fade
  // out as it ends (firingTimeline), and heart pops in their way land at once. Reduced motion
  // keeps the pop and sets the rest in place.
  private playFiring(cue: FiringCue): void {
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      return;
    }
    const still = this.run.reducedMotion();
    const layout = firingLayout(LAYOUT.walkView, rect);
    const timeline = firingTimeline(cue.seconds, still);
    const pop = this.addPop(layout.pop);
    const face = this.addFace(cue.dog, layout.face);
    const plate = this.addPlate(layout.plate);
    if (still) {
      pop?.anims.pause(pop.anims.currentAnim?.frames.at(-1));
    } else if (pop === undefined) {
      face.setScale(0);
      this.tween(
        { duration: timeline.popMs, ease: "Back.easeOut", scale: 1, targets: face },
        this.firing,
      );
    } else {
      this.firing.animate(pop);
      face.setVisible(false);
      pop.on("animationupdate", (_: Animations.Animation, frame: Animations.AnimationFrame) => {
        face.setVisible(frame.index > 1).setScale(frame.index === 2 ? 1 / FACE.scale : 1);
      });
    }
    if (!still) {
      plate.setY(layout.plate.y - PLATE.dropIn).setAlpha(0);
      this.tween(
        {
          alpha: 1,
          duration: timeline.plateMs,
          ease: "Back.easeOut",
          targets: plate,
          y: layout.plate.y,
        },
        this.firing,
      );
    }
    const half = (FACE.size * FACE.scale) / 2;
    const covered = [
      { height: 2 * half, width: 2 * half, x: layout.face.x - half, y: layout.face.y - half },
      layout.plate,
    ];
    covered.forEach((part) => this.firingParts.add(part));
    const shown = pop === undefined ? [face, plate] : [pop, face, plate];
    const { fadeAtMs, fadeMs } = timeline;
    this.fadeOut(shown, fadeAtMs, fadeMs, this.firing);
    const line = { at: layout.line, tail: layout.tail, text: cue.line };
    this.linesWaiting.push(line);
    this.showWaitingLines();
    this.after(
      fadeAtMs,
      () => {
        covered.forEach((part) => this.firingParts.delete(part));
        this.closeLine(line, fadeMs);
      },
      this.firing,
    );
    this.hooks.firingShown();
  }

  // Fades a fired line out over ms if it is up, else drops it from the waiting lines.
  private closeLine(line: FiredLine, ms: number): void {
    this.linesWaiting = this.linesWaiting.filter((waiting) => waiting !== line);
    const entry = this.lines.find((shown) => shown.line === line);
    if (entry === undefined) {
      return;
    }
    this.tween(
      {
        alpha: 0,
        duration: ms,
        onComplete: () => {
          entry.parts.forEach((part) => part.destroy());
          this.lines = this.lines.filter((shown) => shown !== entry);
          this.showWaitingLines();
        },
        targets: entry.parts,
      },
      this.firing,
    );
  }

  // Opens each waiting fired line that has room beside the bubbles up, in turn; the rest wait
  // for one to close.
  private showWaitingLines(): void {
    this.linesWaiting = this.linesWaiting.filter((line) => !this.addLine(line));
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
      drawFramedRect(frame, CREAM_PANEL_COLOURS, {
        height: size,
        width: size,
        x: -size / 2,
        y: -size / 2,
      });
      const name = addPixelText(this.scene, 0, 0, gameData.dogs[dog].owner.name, {
        colour: PALETTE.plum,
        originX: 0.5,
        originY: 0.5,
      });
      container.add([frame, name]);
    }
    return container;
  }

  // ui-fired-plate, else the hit label's plate, else a drawn one, with "FIRED!" across it.
  private addPlate(rect: Rect): GameObjects.Container {
    const container = this.scene.add.container(rect.x, rect.y).setDepth(DEPTH);
    const { corner } = PLATE;
    const slice = (key: string, frame: number | string | undefined) =>
      this.scene.add
        .nineslice(0, 0, key, frame, rect.width, rect.height, corner, corner, corner, corner)
        .setOrigin(0);
    if (this.scene.textures.exists(PLATE.key)) {
      container.add(slice(PLATE.key, undefined));
    } else if (this.scene.textures.exists("ui-hit-label")) {
      container.add(slice("ui-hit-label", tagFrame(this.scene, "ui-hit-label", "normal")));
    } else {
      const g = this.scene.add.graphics();
      drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.darkRed }, { ...rect, x: 0, y: 0 });
      container.add(g);
    }
    const { plateText } = FIRING_PARTS;
    container.add(
      addDisplayText(this.scene, rect.width / 2, plateText.y, gameData.runText.fired, {
        colour: PALETTE.white,
        font: "title",
        originX: 0.5,
        scale: 2,
      }),
    );
    return container;
  }

  // The owner's fired line in a quip bubble over the face, kept on screen and clear of the
  // other fired lines, its tail pointing down at the face, until its firing's hold ends.
  // False, drawing nothing, while there is no room for it.
  private addLine(line: FiredLine): boolean {
    const label = addPixelText(this.scene, 0, 0, line.text, {
      colour: PALETTE.plum,
      scale: FIRED_LINE.scale,
    });
    const { lines } = fitPixelText(label, FIRED_LINE_FIT, 0, 0);
    const width = Math.ceil(label.width) + 2 * FIRED_LINE.padding;
    const height = firedLineHeight(pixelFontMetrics(this.scene, "body"), lines.length);
    const downArt = downTail((key) => this.scene.textures.exists(key));
    const tailX = line.tail.x - (downArt?.tipX ?? LINE_TAIL_WIDTH / 2);
    const open = this.lines.map(({ rect }) => rect);
    const x = firedLineX(SCREEN_CONFIG.width, open, { width: LINE_TAIL_WIDTH, x: tailX }, width);
    if (x === undefined) {
      label.destroy();
      return false;
    }
    const y = line.at.y - height;
    const rect = { height, width, x, y };
    let depth = LINE_DEPTH;
    while (this.lines.some((shown) => shown.depth === depth)) {
      depth += 2;
    }
    placePixelText(label, x + FIRED_LINE.padding, y + FIRED_LINE.padding);
    const parts: GameObjects.GameObject[] = [addPanel(this.scene, rect, "ui-quip").setDepth(depth)];
    if (downArt !== undefined) {
      parts.push(
        this.scene.add
          .image(tailX, line.tail.y, downArt.key)
          .setOrigin(0)
          .setDepth(depth + 1),
      );
    }
    parts.push(label.setDepth(depth + 1));
    const tailBottom = line.tail.y + (downArt?.height ?? 0);
    const cover = { ...rect, height: Math.max(rect.height, tailBottom - y) };
    this.lines.push({ cover, depth, line, parts, rect });
    return true;
  }

  // Each paid dog's coin flies from its card's header to the bank while its amount rises from
  // the card, and the counter counts each fee as it lands. Reduced motion flies nothing: the
  // amounts show and fade over the cards and the counter shows the fees at once.
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

  // A card covering the walk takes the fees' amounts away; their coins fly on.
  private clearPayoutLabels(): void {
    [...this.payoutLabels].forEach((label) => label.destroy());
  }

  private flyFee(flight: PayoutFlight, rect: Rect): void {
    const { bow, chipMs, roof } = MOMENTS.payout;
    const from = { x: rect.x + roof.x, y: rect.y + roof.y };
    // The amount rises over the road from just above the roof, clear of the faces and hearts.
    const label = () => {
      const shown = this.addPayoutLabel(flight.text, from.x, payoutTagTop(rect));
      this.payoutLabels.add(shown);
      shown.once("destroy", () => this.payoutLabels.delete(shown));
      return shown;
    };
    if (flight.landMs === flight.startMs) {
      if (!this.cardUp) {
        this.fadeOut([label()], 0, chipMs);
      }
      return;
    }
    this.inFlight += flight.amount;
    this.after(flight.startMs, () => {
      const ms = flight.landMs - flight.startMs + chipMs;
      if (!this.cardUp) {
        const shown = label();
        this.tween({ duration: ms, targets: shown, y: shown.y - PAYOUT_TAG.rise });
        this.fadeOut([shown], ms - chipMs, chipMs);
      }
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
    const { cap, inkX, inkY, key } = PAYOUT_LABEL;
    const { height } = PAYOUT_TAG;
    const amount = addPixelText(this.scene, inkX, inkY, text, {
      colour: PALETTE.forest,
      font: "title",
      scale: 2,
    });
    const width = inkX + Math.ceil(amount.width) + PAYOUT_LABEL_END;
    const tag: GameObjects.GameObject = this.scene.textures.exists(key)
      ? this.scene.add
          .nineslice(0, 0, key, tagFrame(this.scene, key, "normal"), width, height, cap, cap, 0, 0)
          .setOrigin(0)
      : addFilledRect(this.scene, PALETTE.cream, { height, width, x: 0, y: 0 });
    return this.scene.add.container(Math.round(x - width / 2), top, [tag, amount]).setDepth(DEPTH);
  }

  // fx-coin-fly spinning, else a drawn coin.
  private addCoin(at: Point): GameObjects.Sprite | GameObjects.Rectangle {
    if (this.scene.anims.exists(animationKey(COIN.key, COIN.tag))) {
      const sprite = this.scene.add.sprite(at.x, at.y, COIN.key).setDepth(DEPTH + 1);
      playTag(sprite, COIN.key, COIN.tag);
      return this.moments.animate(sprite);
    }
    return this.scene.add.rectangle(at.x, at.y, 10, 10, PALETTE.amber).setDepth(DEPTH + 1);
  }

  // A treat grabbed pops over the dog's face on its card, the owner pops in smiling and the
  // heart label floats.
  private playTreat(cue: TreatCue): void {
    const { smileMs } = MOMENTS.treat;
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      this.hooks.floatLabels(smileMs, cue.labels);
      return;
    }
    const half = FACE.size / 2;
    const { dogFace } = DOG_CARD;
    const at = { x: rect.x + dogFace.x + half, y: rect.y + dogFace.y + half };
    const key = this.scene.textures.exists(TREAT_POP.key) ? TREAT_POP.key : TREAT_POP.fallback;
    playEffect(this.scene, key, TREAT_POP.tag, at, DEPTH);
    this.hooks.popOwner(cue.dog, "happy", smileMs);
    this.hooks.floatLabels(smileMs, cue.labels);
  }

  // A card whose owner is on their last heart wears the warning rim, pulsing (static with
  // reduced motion); without the art, a drawn rim and the warning sign, so the warning never
  // relies on colour alone. Dropping to the last heart also pops the owner in, worried, and
  // floats a one-off "1 ♥ left!" over the card.
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
    const key = "ui-dog-card-warn";
    if (artFits(this.scene, key, DOG_CARD.size)) {
      const rim = this.scene.add.sprite(rect.x, rect.y, key).setOrigin(0);
      playTag(rim, key, still ? "static" : "pulse");
      warning.parts.push(rim);
    } else {
      const rim = this.scene.add.graphics();
      drawRing(rim, PALETTE.red, rect, RIM.width);
      warning.parts.push(rim);
      if (this.scene.textures.exists(WARNING_KEY)) {
        const sign = this.scene.add.sprite(rect.x + rect.width - 18, rect.y + 2, WARNING_KEY);
        playTag(sign.setOrigin(0), WARNING_KEY, WARNING_TAG, still);
        warning.parts.push(sign);
      }
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
  }

  private cueLow(dog: DogId, still: boolean): void {
    const rect = this.slotOf(dog);
    if (rect === undefined) {
      return;
    }
    this.hooks.popOwner(dog, "worried", MOMENTS.lowCueMs);
    const style = { colour: PALETTE.darkRed, scale: 2 };
    const set = fitFaceRows(this.scene, style, LOW_CHIP_FIT, lowHeartsText(gameData, dog));
    const row = set.rows[0];
    const shown = {
      ...(set.box !== undefined && row !== undefined && row.faces.length > 0
        ? { face: set.box }
        : {}),
      scale: set.style.scale,
      width: Math.ceil(row?.width ?? 0),
    };
    const body = pixelFontMetrics(this.scene, "body");
    const place = lowChipPlace(body, SCREEN_CONFIG.width, rect, shown);
    const box = this.scene.add.graphics();
    drawFramedRect(box, CREAM_PANEL_COLOURS, { ...place.box, x: 0, y: 0 });
    const at = { capsTop: place.text.y - place.box.y, x: place.text.x - place.box.x };
    const text = addFaceRows(this.scene, at, { box: set.box, fit: set.style, style }, set.rows);
    const chip = this.scene.add.container(place.box.x, place.box.y, [box, ...text]).setDepth(DEPTH);
    if (!still) {
      this.tween({ duration: MOMENTS.lowCueMs, targets: chip, y: chip.y - LOW_CHIP.rise });
    }
    this.fadeOut([chip], MOMENTS.lowCueMs / 2, MOMENTS.lowCueMs / 2);
  }
}

// A fired dog trots off the road by its nearer edge over ms, off the side of the screen.
// Reduced motion fades it out where it stands. Returns the tween, so the walk can hold it.
export function trotOffRoad(
  scene: Scene,
  trot: { ms: number; road: Rect; still: boolean },
  sprite: GameObjects.Sprite,
  done: () => void,
): Tweens.Tween {
  const duration = trot.ms;
  if (trot.still) {
    return scene.tweens.add({
      alpha: 0,
      duration,
      onComplete: () => {
        sprite.setAlpha(1);
        done();
      },
      targets: sprite,
    });
  }
  const toX = trotOffX(trot.road, sprite.displayWidth / 2, sprite.x);
  playTag(sprite, sprite.texture.key, "walk");
  sprite.setFlipX(toX < sprite.x);
  return scene.tweens.add({
    duration,
    onComplete: () => {
      sprite.setFlipX(false);
      done();
    },
    targets: sprite,
    x: toX,
  });
}
