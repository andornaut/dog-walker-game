import { Scene } from "phaser";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { DogId } from "../data/types";
import { randomStream } from "../dev/randomStreams";
import type { RunSetup } from "../dev/runSetup";
import { withSetupStart } from "../dev/setupRun";
import { startZoneClocks, tickZoneClocks, type ZoneClocks } from "../dev/zoneClock";
import { cardHintTriggers } from "../hud/hintTriggers";
import type { RunPause } from "../hud/topBar";
import { isPhoneSideways, PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import {
  cardFor,
  type CardView,
  type Choice,
  chooseOption,
  offerFork,
  offerUpgrades,
  openCard,
} from "../rules/choices";
import { currentZone } from "../rules/route";
import { giveTreat } from "../rules/treats";
import { read } from "../rules/units";
import { holdForFiring } from "../runner/firingStop";
import {
  type FixedStepLimits,
  frameSteps,
  holdStepClock,
  startStepClock,
  type StepClock,
} from "../runner/fixedStep";
import { isNeedSpot, stepNeeds } from "../runner/needs";
import { NO_PULLS, type Pulls, stepPulls } from "../runner/pulls";
import { activeStatuses, shownStatus, startStatuses, type StatusMark } from "../runner/statuses";
import {
  finishZone,
  headHome,
  planZone,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  zoneLength,
} from "../runner/walk";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { type CardSource, type Loadout, newRun, type RunState } from "../state/runState";
import { colorFromHex } from "./palette";
import type { PauseSceneData } from "./PauseScene";
import {
  checkpointRun,
  currentSettings,
  finishRun,
  isMuted,
  onSettingsChanged,
  type Settings,
} from "./profileStore";
import { AccidentSpots } from "./run/accidentSpots";
import { BackdropView } from "./run/backdropView";
import { ForcedStopView } from "./run/forcedStopView";
import { ensureRoadPlaceholders, ItemViews } from "./run/itemViews";
import { MenuFlow } from "./run/menuFlow";
import { PackView } from "./run/packView";
import { ZoneBanner, zoneBannerMs } from "./run/roadBanners";
import { RoadArt, RoadView } from "./run/roadView";
import { RunInput } from "./run/runInput";
import { RunMoments, showHint } from "./run/runMoments";
import { emitDevState, RunRecorder } from "./run/runRecorder";
import { pickedLoadout, type RunRandom, runRandom } from "./run/runStart";
import { ShadowPool } from "./run/shadowPool";
import { firingSeconds, LAYOUT, packPoint, roadGeometry } from "./run/stage";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";

// StartScene's pick; the run reads its loadout through runLoadout instead.
export interface RunSceneData {
  loadout: Loadout;
  // The chosen walker's sprite key.
  walkerSprite: string;
}

// What the HUD draws: the run, the dogs the open card affects, the dogs' statuses, newest
// first, and how far through the zone.
export interface RunHudView {
  affected: readonly DogId[];
  run: RunState;
  statuses: readonly StatusMark[];
  zoneFraction: number;
}

// Steps of 1/60 s. A frame catches up at most a second of steps (60), which covers a frame held
// up by garbage collection or a slow device; a longer stall drops the rest rather than jumping
// the walk ahead.
const STEP_MS = 1000 / 60;
const STEPPING: FixedStepLimits = { maxFrameMs: 1000, stepMs: STEP_MS };

// One run's views, input, menus and dev hooks, made as it starts.
interface RunWorld {
  backdrop: BackdropView;
  banner: ZoneBanner;
  input: RunInput;
  items: ItemViews;
  menus: MenuFlow;
  moments: RunMoments;
  pack: PackView;
  random: RunRandom;
  recorder: RunRecorder;
  road: RoadView;
  setup: RunSetup;
  shadows: ShadowPool;
  spots: AccidentSpots;
  stop: ForcedStopView;
}

// The walk: backdrop, road, walker, pack and everything spawned on the road. The simulation
// steps at a fixed rate and stops while a card or the pause menu is up.
export class RunScene extends Scene {
  private cardQueue: CardSource[] = [];
  private distanceBeforeZone = 0;
  private needsZonePlan = false;
  private pulls: Pulls = NO_PULLS;
  private readonly roadArt = new RoadArt(this);
  private runTimeMs = 0;
  private settings: Settings | undefined;
  private statusMarks: readonly StatusMark[] = [];
  private stepClock: StepClock = startStepClock;
  private walk: Walk | undefined;
  private world: RunWorld | undefined;
  private zoneClocks: ZoneClocks = startZoneClocks(0);
  private zoneEndPending = false;

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(): void {
    this.resetState();
    ensureRoadPlaceholders(this);

    const recorder = new RunRecorder();
    const setup = recorder.setup();
    const random = runRandom(setup.seed);
    const picked = pickedLoadout(this, setup);
    const run = withSetupStart(setup, newRun(gameData, picked.dogSlots, picked.loadout));
    // The log names the pack and gear walked and a later start's route, so its replay does
    // not read the saved loadout. Each fork's path is a card choice in its events.
    recorder.start({
      ...setup,
      gear: picked.loadout.gear,
      pack: picked.loadout.dogs,
      ...(setup.zone === 1 ? {} : { route: run.route }),
    });
    this.walk = planned(setup, { road: startRoad(LANE_COUNT, setup.speed), run });

    this.settings = currentSettings(this);
    const sound = soundboardOf(this);
    this.applyVolumes();
    onSettingsChanged(this, (settings) => {
      this.settings = settings;
      this.applyVolumes();
    });

    this.world = this.createWorld(recorder, random, setup, picked);
    this.world.input.listen();
    this.listen();

    this.scene.launch(SCENE_KEYS.hud);
    sound.setPaused(false);
    sound.setCardOpen(false);
    sound.startMusic();
    startWakeLock();
    this.world.banner.show(this.walk.run, this.reducedMotion());
    // The first hints wait for the zone banner to leave: how to steer, then the Home button.
    this.time.delayedCall(zoneBannerMs(this.reducedMotion()), () => {
      if (this.sys.game.device.input.touch) {
        showHint(this, { kind: "drag" });
      }
      showHint(this, { kind: "homeButton" });
    });
    this.draw();
    // A phone already on its side, as when a walk starts from the page's URL, gets no
    // turned-sideways event, so the walk opens paused under the turn-upright notice.
    if (isPhoneSideways()) {
      this.openPause();
    }
  }

  // The settings' volumes, or silence while muted.
  private applyVolumes(): void {
    const settings = this.settings ?? currentSettings(this);
    const sound = soundboardOf(this);
    sound.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume });
    sound.setMuted(isMuted(this));
  }

  private resetState(): void {
    this.cardQueue = [];
    this.distanceBeforeZone = 0;
    this.needsZonePlan = false;
    this.pulls = NO_PULLS;
    this.runTimeMs = 0;
    this.statusMarks = [];
    this.stepClock = startStepClock;
    this.world = undefined;
    this.zoneClocks = startZoneClocks(0);
    this.zoneEndPending = false;
  }

  // The views are made in draw order: the backdrop, the road, then the pack.
  private createWorld(
    recorder: RunRecorder,
    random: RunRandom,
    setup: RunSetup,
    picked: { loadout: Loadout; walkerSprite: string },
  ): RunWorld {
    const backdrop = new BackdropView(this, random.scenery);
    const road = new RoadView(this, this.roadArt, LAYOUT.rasterView);
    const pack = new PackView(this, picked.loadout.dogs, picked.walkerSprite);
    const spots = new AccidentSpots(this);
    const still = () => this.reducedMotion();
    return {
      backdrop,
      banner: new ZoneBanner(this),
      input: new RunInput(this, {
        openPause: () => this.openPause(),
        replaying: () => recorder.replaying(),
        runPause: () => this.runPause(),
        walk: () => this.walk,
      }),
      items: new ItemViews(this, (event) => showHint(this, event)),
      menus: new MenuFlow(this, {
        dropPress: () => this.world?.input.dropPress(),
        headHome: () => {
          if (this.walk !== undefined) {
            this.headHome(this.walk);
          }
        },
        over: () => this.walk === undefined || this.walk.run.phase.kind === "ended",
      }),
      moments: new RunMoments(this, { pack, quips: random.quips, spots, still }),
      pack,
      random,
      recorder,
      road,
      setup,
      shadows: new ShadowPool(this),
      spots,
      stop: new ForcedStopView(this),
    };
  }

  private listen(): void {
    const onBack = () => this.openPause();
    const onHidden = () => {
      this.openPause();
      const walk = this.walk;
      if (walk !== undefined && walk.run.phase.kind !== "ended") {
        void checkpointRun(this, checkpointOf(gameData, walk.run));
      }
    };
    const onSideways = () => this.openPause();
    const onBlur = () => this.world?.input.dropPress();
    window.addEventListener("blur", onBlur);
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    window.addEventListener(PHONE_EVENTS.appHidden, onHidden);
    window.addEventListener(PHONE_EVENTS.turnedSideways, onSideways);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      window.removeEventListener(PHONE_EVENTS.appHidden, onHidden);
      window.removeEventListener(PHONE_EVENTS.turnedSideways, onSideways);
      stopWakeLock();
    });
  }

  hudView(): RunHudView | undefined {
    if (this.walk === undefined) {
      return undefined;
    }
    const { run } = this.walk;
    return {
      affected: this.world?.menus.card()?.affected ?? [],
      run,
      statuses: this.statuses(run),
      zoneFraction: run.zoneDistance / zoneLength(gameData, run),
    };
  }

  private statuses(run: RunState): StatusMark[] {
    const seconds = read(gameData.tuning, "seconds", "statusVisualSeconds");
    return activeStatuses(seconds, run, this.runTimeMs, this.statusMarks);
  }

  // The dog's centre column and top opaque row on the road, while it is shown there.
  dogPoint(dog: DogId): { x: number; y: number } | undefined {
    return this.world?.pack.dogPoint(dog);
  }

  // Whether animations and bursts keep still, from the player's settings.
  reducedMotion(): boolean {
    return this.settings?.reducedMotion ?? false;
  }

  override update(time: number): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const frame = frameSteps(STEPPING, time, this.stepClock);
    this.stepClock = frame.clock;
    const halted = !this.walking();
    let roadMs = 0;
    let stoppedMs = 0;
    for (let step = 0; step < frame.steps && this.walking(); step++) {
      if (this.walk?.road.hitStop == null) {
        roadMs += STEP_MS;
      } else {
        stoppedMs += STEP_MS;
      }
      this.simulate();
    }
    const { frameMs } = frame;
    const zoneIndex = walk.run.zoneIndex;
    const clockFrame = { frameMs, halted, roadMs, stoppedMs, zoneIndex };
    this.zoneClocks = tickZoneClocks(clockFrame, this.zoneClocks);
    if (!this.walking()) {
      this.stepClock = holdStepClock(this.stepClock);
    }
    this.draw();
    emitDevState(this.game, this.world?.setup, this.zoneClocks, this.walk);
  }

  private walking(): boolean {
    const walk = this.walk;
    return (
      walk !== undefined &&
      walk.run.phase.kind === "walking" &&
      this.world?.menus.paused() === false &&
      this.world.menus.card() === undefined
    );
  }

  // One fixed step: the inputs due now, the pulls, then the walk.
  private simulate(): void {
    let walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const { input, moments, random, recorder } = world;
    for (const due of recorder.due(this.runTimeMs) ?? input.takePending()) {
      if (due.kind === "home") {
        this.headHome(walk);
        return;
      }
      walk =
        due.kind === "lane"
          ? steerWalk(gameData, LANE_COUNT, due.direction, walk)
          : this.treated(due.slot, walk);
      recorder.log({ ...due, timeMs: this.runTimeMs });
    }
    const pulls = stepPulls(gameData, roadGeometry(walk.run), STEP_MS / 1000, this.pulls, walk);
    this.pulls = pulls.pulls;
    moments.pulled(pulls);
    input.afterPulls(pulls.pulled);
    walk = pulls.walk;
    const moving = walk.road.hitStop === null;
    const step = stepWalk(gameData, roadGeometry(walk.run), random.rolls, STEP_MS / 1000, walk);
    this.runTimeMs += STEP_MS;
    const spots = step.spots.flatMap(({ kind }) => (isNeedSpot(gameData, kind) ? [kind] : []));
    const needs = stepNeeds(gameData, random.needs, STEP_MS / 1000, moving, spots, step.walk.run);
    this.walk = { ...step.walk, run: needs.run };
    moments.walked(step, packPoint(this.walk));
    moments.needs(needs, this.distanceBeforeZone + this.walk.run.zoneDistance);
    this.zoneEndPending ||= step.zoneEnded;
    this.cardQueue.push(...step.cards, ...needs.cards);
    this.holdForFiring();
    this.continueWalk();
  }

  // An owner who just fired you holds the walk while their moment plays, as a hit stop does:
  // the queued cards and the zone end wait for it.
  private holdForFiring(): void {
    const walk = this.walk;
    const fired = this.world?.moments.takeFired() ?? [];
    if (walk === undefined || walk.run.phase.kind === "ended") {
      return;
    }
    const hold = holdForFiring(
      firingSeconds(),
      fired,
      { cards: this.cardQueue, zoneEnded: this.zoneEndPending },
      walk.road.hitStop,
    );
    this.cardQueue = [...hold.queued.cards];
    this.zoneEndPending = hold.queued.zoneEnded;
    this.walk = { ...walk, road: { ...walk.road, hitStop: hold.stop } };
  }

  // A treat from the doghouses, for the dog in slot; an empty slot takes none.
  private treated(slot: number, walk: Walk): Walk {
    const dog = walk.run.pack[slot]?.dog;
    if (dog === undefined) {
      return walk;
    }
    const { change, state: run } = giveTreat(gameData, dog, walk.run);
    if (change !== null) {
      this.world?.moments.treatGiven(dog, change);
    }
    return { ...walk, run };
  }

  // Opens the next queued card, or ends the zone, or keeps walking.
  private continueWalk(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    if (walk.run.phase.kind === "ended") {
      this.endWalk();
      return;
    }
    this.world?.moments.previewAchievements(walk.run);
    const source = this.cardQueue.shift();
    if (source !== undefined) {
      this.showCard(source);
      return;
    }
    if (this.zoneEndPending) {
      this.zoneEndPending = false;
      this.endZone();
      return;
    }
    if (this.needsZonePlan) {
      this.needsZonePlan = false;
      this.walk = planned(this.world?.setup, walk);
      this.world?.banner.show(this.walk.run, this.reducedMotion());
    }
  }

  // Pays the zone's fees, saves a checkpoint, then offers the upgrades and the fork before
  // the next zone is planned.
  private endZone(): void {
    const walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const { fees, run } = finishZone(gameData, walk.run);
    world.moments.payOut(fees, walk.run);
    this.walk = { ...walk, run };
    if (run.phase.kind !== "ended") {
      this.distanceBeforeZone += zoneLength(gameData, walk.run);
      void checkpointRun(this, checkpointOf(gameData, run));
      this.needsZonePlan = true;
      this.cardQueue.push(
        { kind: "upgradeOffer", offered: offerUpgrades(gameData, world.random.cards, run) },
        offerFork(gameData, world.random.forks, run),
      );
    }
    this.continueWalk();
  }

  private showCard(source: CardSource): void {
    const walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const run = openCard(source, walk.run);
    const view = cardFor(gameData, run, source);
    this.walk = { ...walk, run };
    world.menus.holdForCard(view);
    world.input.dropPress();
    cardHintTriggers(gameData, source).forEach((trigger) => showHint(this, trigger));
    const replayed = world.recorder.cardChoice();
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    world.menus.showCard(view, (choice) => this.choose(view, choice));
  }

  private choose(view: CardView, choice: Choice): void {
    const walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const { moments } = world;
    const outcome = chooseOption(gameData, world.random.cards, walk.run, view, choice);
    world.recorder.log({ choice, kind: "card", timeMs: this.runTimeMs });
    const at = { timeMs: this.runTimeMs, zoneIndex: walk.run.zoneIndex };
    this.statusMarks = startStatuses(gameData, view, at, choice, this.statusMarks);
    this.walk = { ...walk, run: outcome.state };
    world.menus.closeCard();
    moments.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
    moments.sayQuips(outcome.quips);
    moments.afterOutcome(outcome);
    this.holdForFiring();
    this.continueWalk();
  }

  // What holds the walk still, for the HUD's top bar and for lane moves and treats.
  runPause(): RunPause {
    return {
      card: this.world?.menus.card() !== undefined,
      hitStop: this.walk?.road.hitStop != null,
      menu: this.world?.menus.menuState() ?? "closed",
    };
  }

  openPause(mode: PauseSceneData["mode"] = "menu"): void {
    this.world?.menus.openPause(mode);
  }

  closePause(): void {
    this.world?.menus.closePause();
  }

  // Logged at the run time of the step it comes before, which is where a replay applies it.
  private headHome(walk: Walk): void {
    this.world?.recorder.log({ kind: "home", timeMs: this.runTimeMs });
    this.walk = { ...walk, run: headHome(walk.run) };
    this.endWalk();
  }

  // Saves the walk and its input log, then shows the end screen, once a final firing or
  // payout has played.
  private endWalk(): void {
    const walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const delayMs = world.moments.takeEndDelayMs();
    if (delayMs > 0) {
      this.time.delayedCall(delayMs, () => this.endWalk());
      return;
    }
    this.walk = undefined;
    const sound = soundboardOf(this);
    sound.stopMusic();
    sound.setCardOpen(false);
    stopWakeLock();
    world.recorder.save();
    for (const key of [SCENE_KEYS.hud, SCENE_KEYS.card, SCENE_KEYS.pause]) {
      this.scene.stop(key);
    }
    const showEnd = () => this.scene.start(SCENE_KEYS.end);
    finishRun(this, runResultOf(gameData, walk.run), world.moments.banked()).then(
      showEnd,
      (error: unknown) => {
        console.error("The run could not be saved.", error);
        showEnd();
      },
    );
  }

  // While a card or the pause menu holds the walk, the road's sprites stand still.
  private draw(): void {
    const walk = this.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const zone = currentZone(gameData, walk.run);
    const halted = !this.walking();
    const still = this.reducedMotion();
    world.backdrop.draw(walk, zone, packPoint(walk).x, still);
    world.road.draw(walk, zone, this.distanceBeforeZone);
    const shadow = world.shadows.frame(colorFromHex(zone.roadShadowColor));
    world.items.draw(walk, halted, still, shadow);
    world.stop.draw(walk, halted, still, shadow);
    const statuses = this.statuses(walk.run);
    world.pack.draw(walk, {
      halted,
      itemPoint: (id) => world.items.point(id),
      pulls: this.pulls,
      shadow,
      statusOf: (dog) => shownStatus(statuses, this.runTimeMs, dog),
      still,
    });
    world.spots.draw(this.distanceBeforeZone + walk.run.zoneDistance);
    world.shadows.hideUnused();
  }
}

function planned(setup: RunSetup | undefined, walk: Walk): Walk {
  const spawns = randomStream(setup?.seed ?? 0, `spawns-${walk.run.zoneIndex}`);
  return planZone(gameData, roadGeometry(walk.run), spawns, walk);
}
