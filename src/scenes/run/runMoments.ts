import type { Scene } from "phaser";

import { hitCue } from "../../audio/sound";
import { gameData } from "../../data";
import type { DogId, HintTrigger } from "../../data/types";
import { changeLabels } from "../../hud/hudView";
import {
  endScreenDelayMs,
  FIRING_EVENT,
  type FiringCue,
  PAYOUT_EVENT,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  TREAT_EVENT,
  type TreatCue,
} from "../../hud/moments";
import { amountText, type Change, type MoneyChange } from "../../rules/causes";
import { type ChoiceOutcome, type QuipCue, quipLine } from "../../rules/choices";
import { quirkScaledDogs } from "../../rules/effects";
import { hintFor } from "../../rules/hints";
import { walkLength } from "../../rules/route";
import { flourishesAt, type NeedStep } from "../../runner/needs";
import type { PullStep } from "../../runner/pulls";
import type { Random } from "../../runner/random";
import { type EncounterCard, sniffersOf, type WalkStep } from "../../runner/walk";
import { walkerFootY } from "../../runner/walkGeometry";
import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "../../save/achievementPreview";
import type { RunResult } from "../../save/checkpoint";
import { packDogs } from "../../state/pack";
import type { RunState } from "../../state/runState";
import { hitLabelOf, playHitMoment } from "../hitMoment";
import { playHops, playHopSplash, playMinorBump } from "../packFeedback";
import { earnedIfBanked, shownHints } from "../profileStore";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import { playEffect } from "../sprites";
import type { AccidentSpots } from "./accidentSpots";
import type { PackView } from "./packView";
import { showInstantPopup } from "./roadBanners";
import { DEPTH, firingSeconds, LAYOUT } from "./stage";

// An owner's line, said beside their doghouse.
export interface QuipBubble {
  dog: DogId;
  text: string;
}

// Emitted on the run scene's events: ChangeLabel[] whenever money or hearts change, a
// first-time hint's text, and QuipBubble[] when owners react.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const QUIPS_EVENT = "quips";
// AchievementId[] when the walk so far has earned badges, for a toast.
export const ACHIEVEMENTS_EVENT = "achievements";

// Raises the first-time hint for event until it has shown once: the HUD queues it and marks
// it shown when it starts.
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

export interface RunMomentsDeps {
  pack: PackView;
  quips: Random;
  spots: AccidentSpots;
  // Whether animations and bursts keep still, from the player's settings.
  still: () => boolean;
}

// What the walk's events look and sound like: sounds, bursts, hit moments, labels, quips,
// hints and badge toasts, and the HUD's feedback moments they cue. It keeps the money and
// heart changes the run banks, and what the end screen waits for.
export class RunMoments {
  private achievements: AchievementPreview = NOTHING_PREVIEWED;
  private readonly changes: Change[] = [];
  private readonly deps: RunMomentsDeps;
  // How long the end screen waits for a final firing or payout.
  private endMoments = { firingSeconds: 0, payoutMs: 0 };
  // Owners who fired you since the walk last stepped, whose moment holds the walk.
  private firedNow: DogId[] = [];
  private readonly scene: Scene;

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

