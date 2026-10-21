import type { Scene } from "phaser";

import { hitCue } from "../../audio/sound";
import { gameData } from "../../data";
import type { DogId, HintId, HintTrigger } from "../../data/types";
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
  TREAT_EVENT,
  type TreatCue,
} from "../../hud/moments";
import {
  bumpLine,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  lowHeartsLines,
  luckyLine,
  muddyHeartsLines,
  pullLine,
  treatLine,
} from "../../hud/stripLines";
import {
  DOG_REACTIONS,
  dogReaction,
  hitEffects,
  obstacleMotion,
  shakesRoad,
  splashEffect,
  tipSide,
  whiteFlash,
} from "../../layout/hitEffects";
import type { Rect } from "../../layout/rect";
import {
  amountText,
  type Change,
  changeAmount,
  type HeartChange,
  heartsForgiven,
  type MoneyChange,
} from "../../rules/causes";
import { type ChoiceOutcome, type QuipCue, quipLine } from "../../rules/choices";
import { hitWord } from "../../rules/encounters";
import { hintFor } from "../../rules/hints";
import { currentZoneId, walkLength } from "../../rules/route";
import { encounterLook, minorObstacleLook } from "../../rules/skins";
import { read } from "../../rules/units";
import type { PullStep } from "../../runner/pulls";
import type { Random } from "../../runner/random";
import {
  type EncounterCard,
  isMinorObstacle,
  type MinorBump,
  type WalkItemKind,
  type WalkStep,
} from "../../runner/walk";
import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "../../save/achievementPreview";
import type { RunResult } from "../../save/checkpoint";
import type { RunState } from "../../state/runState";
import {
  hitFlashKey,
  hitLabelOf,
  hitLook,
  playEdgeFlash,
  playHitMoment,
  playMinorHitLabel,
} from "../hitMoment";
import { sayMessage } from "../messageStripView";
import { playDodge, playForgiven } from "../packFeedback";
import { earnedIfBanked, shownHints } from "../profileStore";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import { playEffect } from "../sprites";
import { flashWhite, moveObstacle, playHitEffects, shakeRoad } from "./hitFx";
import type { ItemViews } from "./itemViews";
import type { PackView } from "./packView";
import { showInstantPopup } from "./roadBanners";
import { DEPTH, firingSeconds, LAYOUT } from "./stage";

// How long the step's hit stop holds the road, or a plain obstacle's stop while it has none.
function stopMs(step: WalkStep): number {
  const seconds = step.walk.road.hitStop?.seconds;
  return 1000 * (seconds ?? read(gameData.tuning, "seconds", "minorHitStopSeconds"));
}

// A hit's edge flash runs down the road and the backdrop band beside it.
function hitField(): Rect {
  const { backdrop, roadView } = LAYOUT;
  return { ...roadView, height: roadView.y + roadView.height - backdrop.y, y: backdrop.y };
}

// An owner's line, said beside their dog's card.
export interface QuipBubble {
  dog: DogId;
  text: string;
}

// A first-time hint raised for the HUD to say on the message strip.
export interface RaisedHint {
  readonly id: HintId;
  readonly text: string;
}

// Emitted on the run scene's events: ChangeLabel[] whenever money or hearts change, a
// first-time hint (RaisedHint), and QuipBubble[] when owners react.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const QUIPS_EVENT = "quips";
// AchievementId[] when the walk so far has earned badges, for the message strip.
export const ACHIEVEMENTS_EVENT = "achievements";

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
export interface ZonePayout {
  readonly changes: readonly Change[];
  readonly ms: number;
}

export interface RunMomentsDeps {
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
  private readonly scene: Scene;
  // Where the current zone's changes start in changes.
  private zoneStart = 0;

  constructor(scene: Scene, deps: RunMomentsDeps) {
    this.scene = scene;
    this.deps = deps;
  }

