import type { Scene } from "phaser";

import { hitCue } from "../../audio/sound";
import { gameData } from "../../data";
import type { DogId, HintId, HintTrigger } from "../../data/types";
import { type BuffPop, leashPops, popsOf, stepValues, walkStartMarks } from "../../hud/buffMarks";
import { type EffectItem, effectItems, gearWell } from "../../hud/effectIcons";
import { heartPopFrame } from "../../hud/feedback";
import { changeLabels } from "../../hud/hudView";
import type { MessageLine } from "../../hud/messageStrip";
import {
  endScreenDelayMs,
  FIRING_EVENT,
  type FiringCue,
  firingTimeline,
  FORGIVEN_EVENT,
  type ForgivenCue,
  PAYOUT_EVENT,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  SPARE_TREAT_EVENT,
  type SpareTreatCue,
  TREAT_EVENT,
  type TreatCue,
} from "../../hud/moments";
import {
  bumpLines,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  gearFoundLine,
  lowHeartsLines,
  luckyLine,
  pullLine,
  spareTreatSavedLine,
  spareTreatUsedLine,
  treatLine,
} from "../../hud/stripLines";
import { BUFF_POP, CHARM, charmByWalkerRect, charmOverRect } from "../../layout/buffLayout";
import { bumpFlash, type BumpSource } from "../../layout/bumpFlash";
import {
  DOG_REACTIONS,
  dogReaction,
  hitEffects,
  obstacleMotion,
  splashEffect,
  tipSide,
  whiteFlash,
} from "../../layout/hitEffects";
import type { Random } from "../../lib/random";
import type { Point, Rect } from "../../lib/rect";
import {
  amountText,
  type Change,
  changeAmount,
  type HeartChange,
  heartsForgiven,
  type MoneyChange,
} from "../../rules/causes";
import { type ChoiceOutcome, outcomeChanges, type QuipCue, quipLine } from "../../rules/choices";
import { hitWord } from "../../rules/encounters";
import { hintFor } from "../../rules/hints";
import { walkLength } from "../../rules/route";
import { spareTreatGiver, spareTreatSource } from "../../rules/spareTreats";
import { read } from "../../rules/units";
import type { PullStep } from "../../runner/pulls";
import type { EncounterCard, MinorBump, WalkStep } from "../../runner/walk";
import type { WalkItem } from "../../runner/walkItems";
import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "../../save/achievementPreview";
import type { RunResult } from "../../save/checkpoint";
import type { EffectSource, RunState } from "../../state/runState";
import { fillRect } from "../../ui/phaser/draw";
import { PALETTE } from "../../ui/phaser/palette";
import { pixelLinePoints } from "../../ui/pixelShapes";
import { floatValue, popCharm } from "../buffCharm";
import { FEEDBACK_ART } from "../feedbackArt";
import { hitLabelOf, hitLook, playEdgeFlash, playHitMoment } from "../hitMoment";
import { sayMessage } from "../messageStripView";
import { playDodge, playForgiven } from "../packFeedback";
import { earnedIfBanked, shownHints } from "../profileStore";
import { dogTop } from "../pullSignals";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import { playEffect } from "../sprites";
import { flashWhite, moveObstacle, playHitEffects, shakeRoad } from "./hitFx";
import type { ItemViews } from "./itemViews";
import type { PackView } from "./packView";
import { showGearPopup, showInstantPopup } from "./roadBanners";
import { DEPTH, firingSeconds, LAYOUT, overPack } from "./stage";

// How long the step's hit stop holds the road, or a plain obstacle's stop while it has none.
function stopMs(step: WalkStep): number {
  const seconds = step.walk.road.hitStop?.seconds;
  return 1000 * (seconds ?? read(gameData.tuning, "seconds", "minorHitStopSeconds"));
}