  takeFired(): DogId[] {
    const fired = this.firedNow;
    this.firedNow = [];
    return fired;
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

  addChanges(changes: readonly Change[]): void {
    this.changes.push(...changes);
    const labels = changeLabels(gameData, changes);
    if (labels.length > 0) {
      this.scene.events.emit(CHANGE_LABELS_EVENT, labels);
    }
  }

  // A treat from the doghouses: the HUD floats the change's label when the treat lands.
  treatGiven(dog: DogId, change: Change): void {
    this.changes.push(change);
    const cue: TreatCue = { dog, labels: changeLabels(gameData, [change]) };
    this.scene.events.emit(TREAT_EVENT, cue);
  }

  // A tell barks and a blocked strain that ends without a pull bursts over its dog. The
  // strain, the bubble and the bark pop are drawn with the pack.
  pulled(step: PullStep): void {
    if (step.tells.length > 0) {
      soundboardOf(this.scene).play("bark");
      this.hint({ kind: "pull" });
    }
    this.deps.pack.pullFailed(step.failed);
  }

  // A need met bursts at each met dog's feet, with its changes and the owners' lines; one gone
  // wrong raises its hint and shows its changes, and a Regular dog's accident bursts on the dog and leaves a spot
  // on the road, scrolled to scroll.
  needs(step: NeedStep, scroll: number): void {
    const still = this.deps.still();
    for (const moment of step.moments) {
      const { outcome } = moment;
      if (moment.kind === "met") {
        soundboardOf(this.scene).play("treat");
        this.deps.pack.needMet(moment.dogs, moment.need, still);
        this.deps.pack.quirkActed(flourishesAt(gameData, moment));
      } else {
        this.hint({ kind: "accident" });
        if (moment.need === "regular") {
          const feet = this.deps.pack.accident(moment.dog);
          if (feet !== undefined) {
            this.deps.spots.add(scroll - feet.distance, feet.x, still);
          }
        }
      }
      if (outcome !== null) {
        this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
        this.sayQuips(outcome.quips);
        this.afterOutcome(outcome);
      }
    }
  }

  // Sounds, bursts, labels and hints for what happened in a step, around the pack at pack.
  walked(step: WalkStep, pack: { x: number; y: number }): void {
    const sound = soundboardOf(this.scene);
    if (step.tips.length > 0) {
      sound.play("tip");
      this.hint({ kind: "tip" });
    }
    this.addChanges(step.tips);
    this.deps.pack.quirkActed(sniffersOf(gameData, step.walk, step.collected));
    for (const item of step.collected) {
      playEffect(this.scene, "fx-sparkle", "play", { x: pack.x, y: pack.y - 24 }, DEPTH.fx);
      if (item.kind === "treat") {
        sound.play("treat");
        this.hint({ kind: "treat" });
      }
    }
    for (const bump of step.bumps) {
      sound.play("bump");
      this.changes.push(...(bump.change === null ? [] : [bump.change]));
      const contact = { x: pack.x, y: pack.y - 20 };
      playMinorBump(
        this.scene,
        { contact, depth: DEPTH.fx, still: this.deps.still() },
        { amount: bump.change?.amount ?? null, walker: this.deps.pack.walkerSprite() },
      );
      this.deps.pack.stumble(this.deps.still());
      this.deps.pack.showDizzy();
      this.hint({ kind: "minorBump" });
    }
    // Each dog that hops over an area effect says so; an area effect that caught no dog
    // splashes at the pack's feet, and opens no card.
    for (const { caught, hopped } of step.areaContacts) {
      const moment = { depth: DEPTH.fx, still: this.deps.still() };
      if (caught.length === 0) {
        playHopSplash(this.scene, { ...moment, feetY: walkerFootY(LAYOUT.road), x: pack.x });
      }
      const tops = hopped.flatMap((dog) => this.deps.pack.dogPoint(dog) ?? []);
      playHops(this.scene, moment, tops);
      this.hint({ kind: "areaEffect" });
    }
    for (const { encounter, outcome } of step.instants) {
      const { resolution } = gameData.encounters[encounter];
      const effects = resolution.kind === "instant" ? resolution.effects : [];
      this.deps.pack.quirkActed(quirkScaledDogs(gameData, effects, packDogs(outcome.state)));
      this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
      showInstantPopup(this.scene, encounter, this.deps.still());
      this.sayQuips(outcome.quips);
      this.afterOutcome(outcome);
      this.hint({ kind: "luckyFind" });
    }
    for (const hit of step.encounterHits) {
      const { kind } = gameData.encounters[hit.encounter];
      sound.play(hitCue(kind, hit.encounter));
      if (hit.encounter === "puddle") {
        playEffect(this.scene, "fx-splash", "play", { x: pack.x, y: pack.y - 8 }, DEPTH.fx);
      }
      if (kind === "obstacle") {
        this.deps.pack.stumble(this.deps.still());
      }
      this.playHit(hit, pack, step.walk.road.hitStop?.seconds ?? 0);
    }
  }

  // Firings and debuffs a choice or find brought about.
  // The dogs whose quirk a card choice set acting, such as a ratter on a chase.
  quirkActed(dogs: readonly DogId[]): void {
    this.deps.pack.quirkActed(dogs);
  }

  afterOutcome(outcome: ChoiceOutcome): void {
    if (outcome.fired.length > 0) {
      soundboardOf(this.scene).play("fired");
      this.firedNow.push(...outcome.fired);
      outcome.fired.forEach((dog) =>
        this.deps.pack.trotOff(dog, firingSeconds(), this.deps.still()),
      );
      if (outcome.state.phase.kind === "ended") {
        this.endMoments.firingSeconds = firingSeconds();
      }
    }
    for (const { debuff } of outcome.state.debuffs) {
      this.hint({ debuff, kind: "debuff" });
    }
  }

  // Each owner who reacted says one of their lines beside their doghouse; an owner who fired
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

  // Badges the walk so far would earn on heading home toast in the HUD; nothing is awarded
  // until the walk is banked.
  previewAchievements(run: RunState): void {
    const earned = (result: RunResult) => earnedIfBanked(this.scene, result);
    const preview = previewAchievements(gameData, earned, this.achievements, run);
    this.achievements = preview.preview;
    if (preview.earned.length > 0) {
      this.scene.events.emit(ACHIEVEMENTS_EVENT, preview.earned);
    }
  }

  // Each fee flies as a coin from its doghouse to the bank while its amount rises over the
  // doghouse.
  payOut(fees: readonly MoneyChange[], run: RunState): void {
    this.changes.push(...fees);
    const cues = fees.flatMap((fee): PayoutCue[] =>
      fee.dog === null
        ? []
        : [{ amount: fee.amount, dog: fee.dog, text: amountText("money", fee.amount) }],
    );
    this.scene.events.emit(PAYOUT_EVENT, cues);
    if (run.zoneIndex >= walkLength(gameData) - 1) {
      this.endMoments.payoutMs = payoutMs(payoutFlights(cues, run.pack, this.deps.still()));
    }
  }

  // The hit moment over the stop, framed by the road and the backdrop band beside it.
  private playHit(hit: EncounterCard, pack: { x: number; y: number }, seconds: number): void {
    const { backdrop, road, roadView } = LAYOUT;
    playHitMoment(this.scene, {
      caught: this.deps.pack.sprites(hit.affected),
      centre: { x: pack.x, y: pack.y - 20 },
      depth: DEPTH.popup,
      encounter: hit.encounter,
      field: { ...roadView, height: roadView.y + roadView.height - backdrop.y, y: backdrop.y },
      kind: gameData.encounters[hit.encounter].kind,
      label: hitLabelOf(gameData.encounters[hit.encounter]),
      labelX: road.x + road.width / 2,
      seconds,
      still: this.deps.still(),
    });
  }
}