  hint(event: HintTrigger): void {
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

  // The changes' labels, and each loss the walker's perk forgave: its strip line, the forgiven
  // label over its dog and the forgiven heart flashing back on its card.
  addChanges(changes: readonly Change[]): void {
    this.changes.push(...changes);
    const labels = changeLabels(gameData, changes);
    if (labels.length > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, labels);
    }
    forgivenLines(gameData, changes).forEach((line) => this.say(line));
    for (const change of changes) {
      if (change.kind === "hearts" && heartsForgiven(change) > 0) {
        this.forgiven(change);
      }
    }
  }

  private forgiven(change: HeartChange): void {
    const top = this.deps.pack.dogPoint(change.dog);
    if (top !== undefined) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      playForgiven(this.scene, moment, { popped: changeAmount(change) !== 0, top });
    }
    if (change.after > 0) {
      const cue: ForgivenCue = { dog: change.dog, hearts: change.after };
      this.scene.events.emit(FORGIVEN_EVENT, cue);
    }
  }

  // A tell barks and says which dog spotted the squirrel; a strain that ends without a pull,
  // blocked or steered away from, bursts over its dog and says nothing. A landed pull raises
  // its hint. The strain, the bubble and the
  // bark pop are drawn with the pack.
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
  }

  // A line on the HUD's message strip, when there is one.
  say(line: MessageLine | null): void {
    if (line !== null) {
      sayMessage(this.scene, line.icon, line.text);
    }
  }

  // Sounds, bursts, labels, hints and strip lines for what happened in a step, around the pack
  // at pack.
  walked(step: WalkStep, pack: { x: number; y: number }): void {
    this.deps.items.strike(step);
    const sound = soundboardOf(this.scene);
    if (step.tips.length > 0) {
      sound.play("tip");
      this.hint({ kind: "tip" });
    }
    this.addChanges(step.tips);
    for (const item of step.collected) {
      playEffect(this.scene, "fx-sparkle", "play", { x: pack.x, y: pack.y - 24 }, DEPTH.fx);
      if (item.kind === "treat") {
        sound.play("treat");
        this.hint({ kind: "treat" });
      }
    }
    // A treat cheers the owner of the dog that grabbed it.
    for (const { change, dog } of step.treats) {
      this.say(treatLine(gameData, change));
      if (change !== null) {
        this.changes.push(change);
        const cue: TreatCue = { dog, labels: changeLabels(gameData, [change]) };
        this.scene.events.emit(TREAT_EVENT, cue);
      }
    }
    // A bump costs the owner of the dog it landed on; a small dog may dodge it.
    const zone = currentZoneId(gameData, step.walk.run);
    for (const bump of step.bumps) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      const { kind } = bump.item;
      const obstacle = isMinorObstacle(gameData, kind)
        ? minorObstacleLook(gameData, zone, kind).name
        : kind;
      this.say(bumpLine(gameData, bump, obstacle));
      if (bump.dodged) {
        this.deps.pack
          .sprites([bump.dog])
          .forEach((sprite) => playDodge(this.scene, moment, sprite));
        continue;
      }
      this.playBumpHit(bump, step, pack);
      sound.play("bump");
      this.addChanges(bump.change === null ? [] : [bump.change]);
      this.playBumpLabel(kind, step, pack);
      this.hint({ kind: "minorBump" });
    }
    this.sayLowHearts(
      step.walk.run,
      step.bumps.flatMap(({ change }) => (change === null ? [] : [change])),
    );
    // A contact obstacle, such as a puddle, plays its own hit sound, a splash at the touching
    // dog's feet and its edge flash, with a plain obstacle's stop; the walker stumbles and every
    // dog reacts and shakes off.
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
        playEdgeFlash(this.scene, moment, hitFlashKey(this.scene, flash));
      }
      this.deps.pack.stumble(still, DOG_REACTIONS.splash);
      this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
      this.sayQuips(outcome.quips);
      this.afterOutcome(outcome);
    }
    this.sayQuips(step.fired.map((dog): QuipCue => ({ dog, moment: "fired" })));
    this.fired(step.fired, step.walk.run);
    for (const { encounter, outcome } of step.instants) {
      this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
      showInstantPopup(this.scene, encounter, this.deps.still());
      this.say(luckyLine(gameData, encounter, outcome.moneyChanges));
      this.sayQuips(outcome.quips);
      this.afterOutcome(outcome);
      this.hint({ kind: "luckyFind" });
    }
    for (const hit of step.encounterHits) {
      const { kind } = gameData.encounters[hit.encounter];
      sound.play(hitCue(kind, hit.encounter));
      this.deps.pack.stumble(this.deps.still(), DOG_REACTIONS.hit);
      this.playHit(hit, step, pack);
    }
  }

  // The debuffs that started and ended between two run states, on the message strip.
  debuffsChanged(before: RunState, after: RunState): void {
    debuffLines(gameData, debuffChanges(before, after)).forEach((line) => this.say(line));
  }

  // Firings a choice or find brought about, and the owners it left on their last heart.
  afterOutcome(outcome: ChoiceOutcome): void {
    this.sayLowHearts(outcome.state, outcome.heartChanges);
    this.fired(outcome.fired, outcome.state);
  }

  // The owners changes left on their last heart, and while run is Muddy, those left one
  // Muddy bump from firing you.
  private sayLowHearts(run: RunState, changes: readonly Change[]): void {
    [...lowHeartsLines(gameData, changes), ...muddyHeartsLines(gameData, run, changes)].forEach(
      (line) => this.say(line),
    );
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

  // Each owner who reacted says one of their lines beside their dog's card; an owner who fired
  // you says theirs in the firing moment.
  sayQuips(quips: readonly QuipCue[]): void {
    const random = this.deps.quips;
    const lines = quips.map((cue) => ({ cue, text: quipLine(gameData, random, cue) }));
    const bubbles = lines.flatMap(({ cue, text }): QuipBubble[] =>
      cue.moment === "fired" ? [] : [{ dog: cue.dog, text }],
    );
    if (bubbles.length > 0) {
      this.scene.events.emit(QUIPS_EVENT, bubbles);
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

  // The hit moment over the stop, framed by the road and the backdrop band beside it, labelled
  // with the encounter's look in the zone.
  private playHit(hit: EncounterCard, step: WalkStep, pack: { x: number; y: number }): void {
    const { road } = LAYOUT;
    const look = encounterLook(gameData, currentZoneId(gameData, step.walk.run), hit.encounter);
    playHitMoment(this.scene, {
      caught: this.deps.pack.sprites(hit.affected),
      centre: { x: pack.x, y: pack.y - 20 },
      depth: DEPTH.popup,
      encounter: hit.encounter,
      field: hitField(),
      kind: gameData.encounters[hit.encounter].kind,
      label: hitLabelOf(look),
      labelX: road.x + road.width / 2,
      seconds: step.walk.road.hitStop?.seconds ?? 0,
      still: this.deps.still(),
      word: hitWord(gameData.encounters[hit.encounter]),
    });
  }

  // A plain or moving hit's cues: its bump and debris over the struck dog, the dog reacting
  // and flashing white, the struck obstacle's motion, and a mover's road shake.
  private playBumpHit(bump: MinorBump, step: WalkStep, pack: { x: number; y: number }): void {
    const still = this.deps.still();
    const { item } = bump;
    const hit = {
      kind: item.mover === undefined ? "plain" : "moving",
      obstacle: isMinorObstacle(gameData, item.kind) ? item.kind : null,
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
    if (shakesRoad(still, hit.kind)) {
      shakeRoad(this.scene);
    }
  }

  // A minor obstacle's hit label in its look for the zone, over the stop; none shows while it
  // has none.
  private playBumpLabel(kind: WalkItemKind, step: WalkStep, pack: { x: number; y: number }): void {
    if (!isMinorObstacle(gameData, kind)) {
      return;
    }
    const zone = currentZoneId(gameData, step.walk.run);
    const label = minorObstacleLook(gameData, zone, kind).hitLabel;
    if (label === null) {
      return;
    }
    const { road } = LAYOUT;
    playMinorHitLabel(this.scene, {
      centre: { x: pack.x, y: pack.y - 20 },
      depth: DEPTH.popup,
      label,
      labelX: road.x + road.width / 2,
      seconds: step.walk.road.hitStop?.seconds ?? 0,
      still: this.deps.still(),
    });
  }
}