// Where a hit's moment and label play: a little over the pack's point, for the step's hit stop.
function hitPlace(step: WalkStep, pack: Point): { centre: Point; seconds: number } {
  return { centre: { x: pack.x, y: pack.y - 20 }, seconds: step.walk.road.hitStop?.seconds ?? 0 };
}

// A hit's edge flash runs down the road and the backdrop band beside it.
function hitField(): Rect {
  const { backdrop, roadView } = LAYOUT;
  return { ...roadView, height: roadView.y + roadView.height - backdrop.y, y: backdrop.y };
}

// An owner's line, said on the message strip.
export interface OwnerQuip {
  dog: DogId;
  text: string;
}

// A first-time hint raised for the HUD to say on the message strip.
export interface RaisedHint {
  readonly id: HintId;
  readonly text: string;
}

// Emitted on the run scene's events: ChangeLabel[] whenever money or hearts change, a
// first-time hint (RaisedHint), and OwnerQuip[] when owners react.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const QUIPS_EVENT = "quips";
// AchievementId[] when the walk so far has earned badges, for the message strip.
export const ACHIEVEMENTS_EVENT = "achievements";
// An EffectItem whose walk bar well glints as its charm pops.
export const BUFF_GLINT_EVENT = "buff-glint";
// A bump's border colour, for the HUD to flash round the screen.
export const BUMP_FLASH_EVENT = "bump-flash";

// Raises the first-time hint for event until it has shown once: the HUD says it on the
// message strip and marks it shown.
export function showHint(scene: Scene, event: HintTrigger): void {
  const hint = hintFor(gameData, [...shownHints(scene)], event);
  if (hint !== null) {
    // A hint raised as the run starts waits a frame for the HUD it launches.
    if (scene.scene.isActive(SCENE_KEYS.hud)) {
      scene.events.emit(HINT_EVENT, hint);
    } else {
      scene.time.delayedCall(0, () => scene.events.emit(HINT_EVENT, hint));
    }
  }
}

// A zone's payout: how long until its coins have landed and their amounts faded, and every
// change the zone made, its fees included.
interface ZonePayout {
  readonly changes: readonly Change[];
  readonly ms: number;
}

interface RunMomentsDeps {
  items: ItemViews;
  pack: PackView;
  quips: Random;
  // Whether animations and bursts keep still, from the player's settings.
  still: () => boolean;
}

// What the walk's events look and sound like: sounds, bursts, hit moments, labels, quips,
// hints and badge lines, and the HUD's feedback moments they cue. It keeps the money and
// heart changes the run banks, and what the end screen waits for.
export class RunMoments {
  private achievements: AchievementPreview = NOTHING_PREVIEWED;
  private readonly changes: Change[] = [];
  private readonly deps: RunMomentsDeps;
  // How long the end screen waits for a final firing or payout.
  private endMoments = { firingSeconds: 0, payoutMs: 0 };
  // The pack's point on the last step walked, for pops away from a dog or an item.
  private pack: Point | undefined;
  private readonly scene: Scene;
  // Where the current zone's changes start in changes.
  private zoneStart = 0;

  constructor(scene: Scene, deps: RunMomentsDeps) {
    this.scene = scene;
    this.deps = deps;
  }

  private hint(event: HintTrigger): void {
    showHint(this.scene, event);
  }

  // Every change the walk made, in order, for banking the run.
  banked(): readonly Change[] {
    return this.changes;
  }

  // How long the end screen still waits for a final firing or payout; once asked, it waits
  // no longer.
  takeEndDelayMs(): number {
    const delayMs = endScreenDelayMs(this.endMoments);
    if (delayMs > 0) {
      this.endMoments = { firingSeconds: 0, payoutMs: 0 };
    }
    return delayMs;
  }

