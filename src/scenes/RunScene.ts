import { Scene } from "phaser";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { DogId } from "../data/types";
import type { RunSetup } from "../dev/runSetup";
import { withSetupStart } from "../dev/setupRun";
import { startZoneClocks, tickZoneClocks, type ZoneClocks } from "../dev/zoneClock";
import { cardHintTriggers } from "../hud/hintTriggers";
import type { RunPause } from "../hud/topBar";
import { isPhoneSideways, PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import { type CardView, type Choice, quirkActorsOf } from "../rules/choices";
import { currentZone, currentZoneId } from "../rules/route";
import { read } from "../rules/units";
import {
  type FixedStepLimits,
  frameSteps,
  holdStepClock,
  startStepClock,
  type StepClock,
} from "../runner/fixedStep";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseCard,
  headHomeSession,
  type RunStreams,
  runStreams,
  type Session,
  type SessionEvent,
  type SessionStep,
  startSession,
  STEP_SECONDS,
  stepSession,
} from "../runner/session";
import { activeStatuses, shownStatus, type StatusMark } from "../runner/statuses";
import { startRoad, zoneLength } from "../runner/walk";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { type Loadout, newRun, type RunState } from "../state/runState";
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
import { LAYOUT, packPoint } from "./run/stage";
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
const STEP_MS = STEP_SECONDS * 1000;
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
  streams: RunStreams;
}

// The walk: backdrop, road, walker, pack and everything spawned on the road. The session steps
// at a fixed rate and stops while a card or the pause menu is up; the scene draws it, feeds it
// input and plays its events.
export class RunScene extends Scene {
  private readonly roadArt = new RoadArt(this);
  private session: Session | undefined;
  private settings: Settings | undefined;
  private stepClock: StepClock = startStepClock;
  private world: RunWorld | undefined;
  private zoneClocks: ZoneClocks = startZoneClocks(0);

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(): void {
    this.resetState();
    ensureRoadPlaceholders(this);

    const recorder = new RunRecorder();
    const setup = recorder.setup();
    const picked = pickedLoadout(this, setup);
    const run = withSetupStart(setup, newRun(gameData, picked.dogSlots, picked.loadout));
    // The log names the pack, gear and walker walked and a later start's route, so its replay
    // does not read the saved loadout. Each fork's path is a card choice in its events.
    recorder.start({
      ...setup,
      gear: picked.loadout.gear,
      pack: picked.loadout.dogs,
      walker: run.walker,
      ...(setup.zone === 1 ? {} : { route: run.route }),
    });
    const streams = runStreams(setup.seed);
    const road = startRoad(LANE_COUNT, setup.speed);
    this.session = startSession(gameData, streams, screenRoadGeometry, { road, run });

    this.settings = currentSettings(this);
    const sound = soundboardOf(this);
    this.applyVolumes();
    onSettingsChanged(this, (settings) => {
      this.settings = settings;
      this.applyVolumes();
    });

    this.world = this.createWorld(
      { random: runRandom(setup.seed), recorder, setup, streams },
      picked,
    );
    this.world.input.listen();
    this.listen();

    this.scene.launch(SCENE_KEYS.hud);
    sound.setPaused(false);
    sound.setCardOpen(false);
    sound.startMusic();
    startWakeLock();
    this.world.banner.show(this.session.walk.run, this.reducedMotion());
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
    this.session = undefined;
    this.stepClock = startStepClock;
    this.world = undefined;
    this.zoneClocks = startZoneClocks(0);
  }

