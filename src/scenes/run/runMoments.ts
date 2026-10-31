import type { Random } from "@andornaut/game-kit/random";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";

import { debuffSoundCue } from "../../audio/sound";
import { choiceCues, contactCues, pullCues, stepCues } from "../../audio/stepCues";
import { gameData } from "../../data";
import type { DogId, EncounterId, HintId, HintTrigger } from "../../data/types";
import {
  type BuffPop,
  heartPopDogs,
  leashPops,
  reachIcons,
  type ReachLine,
  type RoadMarks,
  roadMarks,
  stepValues,
  walkStartMarks,
} from "../../hud/buffMarks";
import { type EffectItem, effectItems, gearWell } from "../../hud/effectIcons";
import { heartPopFrame, stackOverPop } from "../../hud/feedback";
import { changeLabels, reachedLabels, totalLabel } from "../../hud/hudView";
import type { MessageLine } from "../../hud/messageStrip";
import {
  endScreenDelayMs,
  FIRING_EVENT,
  type FiringCue,
  firingTimeline,
  FORGIVEN_EVENT,
  type ForgivenCue,
  type Payout,
  PAYOUT_EVENT,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  SPARE_TREAT_EVENT,
  type SpareTreatCue,
  TREAT_EVENT,
  type TreatCue,
} from "../../hud/moments";
import { cashLostLabel, cashLostMs } from "../../hud/moneyLabels";
import {
  bumpLines,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  gearFoundLine,
  luckyLine,
  pullLine,
  spareTreatUsedLine,
  treatGrabLine,
} from "../../hud/stripLines";
import { BUFF_POP, CHARM, charmByWalkerRect, charmOverRect } from "../../layout/buffLayout";
import { bumpFlash, type BumpSource } from "../../layout/bumpFlash";
import {
  contactDebuffBatch,
  ContactImpactFrame,
  contactImpacts,
  DOG_REACTIONS,
  dogReaction,
  hitEffects,
  obstacleMotion,
  splashEffect,
  whiteFlash,
} from "../../layout/hitEffects";
import {
  type Change,
  type HeartChange,
  heartsForgiven,
  type MoneyChange,
} from "../../rules/causes";
import { type ChoiceOutcome, outcomeChanges, type QuipCue, quipLine } from "../../rules/choices";
import { hitWord } from "../../rules/encounters";
import { hintFor } from "../../rules/hints";
import { walkLength } from "../../rules/route";
import { walkEarnings } from "../../rules/run";
import { spareTreatGiver, spareTreatSource } from "../../rules/spareTreats";
import { read } from "../../rules/units";
import { minorLook, minorObstacleName } from "../../runner/obstacleLooks";
import type { PullStep } from "../../runner/pulls";
import type { EncounterCard, MinorBump, WalkStep } from "../../runner/walk";
import type { WalkItem } from "../../runner/walkItems";
import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "../../save/achievementPreview";
import type { RunResult } from "../../save/checkpoint";
import { packDogs } from "../../state/pack";
import type { EffectSource, EndReason, RunState } from "../../state/runState";
import { PALETTE } from "../../ui/palette";
import { fillRect } from "../../ui/phaser/draw";
import { pixelLinePoints } from "../../ui/pixelShapes";
import { floatValue, popCharm } from "../buffCharm";
import { FEEDBACK_ART } from "../feedbackArt";
import { hitLabelOf, hitLook, playEdgeFlash, playHitMoment } from "../hitMoment";
import { sayMessage } from "../messageStripView";
import { floatChipHeight, type HeartPopPlace, playDodge, playForgiven } from "../packFeedback";
import { earnedIfBanked, shownHints } from "../profileStore";
import { dogTop } from "../pullSignals";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import { playEffect, tagTopY } from "../sprites";
import { playContactDebuff } from "./contactDebuffFx";
import { flashWhite, moveObstacle, playHitEffects, shakeRoad } from "./hitFx";
import type { ItemViews } from "./itemViews";
import type { PackView } from "./packView";
import { showDebuffPopup, showGearPopup, showInstantPopup } from "./roadBanners";
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