  // The changes' labels, a money loss's from from, where it changed hands, and a money gain's by
  // the cash (changeLabels), and each loss the walker's perk forgave: its strip line, the
  // forgiven label over its dog forgivenAtMs on and the forgiven heart flashing back on its card.
  addChanges(from: Point, changes: readonly Change[], forgivenAtMs = 0): void {
    this.changes.push(...changes);
    const labels = changeLabels(gameData, from, changes);
    if (labels.length > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, labels);
    }
    forgivenLines(gameData, changes).forEach((line) => this.say(line));
    for (const change of changes) {
      if (change.kind === "hearts" && heartsForgiven(change) > 0) {
        this.forgiven(change, forgivenAtMs);
      }
    }
  }

  private forgiven(change: HeartChange, atMs: number): void {
    const label = () => {
      const top = this.deps.pack.dogPoint(change.dog);
      if (top !== undefined) {
        const moment = { depth: DEPTH.fx, still: this.deps.still() };
        playForgiven(this.scene, moment, { popped: changeAmount(change) !== 0, top });
      }
    };
    if (atMs > 0) {
      this.scene.time.delayedCall(atMs, label);
    } else {
      label();
    }
    if (change.after > 0) {
      const cue: ForgivenCue = { dog: change.dog, hearts: change.after };
      this.scene.events.emit(FORGIVEN_EVENT, cue);
    }
  }

  // A tell barks and says which dog spotted the squirrel; a strain that ends without a pull,
  // blocked or steered away from, bursts over its dog and says nothing. A landed pull raises its
  // hint. The strain, the bubble and the bark pop are drawn with the pack.
  pulled(step: PullStep): void {
    if (step.tells.length > 0) {
      soundboardOf(this.scene).play("bark");
      this.hint({ kind: "pull" });
    }
    for (const tell of step.tells) {
      this.say(pullLine(gameData, tell.dog));
    }
    if (step.pulled.some(({ moved }) => moved)) {
      this.hint({ kind: "pullLanded" });
    }
    this.deps.pack.pullFailed(step.failed);
    this.popBuffs(leashPops(gameData, step.walk.run, step.leashed));
  }

  // A line on the HUD's message strip, when there is one.
  say(line: MessageLine | null): void {
    if (line !== null) {
      sayMessage(this.scene, line);
    }
  }

  // Sounds, bursts, labels, hints and strip lines for what happened in a step, around the pack
  // at pack.
  walked(step: WalkStep, pack: Point): void {
    this.pack = pack;
    this.popBuffs(popsOf(gameData, stepValues(step)));
    this.deps.items.strike(step);
    const sound = soundboardOf(this.scene);
    if (step.tips.length > 0) {
      sound.play("tip");
      this.hint({ kind: "tip" });
    }
    // A tip's label pops by the cash, wherever its pickup (changeLabels).
    for (const { change } of step.tips) {
      this.addChanges(overPack(pack), [change]);
    }
    for (const item of step.collected) {
      playEffect(this.scene, "fx-sparkle", "play", overPack(pack), DEPTH.fx);
      if (item.kind === "treat") {
        sound.play("treat");
        this.hint({ kind: "treat" });
      }
    }
    // A treat cheers the owner of the dog that grabbed it, or with every owner at their max goes
    // into the gear that holds spare treats, such as the Fanny pack, whose well glints.
    for (const { change, dog, stored } of step.treats) {
      if (stored) {
        this.say(spareTreatSavedLine(gameData, step.walk.run));
        this.glintGear(spareTreatSource(step.walk.run));
        continue;
      }
      this.say(treatLine(gameData, change));
      if (change !== null) {
        this.changes.push(change);
        const cue: TreatCue = { dog, labels: changeLabels(gameData, overPack(pack), [change]) };
        this.scene.events.emit(TREAT_EVENT, cue);
      }
    }
    // A bump costs the owner of the dog it landed on; the dog may dodge it.
    for (const bump of step.bumps) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      const { kind } = bump.item;
      bumpLines(gameData, bump, gameData.minorObstacles[kind].name).forEach((said) => {
        this.say(said);
      });
      if (bump.dodged) {
        this.deps.pack
          .sprites([bump.dog])
          .forEach((sprite) => playDodge(this.scene, moment, sprite));
        continue;
      }
      this.playBumpHit(bump, step, pack);
      sound.play("bump");
      this.addChanges(
        overPack(pack),
        [bump.change, bump.cash].flatMap((change) => (change === null ? [] : [change])),
        BUFF_POP.fadeAtMs,
      );
      this.hint({ kind: "minorBump" });
    }
    this.sayLowHearts(
      step.bumps.flatMap(({ change }) => (change === null ? [] : [change])),
      step.spareTreat,
    );
    this.spareTreatSpent(step.spareTreat, step.walk.run);
    // A contact obstacle, such as a puddle, plays its own hit sound, a splash at the touching
    // dog's feet, its edge flash and the bump's flash, with a plain obstacle's stop; the walker
    // stumbles and every dog reacts and shakes off.
    for (const { dog, encounter, outcome } of step.contacts) {
      const still = this.deps.still();
      const { kind } = gameData.encounters[encounter];
      sound.play(hitCue(kind, encounter));
      const feet = this.deps.pack.dogFeet(dog);
      if (feet !== undefined) {
        const moment = { depth: DEPTH.fx, holdMs: stopMs(step) };
        playHitEffects(this.scene, moment, [splashEffect(still, feet)]);
      }
      const { flash } = hitLook(kind, encounter);
      if (flash !== null) {
        const moment = { depth: DEPTH.popup, field: hitField(), still };
        playEdgeFlash(this.scene, moment, flash);
      }
      this.flashBump({ encounter, kind: "encounter" });
      this.deps.pack.stumble(still, DOG_REACTIONS.splash);
      this.addChanges(overPack(pack), outcomeChanges(outcome));
      this.afterOutcome(outcome);
    }
    this.sayQuips(step.fired.map((dog): QuipCue => ({ dog, moment: "fired" })));
    this.fired(step.fired, step.walk.run);
    // A lucky find's money changes hands at its pickup; a gain's label pops by the cash
    // (changeLabels), and its popup over the pickup and its strip line show the find.
    for (const { encounter, item, outcome } of step.instants) {
      const changes = outcomeChanges(outcome);
      const at = this.itemPoint(item, pack);
      this.addChanges(at, changes);
      showInstantPopup(this.scene, encounter, at, this.deps.still());
      this.say(luckyLine(gameData, encounter, changes));
      this.afterOutcome(outcome);
      this.hint({ kind: "luckyFind" });
    }
    // A gear drop pops its art over the pickup and glints the found well, whose icon it takes.
    for (const { gear, item, replaced } of step.found) {
      showGearPopup(this.scene, gear, this.itemPoint(item, pack), this.deps.still());
      this.say(gearFoundLine(gameData, gear, replaced));
      const well: EffectItem = { found: true, gear, kind: "gear" };
      this.scene.events.emit(BUFF_GLINT_EVENT, well);
    }
    for (const hit of step.encounterHits) {
      const { kind } = gameData.encounters[hit.encounter];
      sound.play(hitCue(kind, hit.encounter));
      this.deps.pack.stumble(this.deps.still(), DOG_REACTIONS.hit);
      this.playHit(hit, step, pack);
      if (kind === "obstacle") {
        this.flashBump({ encounter: hit.encounter, kind: "encounter" });
      }
    }
  }

  // The debuffs that started and ended between two run states, on the message strip.
  debuffsChanged(before: RunState, after: RunState): void {
    debuffLines(gameData, debuffChanges(before, after)).forEach((line) => this.say(line));
  }

  // The owners' quips at a choice or find, the spare treat it spent, the firings it brought
  // about, and the owners it left on their last heart.
  afterOutcome(outcome: ChoiceOutcome): void {
    this.sayQuips(outcome.quips);
    this.sayLowHearts(outcome.heartChanges, outcome.spareTreat);
    this.spareTreatSpent(outcome.spareTreat, outcome.state);
    this.fired(outcome.fired, outcome.state);
  }

  // The owners changes left on their last heart, after the spare treat given back with them.
  private sayLowHearts(changes: readonly Change[], spare: HeartChange | null): void {
    const given = changes.map((change) =>
      spare !== null && change.kind === "hearts" && change.dog === spare.dog
        ? { ...change, after: spare.after }
        : change,
    );
    lowHeartsLines(gameData, given).forEach((line) => this.say(line));
  }

  // A spare treat given back: its strip line, and the treat flying from its gear's well to the
  // dog's card, where it plays as a treat grabbed (SpareTreatCue).
  private spareTreatSpent(change: HeartChange | null, run: RunState): void {
    if (change === null) {
      return;
    }
    this.changes.push(change);
    this.say(spareTreatUsedLine(gameData, change));
    const cue: SpareTreatCue = {
      dog: change.dog,
      labels: changeLabels(gameData, this.pack ?? { x: 0, y: 0 }, [change]),
      well: gearWell(effectItems(gameData, run), spareTreatGiver(change)),
    };
    this.scene.events.emit(SPARE_TREAT_EVENT, cue);
  }

  // The walk bar well of the gear source names glints.
  private glintGear(source: EffectSource | undefined): void {
    if (source?.kind === "gear") {
      this.scene.events.emit(BUFF_GLINT_EVENT, source);
    }
  }

  // Each owner who fired you has their dog trot off the road over the firing's hold, with
  // their fired line.
  private fired(dogs: readonly DogId[], run: RunState): void {
    if (dogs.length === 0) {
      return;
    }
    soundboardOf(this.scene).play("fired");
    dogs.forEach((dog) => this.say(firedLine(gameData, dog)));
    const still = this.deps.still();
    const { trotMs } = firingTimeline(firingSeconds(), still);
    dogs.forEach((dog) => this.deps.pack.trotOff(dog, trotMs, still));
    if (run.phase.kind === "ended") {
      this.endMoments.firingSeconds = firingSeconds();
    }
  }

  // Each owner who reacted says one of their lines on the message strip; an owner who fired you
  // says theirs in the firing moment.
  sayQuips(quips: readonly QuipCue[]): void {
    const random = this.deps.quips;
    const lines = quips.map((cue) => ({ cue, text: quipLine(gameData, random, cue) }));
    const said = lines.flatMap(({ cue, text }): OwnerQuip[] =>
      cue.moment === "fired" ? [] : [{ dog: cue.dog, text }],
    );
    if (said.length > 0) {
      this.scene.events.emit(QUIPS_EVENT, said);
    }
    for (const { cue, text } of lines) {
      if (cue.moment === "fired") {
        const firing: FiringCue = { dog: cue.dog, line: text, seconds: firingSeconds() };
        this.scene.events.emit(FIRING_EVENT, firing);
      }
    }
  }

  // Badges the walk so far would earn on heading home show on the HUD's message strip; nothing
  // is awarded until the walk is banked.
  previewAchievements(run: RunState): void {
    const earned = (result: RunResult) => earnedIfBanked(this.scene, result);
    const preview = previewAchievements(gameData, earned, this.achievements, run);
    this.achievements = preview.preview;
    if (preview.earned.length > 0) {
      this.scene.events.emit(ACHIEVEMENTS_EVENT, preview.earned);
    }
  }

  // A card choice's values a buff changed, such as a loss forgiven or a debuff shortened: a pop
  // over the owner's dog, or the pack.
  chosen(outcome: ChoiceOutcome): void {
    const values = outcome.modified.map((value) => ({
      bump: false,
      dog: value.subject.kind === "hearts" ? value.subject.dog : null,
      item: null,
      value,
    }));
    this.popBuffs(popsOf(gameData, values));
  }

  // The walk's start: a strip line for each gear that changes it from the start, its well
  // glinting, and a line for each large dog.
  walkStarted(run: RunState): void {
    const marks = walkStartMarks(gameData, run);
    marks.lines.forEach((line) => this.say(line));
    marks.glints.forEach((item) => this.scene.events.emit(BUFF_GLINT_EVENT, item));
  }

  // Each buff's pop: its well glinting, its charm, lit, unless the pop shows none, a chip of the
  // value it made (over the charm, or just over the item where no charm shows), a reach's
  // dotted line, and a forgiven bump's heart turning from loss to gain as its charm shows beside
  // the walker.
  private popBuffs(pops: readonly BuffPop[]): void {
    const still = this.deps.still();
    for (const pop of pops) {
      const rect = this.popRect(pop);
      if (rect === undefined) {
        continue;
      }
      const at = { x: rect.x - pop.index * (CHARM.size + CHARM.gap), y: rect.y };
      const shownAtMs = pop.forgiven === null ? 0 : BUFF_POP.switchMs;
      const show = () => {
        if (pop.charm) {
          popCharm(this.scene, { depth: DEPTH.fx, shownAtMs, still }, pop.item, at);
        }
        this.scene.events.emit(BUFF_GLINT_EVENT, pop.item);
        if (pop.chip !== null) {
          const lineBottom = pop.charm ? at.y - BUFF_POP.gap : at.y + CHARM.size;
          const anchor = { centreX: at.x + CHARM.size / 2, lineBottom };
          floatValue(this.scene, { depth: DEPTH.fx + 1, shownAtMs, still }, anchor, pop.chip);
        }
      };
      if (pop.reach !== null) {
        this.reachLine(pop.reach);
      }
      if (pop.forgiven === null) {
        show();
      } else {
        this.forgivenHeart(pop.forgiven);
        this.scene.time.delayedCall(shownAtMs, show);
      }
    }
  }

  // Where an item is on screen, else over the pack at pack.
  private itemPoint(item: WalkItem, pack: Point): Point {
    return this.deps.items.point(item.id) ?? overPack(pack);
  }

  // The charm's place: beside the walker's head, over its dog, over its item, or over the pack.
  private popRect(pop: BuffPop): Rect | undefined {
    const overPackRect = () => {
      if (this.pack === undefined) {
        return undefined;
      }
      const over = overPack(this.pack);
      return charmOverRect(over.x, over.y);
    };
    switch (pop.at.kind) {
      case "walker":
        return charmByWalkerRect(dogTop(this.deps.pack.walkerSprite()));
      case "dog": {
        const top = this.deps.pack.dogPoint(pop.at.dog);
        return top === undefined ? overPackRect() : charmOverRect(top.x, top.y);
      }
      case "item": {
        const point = this.deps.items.point(pop.at.item);
        return point === null ? overPackRect() : charmOverRect(point.x, point.y);
      }
      case "pack":
        return overPackRect();
      default:
        return pop.at satisfies never;
    }
  }

  // Long reach's 1px amber dotted line from its dog, or the pack, to the item it grabbed.
  private reachLine(reach: NonNullable<BuffPop["reach"]>): void {
    const from = reach.dog === null ? this.pack : this.deps.pack.dogPoint(reach.dog);
    const to = this.deps.items.point(reach.item);
    if (from === undefined || to === null) {
      return;
    }
    const g = this.scene.add.graphics().setDepth(DEPTH.fx);
    const points = pixelLinePoints(
      Math.round(from.x),
      Math.round(from.y),
      Math.round(to.x),
      Math.round(to.y),
    );
    points.forEach(([x, y], i) => {
      if (i % 2 === 0) {
        fillRect(g, PALETTE.amber, { height: 1, width: 1, x, y });
      }
    });
    this.scene.time.delayedCall(BUFF_POP.reachMs, () => g.destroy());
  }

  // A forgiven bump's heart over its dog: the loss pop (the HUD plays it for a loss forgiven in
  // part), turning to the gain pop at switchMs.
  private forgivenHeart(forgiven: NonNullable<BuffPop["forgiven"]>): void {
    const top = this.deps.pack.dogPoint(forgiven.dog);
    if (top === undefined) {
      return;
    }
    const frame = heartPopFrame(top);
    const centre = { x: frame.x + 16, y: frame.y + 16 };
    const pop = (art: { key: string; pop: string }) =>
      playEffect(this.scene, art.key, art.pop, centre, DEPTH.fx);
    const loss = forgiven.whole ? pop(FEEDBACK_ART.heartLoss) : undefined;
    this.scene.time.delayedCall(BUFF_POP.switchMs, () => {
      loss?.destroy();
      pop(FEEDBACK_ART.heartGain);
    });
  }

  // At a zone's end, each dog's pay flies as a coin from its card to the bank while its
  // amount rises over the card. Returns the zone's changes, for its celebration, and how
  // long the coins take to land.
  payOut(fees: readonly MoneyChange[], run: RunState): ZonePayout {
    this.changes.push(...fees);
    const cues = fees.flatMap((fee): PayoutCue[] =>
      fee.dog === null
        ? []
        : [{ amount: fee.amount, dog: fee.dog, text: amountText("money", fee.amount) }],
    );
    this.scene.events.emit(PAYOUT_EVENT, cues);
    this.say(fullPackLine(gameData, fees));
    const ms = payoutMs(payoutFlights(cues, run.pack, this.deps.still()));
    if (run.zoneIndex >= walkLength(gameData) - 1) {
      this.endMoments.payoutMs = ms;
    }
    const changes = this.changes.slice(this.zoneStart);
    this.zoneStart = this.changes.length;
    return { changes, ms };
  }

  // The hit moment over the pack, framed by the road and the backdrop band beside it, labelled
  // with the encounter's hit label over its burst.
  private playHit(hit: EncounterCard, step: WalkStep, pack: Point): void {
    playHitMoment(this.scene, {
      caught: this.deps.pack.sprites(hit.affected),
      ...hitPlace(step, pack),
      depth: DEPTH.popup,
      encounter: hit.encounter,
      field: hitField(),
      kind: gameData.encounters[hit.encounter].kind,
      label: hitLabelOf(gameData.encounters[hit.encounter]),
      still: this.deps.still(),
      word: hitWord(gameData.encounters[hit.encounter]),
    });
  }

  // A plain or moving hit's cues: its bump and debris over the struck dog, the dog reacting
  // and flashing white, the struck obstacle's motion, and the bump's flash.
  private playBumpHit(bump: MinorBump, step: WalkStep, pack: Point): void {
    const still = this.deps.still();
    const { item } = bump;
    const hit = {
      kind: item.mover === undefined ? "plain" : "moving",
      obstacle: item.kind,
    } as const;
    const top = this.deps.pack.dogPoint(bump.dog);
    if (top !== undefined) {
      const moment = { depth: DEPTH.fx, holdMs: stopMs(step) };
      playHitEffects(this.scene, moment, hitEffects(still, { ...hit, top }));
    }
    for (const sprite of this.deps.pack.sprites([bump.dog])) {
      flashWhite(this.scene, sprite, whiteFlash(still));
    }
    this.deps.pack.dogsReact([bump.dog], dogReaction(still, "hit"));
    const body = this.deps.items.struckBody(item.id);
    if (body !== undefined) {
      const side = tipSide(body.sprite.x, pack.x);
      moveObstacle(this.scene, body, obstacleMotion(still, hit, side));
    }
    this.flashBump({ kind: "minor", obstacle: item.kind });
  }

  // A bump's border round the screen, flashed by the HUD in the bump's colour, and the road's
  // nudge unless motion is reduced.
  private flashBump(source: BumpSource): void {
    const { colour, nudge } = bumpFlash(this.deps.still(), source);
    this.scene.events.emit(BUMP_FLASH_EVENT, PALETTE[colour]);
    if (nudge) {
      shakeRoad(this.scene);
    }
  }
}