  // The views are made in draw order: the backdrop, the road, then the pack.
  private createWorld(
    run: Pick<RunWorld, "random" | "recorder" | "setup" | "streams">,
    picked: { loadout: Loadout; walkerSprite: string },
  ): RunWorld {
    const { random, recorder } = run;
    const backdrop = new BackdropView(this, random.scenery);
    const road = new RoadView(this, this.roadArt, LAYOUT.rasterView);
    const pack = new PackView(this, picked.loadout.dogs, picked.walkerSprite);
    const spots = new AccidentSpots(this);
    const still = () => this.reducedMotion();
    return {
      ...run,
      backdrop,
      banner: new ZoneBanner(this),
      input: new RunInput(this, {
        openPause: () => this.openPause(),
        replaying: () => recorder.replaying(),
        runPause: () => this.runPause(),
        walk: () => this.session?.walk,
      }),
      items: new ItemViews(this, (event) => showHint(this, event)),
      menus: new MenuFlow(this, {
        dropPress: () => this.world?.input.dropPress(),
        headHome: () => {
          if (this.session !== undefined) {
            this.apply(headHomeSession(this.session));
          }
        },
        over: () => this.session === undefined || this.session.walk.run.phase.kind === "ended",
      }),
      moments: new RunMoments(this, { pack, quips: random.quips, spots, still }),
      pack,
      road,
      shadows: new ShadowPool(this),
      spots,
      stop: new ForcedStopView(this),
    };
  }

  private listen(): void {
    const onBack = () => this.openPause();
    const onHidden = () => {
      this.openPause();
      const walk = this.session?.walk;
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
    const session = this.session;
    if (session === undefined) {
      return undefined;
    }
    const { run } = session.walk;
    return {
      affected: this.world?.menus.card()?.affected ?? [],
      run,
      statuses: statusesOf(session),
      zoneFraction: run.zoneDistance / zoneLength(gameData, run),
    };
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
    const session = this.session;
    if (session === undefined) {
      return;
    }
    const frame = frameSteps(STEPPING, time, this.stepClock);
    this.stepClock = frame.clock;
    const halted = !this.walking();
    let roadMs = 0;
    let stoppedMs = 0;
    for (let step = 0; step < frame.steps && this.walking(); step++) {
      if (this.session?.walk.road.hitStop == null) {
        roadMs += STEP_MS;
      } else {
        stoppedMs += STEP_MS;
      }
      this.simulate();
    }
    const { frameMs } = frame;
    const zoneIndex = session.walk.run.zoneIndex;
    const clockFrame = { frameMs, halted, roadMs, stoppedMs, zoneIndex };
    this.zoneClocks = tickZoneClocks(clockFrame, this.zoneClocks);
    if (!this.walking()) {
      this.stepClock = holdStepClock(this.stepClock);
    }
    this.draw();
    emitDevState(this.game, this.world?.setup, this.zoneClocks, this.session?.walk);
  }

  private walking(): boolean {
    const session = this.session;
    return (
      session !== undefined &&
      session.card === null &&
      session.walk.run.phase.kind === "walking" &&
      this.world?.menus.paused() === false
    );
  }

  // One fixed step with the inputs due now: replayed, or queued by the player.
  private simulate(): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    const inputs = world.recorder.due(session.timeMs) ?? world.input.takePending();
    this.apply(
      stepSession(gameData, world.streams, screenRoadGeometry, STEP_SECONDS, inputs, session),
    );
  }

  // Takes the session's next state and plays its events, then ends the walk, or previews the
  // badges earned so far and shows the card it opened.
  private apply(step: SessionStep): void {
    this.session = step.session;
    let opened: CardView | undefined;
    for (const event of step.events) {
      if (event.kind === "cardOpened") {
        opened = event.view;
      } else {
        this.react(event);
      }
    }
    const { run } = step.session.walk;
    if (run.phase.kind === "ended") {
      this.endWalk();
      return;
    }
    this.world?.moments.previewAchievements(run);
    if (opened !== undefined) {
      this.showCard(opened, run);
    }
  }