// Nothing for the end screen to wait for.
const NO_END_MOMENTS: Readonly<Parameters<typeof endScreenDelayMs>[0]> = {
  firingSeconds: 0,
  lossMs: 0,
  payoutMs: 0,
};

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
  private readonly contactFrame = new ContactImpactFrame();
  private readonly deps: RunMomentsDeps;
  // How long the end screen waits for a final firing, the cash it lost, or a payout.
  private endMoments = { ...NO_END_MOMENTS };
  // The pack's point on the last step walked, for pops away from a dog or an item.
  private pack: Point | undefined;
  // The heart pops over dogs in the step being walked, which its charms and forgiven labels
  // stack over (stackOverPop).
  private heartPops = new Map<DogId, HeartPopPlace>();
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
      this.endMoments = { ...NO_END_MOMENTS };
    }
    return delayMs;
  }

  // The changes' labels, a money loss's from from, where it changed hands, and a money gain's by
  // the cash (changeLabels), each carrying reachIcon for a pickup grabbed by reach
  // (reachedLabels), and each loss the walker's perk forgave: its strip line, the forgiven label
  // over its dog forgivenAtMs on and the forgiven heart flashing back on its card.
  addChanges(
    from: Point,
    changes: readonly Change[],
    forgivenAtMs = 0,
    reachIcon: string | undefined = undefined,
  ): void {
    this.changes.push(...changes);
    const labels = reachedLabels(reachIcon, changeLabels(from, changes));
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
    const pop = this.heartPops.get(change.dog);
    const label = () => {
      const top = this.deps.pack.dogPoint(change.dog);
      if (top !== undefined) {
        const moment = { depth: DEPTH.fx, still: this.deps.still() };
        playForgiven(this.scene, moment, { pop: pop ?? null, top });
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
  // blocked or steered away from, bursts over its dog and says nothing. A landed pull plays the
  // squirrel's sound and raises its hint (pullCues). The strain, the bubble and the bark pop are
  // drawn with the pack.
  pulled(step: PullStep): void {
    const sound = soundboardOf(this.scene);
    pullCues(step).forEach((cue) => sound.play(cue));
    if (step.tells.length > 0) {
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

  // Sounds (stepCues), bursts, labels, hints and strip lines for what happened in a step,
  // around the pack at pack.
  walked(before: RunState, pack: Point, step: WalkStep): void {
    this.pack = pack;
    this.heartPops = this.hudHeartPops(step);
    const marks = roadMarks(gameData, stepValues(step));
    this.markRoad(marks);
    const reached = reachIcons(marks.reaches);
    this.deps.items.strike(step);
    const sound = soundboardOf(this.scene);
    const materials = new Set(contactCues(gameData, step));
    stepCues(gameData, step).forEach((cue) => {
      if (materials.has(cue)) {
        sound.playContact(cue);
      } else {
        sound.play(cue);
      }
    });
    if (step.tips.length > 0) {
      this.hint({ kind: "tip" });
    }
    // A tip's label pops by the cash, wherever its pickup (changeLabels), with the reaching
    // buff's icon when grabbed by reach.
    for (const { change, item } of step.tips) {
      this.addChanges(overPack(pack), [change], 0, reached.get(item.id));
    }
    for (const item of step.collected) {
      playEffect(this.scene, "fx-sparkle", "play", overPack(pack), DEPTH.fx);
      if (item.kind === "treat") {
        this.hint({ kind: "treat" });
      }
    }
    // A treat cheers the owner of the dog that grabbed it, or with every owner at their max goes
    // into the gear that holds spare treats, such as the Fanny pack, whose well glints, or pays
    // cash, whose label pops by the cash as a lucky find's does (changeLabels). A treat grabbed
    // by reach carries the reaching buff's icon on its heart and label, or its cash's label.
    for (const grab of step.treats) {
      const { cash, change, dog, item, stored } = grab;
      this.say(treatGrabLine(gameData, grab, step.walk.run));
      if (stored) {
        this.glintGear(spareTreatSource(step.walk.run));
        continue;
      }
      if (cash !== null) {
        this.addChanges(overPack(pack), [cash], 0, reached.get(item.id));
      }
      if (change !== null) {
        this.changes.push(change);
        const labels = changeLabels(overPack(pack), [change]);
        const cue: TreatCue = { dog, labels: reachedLabels(reached.get(item.id), labels) };
        this.scene.events.emit(TREAT_EVENT, cue);
      }
    }
    // A bump costs the owner of the dog it landed on; the dog may dodge it.
    for (const bump of step.bumps) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      const { kind, skin } = bump.item;
      bumpLines(gameData, bump, minorObstacleName(gameData, kind, skin)).forEach((said) => {
        this.say(said);
      });
      if (bump.dodged) {
        this.deps.pack
          .sprites([bump.dog])
          .forEach((sprite) => playDodge(this.scene, moment, sprite));
        continue;
      }
      this.playBumpHit({ ground: false }, bump.dog, bump.item, step);
      this.addChanges(
        overPack(pack),
        [bump.change, bump.cash].flatMap((change) => (change === null ? [] : [change])),
        BUFF_POP.fadeAtMs,
      );
      this.hint({ kind: "minorBump" });
    }
    this.spareTreatSpent(step.spareTreat, step.walk.run);
    // A contact obstacle, such as a puddle, plays its own hit sound, a splash at the touching
    // dog's feet, its edge flash and the bump's flash, with a plain obstacle's stop; the walker
    // stumbles and every dog reacts and shakes off. A minor obstacle with contact plays its bump's
    // cues instead (playBumpHit), as the splash, the shake-off and the edge flash strips are a
    // contact obstacle's own. Applied or refreshed debuffs add one whole-pack ground cue and
    // sound per kind in this contact batch; each contact still pops its own changes.
    const impacts = this.contactFrame.take(
      this.scene.game.loop.frame,
      contactImpacts(gameData, step),
    );
    for (const { dog, item, source } of impacts) {
      if (source.kind === "minor") {
        this.playBumpHit({ ground: true }, dog, { ...item, kind: source.obstacle }, step);
      } else {
        this.playContactHit(dog, source.encounter, step);
      }
    }
    for (const { outcome } of step.contacts) {
      this.addChanges(overPack(pack), outcomeChanges(outcome));
      this.afterOutcome(outcome);
    }
    const debuffCues = this.contactFrame.takeDebuffs(
      this.scene.game.loop.frame,
      contactDebuffBatch(
        this.deps.still(),
        before,
        step.contacts.map(({ outcome, source }) => {
          const contact =
            source.kind === "minor"
              ? gameData.minorObstacles[source.obstacle].contact
              : gameData.encounters[source.encounter].resolution;
          return {
            after: outcome.state,
            effects: contact !== undefined && "effects" in contact ? contact.effects : [],
          };
        }),
      ),
    );
    const lead = packDogs(step.walk.run)[0];
    const leadTop = lead === undefined ? undefined : this.deps.pack.dogPoint(lead);
    for (const cue of debuffCues) {
      if (leadTop !== undefined) {
        showDebuffPopup(this.scene, leadTop, cue.debuff);
      }
      sound.play(debuffSoundCue(cue.debuff));
      playContactDebuff(
        this.scene,
        {
          depth: DEPTH.sprite - 0.5,
          feet: () => this.deps.pack.cueFeet(),
          view: LAYOUT.roadView,
        },
        cue,
      );
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
      this.say(luckyLine(gameData, encounter));
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
      this.deps.pack.stumble(this.deps.still(), DOG_REACTIONS.hit);
      this.playHit(hit, step, pack);
      if (kind === "obstacle") {
        this.flashBump({ encounter: hit.encounter, kind: "encounter" });
      }
    }
    this.heartPops = new Map();
  }

  // The HUD's heart pop over each dog whose hearts the step changes, where heartFeedback.ts
  // plays it.
  private hudHeartPops(step: WalkStep): Map<DogId, HeartPopPlace> {
    const inkTop = this.popInkTop();
    return new Map(
      heartPopDogs(step).flatMap((dog): [DogId, HeartPopPlace][] => {
        const top = this.deps.pack.dogPoint(dog);
        return top === undefined ? [] : [[dog, { frame: heartPopFrame(top), inkTop }]];
      }),
    );
  }

  // The heart pops' top opaque row, fx-heart-gain's and fx-heart-loss's pop tags alike.
  private popInkTop(): number {
    const { heartGain, heartLoss } = FEEDBACK_ART;
    return Math.min(...[heartGain, heartLoss].map(({ key, pop }) => tagTopY(this.scene, key, pop)));
  }

  // The debuffs that started and ended between two run states, on the message strip.
  debuffsChanged(before: RunState, after: RunState): void {
    debuffLines(gameData, debuffChanges(before, after)).forEach((line) => this.say(line));
  }

  // The owners' quips at a choice or find, the spare treat it spent and the firings it brought
  // about.
  afterOutcome(outcome: ChoiceOutcome): void {
    this.sayQuips(outcome.quips);
    this.spareTreatSpent(outcome.spareTreat, outcome.state);
    this.fired(outcome.fired, outcome.state);
  }

  // A spare treat given back: its strip line, the treat sound, and the treat flying from its gear's well to the
  // dog's card, where it plays as a treat grabbed (SpareTreatCue).
  private spareTreatSpent(change: HeartChange | null, run: RunState): void {
    if (change === null) {
      return;
    }
    this.changes.push(change);
    soundboardOf(this.scene).play("treat");
    this.say(spareTreatUsedLine(gameData, change));
    const cue: SpareTreatCue = {
      dog: change.dog,
      labels: changeLabels(this.pack ?? { x: 0, y: 0 }, [change]),
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
  // their fired line. When the last one fires you, the walk loses its cash (cashLost) once the
  // firing has played.
  private fired(dogs: readonly DogId[], run: RunState): void {
    if (dogs.length === 0) {
      return;
    }
    soundboardOf(this.scene).play("fired");
    dogs.forEach((dog) => this.say(firedLine(gameData, dog)));
    const still = this.deps.still();
    const { trotMs } = firingTimeline(firingSeconds(), still);
    dogs.forEach((dog) => this.deps.pack.trotOff(dog, trotMs, still));
    if (run.phase.kind !== "ended") {
      return;
    }
    this.endMoments.firingSeconds = firingSeconds();
    this.cashLost(run.phase.reason, run);
  }

  // A walk that heads home loses its cash (cashLost).
  headedHome(run: RunState): void {
    this.cashLost("wentHome", run);
  }

  // The cash a walk ending for reason carried and lost (walkEarnings) pops by the cash and the
  // counter counts down to what the walk keeps, before the end screen opens. The loss stays out
  // of the banked changes: the end screen's breakdown takes it from the run's result.
  private cashLost(reason: EndReason, run: RunState): void {
    const { lost } = walkEarnings(reason, run);
    if (lost > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, [cashLostLabel(lost)]);
      this.endMoments.lossMs = cashLostMs(this.deps.still(), lost);
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

  // A card choice's heart loss sound (choiceCues), and its values a buff changed, such as a loss
  // forgiven or a debuff shortened: a pop over the owner's dog, or the pack.
  chosen(outcome: ChoiceOutcome): void {
    const sound = soundboardOf(this.scene);
    choiceCues(outcomeChanges(outcome)).forEach((cue) => sound.play(cue));
    const values = outcome.modified.map((value) => ({
      bump: false,
      dog: value.subject.kind === "hearts" ? value.subject.dog : null,
      item: null,
      value,
    }));
    this.markRoad(roadMarks(gameData, values));
  }

  // The walk's start: a strip line for each gear that changes it from the start, its well
  // glinting, and a line for each large dog.
  walkStarted(run: RunState): void {
    const marks = walkStartMarks(gameData, run);
    marks.lines.forEach((line) => this.say(line));
    marks.glints.forEach((item) => this.scene.events.emit(BUFF_GLINT_EVENT, item));
  }

  // Each reach's dotted line, its well glinting, and each buff's pop.
  private markRoad({ pops, reaches }: RoadMarks): void {
    for (const reach of reaches) {
      this.reachLine(reach);
      this.scene.events.emit(BUFF_GLINT_EVENT, reach.glint);
    }
    this.popBuffs(pops);
  }

  // Each buff's pop: its well glinting, its charm, lit, a chip of the value it made over the
  // charm, if any, and a forgiven bump's heart turning from loss to gain as its charm shows
  // beside the walker.
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
        popCharm(this.scene, { depth: DEPTH.fx, shownAtMs, still }, pop.item, at);
        this.scene.events.emit(BUFF_GLINT_EVENT, pop.item);
        if (pop.chip !== null) {
          const anchor = { centreX: at.x + CHARM.size / 2, lineBottom: at.y - BUFF_POP.gap };
          floatValue(this.scene, { depth: DEPTH.fx + 1, shownAtMs, still }, anchor, pop.chip);
        }
      };
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
        const under = this.heartPops.get(pop.at.dog);
        if (under !== undefined) {
          const { size } = CHARM;
          const { bottom } = stackOverPop(under, size);
          const x = Math.round(under.frame.x + 16 - size / 2);
          return { height: size, width: size, x, y: bottom - size };
        }
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
  private reachLine(reach: ReachLine): void {
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
  // part), turning to the gain pop at switchMs, moved down when its forgiven label stacked over
  // it would rise past the walk view's top (stackOverPop).
  private forgivenHeart(forgiven: NonNullable<BuffPop["forgiven"]>): void {
    const top = this.deps.pack.dogPoint(forgiven.dog);
    if (top === undefined) {
      return;
    }
    const inkTop = this.popInkTop();
    const height = floatChipHeight(this.scene);
    const { frame } = stackOverPop(
      { frame: heartPopFrame(top), inkTop },
      height,
      LAYOUT.walkView.y,
    );
    this.heartPops.set(forgiven.dog, { frame, inkTop });
    const centre = { x: frame.x + 16, y: frame.y + 16 };
    const pop = (art: { key: string; pop: string }) =>
      playEffect(this.scene, art.key, art.pop, centre, DEPTH.fx);
    const loss = forgiven.whole ? pop(FEEDBACK_ART.heartLoss) : undefined;
    this.scene.time.delayedCall(BUFF_POP.switchMs, () => {
      loss?.destroy();
      pop(FEEDBACK_ART.heartGain);
    });
  }

  // At a zone's end, each dog's pay flies as a coin from its card to the bank while the total
  // the zone's end pays shows by the cash. Returns the zone's changes, for its celebration, and
  // how long the coins take to land and the total to fade.
  payOut(fees: readonly MoneyChange[], run: RunState): ZonePayout {
    this.changes.push(...fees);
    const payout: Payout = {
      fees: fees.flatMap((fee): PayoutCue[] =>
        fee.dog === null ? [] : [{ amount: fee.amount, dog: fee.dog }],
      ),
      total: totalLabel(fees),
    };
    this.scene.events.emit(PAYOUT_EVENT, payout);
    this.say(fullPackLine(gameData, fees));
    const flights = payoutFlights(payout.fees, run.pack, this.deps.still());
    const ms = payout.total === null ? 0 : payoutMs(flights);
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
  private playBumpHit(
    context: { ground: boolean },
    dog: DogId,
    item: MinorBump["item"],
    step: WalkStep,
  ): void {
    const still = this.deps.still();
    const hit = {
      kind: item.mover === undefined ? "plain" : "moving",
      obstacle: item.kind,
    } as const;
    const top = context.ground ? this.deps.pack.dogFeet(dog) : this.deps.pack.dogPoint(dog);
    if (top !== undefined) {
      const moment = {
        depth: context.ground ? DEPTH.sprite - 0.5 : DEPTH.fx,
        holdMs: stopMs(step),
      };
      playHitEffects(this.scene, moment, hitEffects(still, { ...hit, top }));
    }
    for (const sprite of this.deps.pack.sprites([dog])) {
      flashWhite(this.scene, sprite, whiteFlash(still));
    }
    this.deps.pack.dogsReact([dog], dogReaction(still, "hit"));
    const body = this.deps.items.struckBody(item.id);
    if (body !== undefined) {
      moveObstacle(this.scene, body, obstacleMotion(still, hit));
    }
    this.flashBump({ kind: "minor", look: minorLook(gameData, item.kind, item.skin) });
  }

  // A contact obstacle's cues: a splash at the touching dog's feet, its edge flash, the bump's
  // flash, and the walker stumbling as every dog reacts and shakes off.
  private playContactHit(dog: DogId, encounter: EncounterId, step: WalkStep): void {
    const still = this.deps.still();
    const { kind } = gameData.encounters[encounter];
    const feet = this.deps.pack.dogFeet(dog);
    if (feet !== undefined) {
      const moment = { depth: DEPTH.sprite - 0.5, holdMs: stopMs(step) };
      playHitEffects(this.scene, moment, [splashEffect(still, feet)]);
    }
    const { flash } = hitLook(kind, encounter);
    if (flash !== null) {
      const moment = { depth: DEPTH.popup, field: hitField(), still };
      playEdgeFlash(this.scene, moment, flash);
    }
    this.flashBump({ encounter, kind: "encounter" });
    this.deps.pack.stumble(still, DOG_REACTIONS.splash);
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