  // An event's sounds, bursts, hints and labels, and the input log.
  private react(event: Exclude<SessionEvent, { kind: "cardOpened" }>): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    const { input, moments, recorder } = world;
    switch (event.kind) {
      case "chosen": {
        const { choice, outcome, timeMs, view } = event;
        recorder.log({ choice, kind: "card", timeMs });
        moments.quirkActed(quirkActorsOf(gameData, view, choice));
        world.menus.closeCard();
        moments.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
        moments.sayQuips(outcome.quips);
        moments.afterOutcome(outcome);
        return;
      }
      case "input":
        recorder.log({ ...event.input, timeMs: event.timeMs });
        return;
      case "needs":
        moments.needs(event.step, event.distance);
        return;
      case "pulled":
        moments.pulled(event.step);
        input.afterPulls(event.step.pulled);
        return;
      case "treat":
        moments.treatGiven(event.dog, event.change);
        return;
      case "walked":
        moments.walked(event.step, packPoint(event.step.walk));
        return;
      case "zoneEnded":
        // A checkpoint saves the walk between zones.
        moments.payOut(event.fees, event.before);
        if (event.after.phase.kind !== "ended") {
          void checkpointRun(this, checkpointOf(gameData, event.after));
        }
        return;
      case "zonePlanned":
        if (this.session !== undefined) {
          world.banner.show(this.session.walk.run, this.reducedMotion());
        }
    }
  }

  private showCard(view: CardView, run: RunState): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    world.menus.holdForCard(view);
    world.input.dropPress();
    cardHintTriggers(gameData, view.source).forEach((trigger) => showHint(this, trigger));
    const replayed = world.recorder.cardChoice();
    if (replayed !== undefined) {
      this.choose(replayed);
      return;
    }
    const zone = currentZoneId(gameData, run);
    world.menus.showCard(zone, view, (choice) => this.choose(choice));
  }

  private choose(choice: Choice): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    this.apply(chooseCard(gameData, world.streams, screenRoadGeometry, choice, session));
  }

  // What holds the walk still, for the HUD's top bar and for lane moves and treats.
  runPause(): RunPause {
    return {
      card: this.world?.menus.card() !== undefined,
      hitStop: this.session?.walk.road.hitStop != null,
      menu: this.world?.menus.menuState() ?? "closed",
    };
  }

  openPause(mode: PauseSceneData["mode"] = "menu"): void {
    this.world?.menus.openPause(mode);
  }

  closePause(): void {
    this.world?.menus.closePause();
  }

  // Saves the walk and its input log, then shows the end screen, once a final firing or
  // payout has played.
  private endWalk(): void {
    const walk = this.session?.walk;
    const world = this.world;
    if (walk === undefined || world === undefined) {
      return;
    }
    const delayMs = world.moments.takeEndDelayMs();
    if (delayMs > 0) {
      this.time.delayedCall(delayMs, () => this.endWalk());
      return;
    }
    this.session = undefined;
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
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    const { distanceBeforeZone, pulls, timeMs, walk } = session;
    const zone = currentZone(gameData, walk.run);
    const halted = !this.walking();
    const still = this.reducedMotion();
    world.backdrop.draw(walk, zone, packPoint(walk).x, still);
    world.road.draw(walk, zone, distanceBeforeZone);
    const shadow = world.shadows.frame(colorFromHex(zone.roadShadowColor));
    world.items.draw(walk, halted, still, shadow);
    world.stop.draw(walk, halted, still, shadow);
    const statuses = statusesOf(session);
    world.pack.draw(walk, {
      halted,
      itemPoint: (id) => world.items.point(id),
      pulls,
      shadow,
      statusOf: (dog) => shownStatus(statuses, timeMs, dog),
      still,
    });
    world.spots.draw(distanceBeforeZone + walk.run.zoneDistance);
    world.shadows.hideUnused();
  }
}

function statusesOf(session: Session): StatusMark[] {
  const seconds = read(gameData.tuning, "seconds", "statusVisualSeconds");
  return activeStatuses(seconds, session.walk.run, session.timeMs, session.statusMarks);
}
