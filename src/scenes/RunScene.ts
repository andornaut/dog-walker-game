import { Scene } from "phaser";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { DogId } from "../data/types";
import {
  cheatActive,
  type Cheats,
  cheatsFrom,
  DEV_CHEATS_KEY,
  timeScaleOf,
  withCheats,
} from "../dev/devPanelModel";
import type { RunSetup } from "../dev/runSetup";
import { withSetupStart } from "../dev/setupRun";
import { startZoneClocks, tickZoneClocks, type ZoneClocks } from "../dev/zoneClock";
import { effectItems } from "../hud/effectIcons";
import { cardHintTriggers } from "../hud/hintTriggers";
import { homeQuestionNote } from "../hud/homeQuestion";
import { type RunPause, walkPaused } from "../hud/topBar";
import { type ExplainShown, type ExplainTarget } from "../hud/walkHud";
import { type ZoneCelebration, zoneCelebration } from "../hud/zoneCelebration";
import { isPhoneSideways, PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import { AmbientView } from "../road/phaser/ambientView";
import type { CardView, Choice } from "../rules/choices";
import { currentZone, currentZoneId, zoneAt } from "../rules/route";
import {
  type FixedStepLimits,
  frameSteps,
  holdStepClock,
  startStepClock,
  STEP_SECONDS,
  type StepClock,
} from "../runner/fixedStep";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseShownCard,
  headHomeSession,
  type RunStreams,
  runStreams,
  type Session,
  type SessionEvent,
  type SessionStep,
  startSession,
  stepSession,
} from "../runner/session";
import { startRoad, type Walk, zoneLength } from "../runner/walk";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { type Loadout, newRun, type RunState } from "../state/runState";
import { onWindowEvent } from "./overlay";
import { colorFromHex } from "./palette";
import type { PauseSceneData } from "./PauseScene";
import {
  checkpointRun,
  currentSettings,
  finishRun,
  isMuted,
  onSettingsChanged,
  profileSave,
  type Settings,
} from "./profileStore";
import { BackdropView } from "./run/backdropView";
import { HitBoxView } from "./run/hitBoxView";
import { blendWalk, leadWalk, stepAlpha } from "./run/interpolate";
import { ensureRoadPlaceholders, ItemViews } from "./run/itemViews";
import { MenuFlow, type MenuPause } from "./run/menuFlow";
import { PackView } from "./run/packView";
import { ZoneBanner, zoneBannerMs } from "./run/roadBanners";
import { RoadsideView } from "./run/roadsideView";
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

// What the HUD draws: the run, the dogs the open card affects, what a held press explains, the
// pack's centre across the screen, and how far through the zone.
export interface RunHudView {
  affected: readonly DogId[];
  explaining: ExplainTarget | undefined;
  packX: number;
  run: RunState;
  zoneFraction: number;
}

// Steps of 1/60 s. A frame catches up at most a second of steps (60), which covers a frame held
// up by garbage collection or a slow device; a longer stall drops the rest rather than jumping
// the walk ahead.
const STEP_MS = STEP_SECONDS * 1000;
const STEPPING: FixedStepLimits = { maxFrameMs: 1000, stepMs: STEP_MS };

// Before the walk's menus exist, nothing is open over it.
const NO_MENU_PAUSE: MenuPause = { card: false, menu: "closed", page: "shown" };

// Before the walk starts, the HUD shows nothing to explain.
const NOTHING_SHOWN: ExplainShown = { debuffs: [], dogs: [], effects: 0 };

// The zone celebration due once a zone's fee coins have landed, delayMs from its end.
interface Celebration {
  celebration: ZoneCelebration;
  delayMs: number;
}

// One run's views, input, menus and dev hooks, made as it starts.
interface RunWorld {
  ambient: AmbientView;
  backdrop: BackdropView;
  banner: ZoneBanner;
  hitBoxes: HitBoxView;
  input: RunInput;
  items: ItemViews;
  menus: MenuFlow;
  moments: RunMoments;
  pack: PackView;
  random: RunRandom;
  recorder: RunRecorder;
  road: RoadView;
  roadside: RoadsideView;
  setup: RunSetup;
  shadows: ShadowPool;
  streams: RunStreams;
}

// The walk: backdrop, road, walker, pack and everything spawned on the road. The session steps
// at a fixed rate and stops while walkPaused says so; the scene draws it, feeds it input and
// plays its events.
export class RunScene extends Scene {
  private readonly roadArt = new RoadArt(this);
  private session: Session | undefined;
  private settings: Settings | undefined;
  private stepClock: StepClock = startStepClock;
  // The walk one step before the session's, which a frame blends from; undefined draws the
  // session's walk as it is.
  private stepBefore: Walk | undefined;
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
    this.stepBefore = undefined;
    this.stepClock = startStepClock;
    this.world = undefined;
    this.zoneClocks = startZoneClocks(0);
  }

  // The views are made in draw order: the backdrop and its ambient movers, the road and its
  // roadside props, then the pack.
  private createWorld(
    run: Pick<RunWorld, "random" | "recorder" | "setup" | "streams">,
    picked: { loadout: Loadout; walkerSprite: string },
  ): RunWorld {
    const { random, recorder } = run;
    const backdrop = new BackdropView(this, random.scenery);
    const ambient = new AmbientView(this, random.ambient);
    const road = new RoadView(this, this.roadArt, LAYOUT.rasterView);
    const roadside = new RoadsideView(this);
    const pack = new PackView(this, picked.loadout.dogs, picked.walkerSprite);
    const still = () => this.reducedMotion();
    return {
      ...run,
      ambient,
      backdrop,
      banner: new ZoneBanner(this),
      hitBoxes: new HitBoxView(this),
      input: new RunInput(this, {
        explainShown: () => this.explainShown(),
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
        homeNote: () =>
          this.session === undefined ? [] : homeQuestionNote(gameData, this.session.walk.run),
        over: () => this.session === undefined || this.session.walk.run.phase.kind === "ended",
      }),
      moments: new RunMoments(this, { pack, quips: random.quips, still }),
      pack,
      road,
      roadside,
      shadows: new ShadowPool(this),
    };
  }

  // A hidden tab or a window out of focus pauses the walk under the pause menu, which stays
  // when the page comes back, so the walk resumes only on Resume.
  private listen(): void {
    const onBack = () => this.openPause();
    const onHidden = () => {
      this.world?.menus.setPageHidden(true);
      this.openPause();
      const walk = this.session?.walk;
      if (walk !== undefined && walk.run.phase.kind !== "ended") {
        void checkpointRun(this, checkpointOf(gameData, walk.run));
      }
    };
    const onVisible = () => this.world?.menus.setPageHidden(false);
    const onSideways = () => this.openPause();
    const onBlur = () => {
      this.world?.input.dropPress();
      this.world?.menus.setPageBlurred(true);
      this.openPause();
    };
    const onFocus = () => this.world?.menus.setPageBlurred(false);
    onWindowEvent(this, "blur", onBlur);
    onWindowEvent(this, "focus", onFocus);
    onWindowEvent(this, PHONE_EVENTS.appHidden, onHidden);
    onWindowEvent(this, PHONE_EVENTS.appVisible, onVisible);
    onWindowEvent(this, PHONE_EVENTS.backPressed, onBack);
    onWindowEvent(this, PHONE_EVENTS.turnedSideways, onSideways);
    this.events.once("shutdown", () => stopWakeLock());
  }

  hudView(): RunHudView | undefined {
    const session = this.session;
    if (session === undefined) {
      return undefined;
    }
    const { run } = session.walk;
    return {
      affected: this.world?.menus.card()?.affected ?? [],
      explaining: this.world?.input.explanation(),
      packX: packPoint(session.walk).x,
      run,
      zoneFraction: run.zoneDistance / zoneLength(gameData),
    };
  }

  // What the HUD shows that a held press can explain: the walk's effects, its debuffs in the
  // order they began, and each card's dog.
  private explainShown(): ExplainShown {
    const run = this.session?.walk.run;
    if (run === undefined) {
      return NOTHING_SHOWN;
    }
    return {
      debuffs: run.debuffs.map(({ debuff }) => debuff),
      dogs: LAYOUT.dogSlots.map((_, i) => run.pack[i]?.dog),
      effects: effectItems(gameData, run).length,
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
    this.world?.input.tick(this.game.loop.time);
    const timeScale = timeScaleOf(this.applyCheats());
    this.time.timeScale = timeScale;
    this.tweens.timeScale = timeScale;
    const frame = frameSteps({ ...STEPPING, timeScale }, time, this.stepClock);
    this.stepClock = frame.clock;
    const halted = !this.walking();
    let roadMs = 0;
    let stoppedMs = 0;
    for (let step = 0; step < frame.steps && this.walking(); step++) {
      this.stepBefore = this.session?.walk;
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
      // A held walk draws as it stands, and goes on from there without a jump.
      this.stepBefore = this.session?.walk;
    }
    this.draw();
    emitDevState(this.game, this.world?.setup, this.zoneClocks, this.session?.walk);
  }

  // The dev panel's cheats, from the registry, with the run set to match them.
  private applyCheats(): Cheats {
    const cheats = cheatsFrom(this.registry.get(DEV_CHEATS_KEY));
    const session = this.session;
    if (session !== undefined) {
      const run = withCheats(cheats, session.walk.run);
      if (run !== session.walk.run) {
        this.session = { ...session, walk: { ...session.walk, run } };
      }
    }
    return cheats;
  }

  private walking(): boolean {
    const session = this.session;
    return (
      session !== undefined &&
      session.card === null &&
      session.walk.run.phase.kind === "walking" &&
      this.world !== undefined &&
      !walkPaused(this.runPause())
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
    const before = this.session?.walk.run;
    this.session = step.session;
    if (before !== undefined) {
      this.world?.moments.debuffsChanged(before, step.session.walk.run);
    }
    let opened: CardView | undefined;
    let celebration: Celebration | undefined;
    for (const event of step.events) {
      if (event.kind === "cardOpened") {
        opened = event.view;
      } else if (event.kind === "zoneEnded") {
        celebration = this.endZone(event);
      } else {
        this.react(event);
      }
    }
    const { run } = step.session.walk;
    if (run.phase.kind === "ended") {
      // A walker the last zone unlocks joins before the end screen.
      if (celebration === undefined) {
        this.endWalk();
      } else {
        this.celebrate(celebration, () => this.endWalk());
      }
      return;
    }
    this.world?.moments.previewAchievements(run);
    if (opened === undefined) {
      return;
    }
    const card = opened;
    if (celebration === undefined) {
      this.showCard(card, run);
    } else {
      this.celebrate(celebration, () => this.showCard(card, run));
    }
  }

  // Pays out the zone's fees and saves the walk between zones. Unless replayed, returns the
  // celebration that plays once the coins land: after the last zone, only a New walker's.
  private endZone(event: Extract<SessionEvent, { kind: "zoneEnded" }>): Celebration | undefined {
    const world = this.world;
    if (world === undefined) {
      return undefined;
    }
    const { after, before } = event;
    const payout = world.moments.payOut(event.fees, before);
    const ended = after.phase.kind === "ended";
    if (!ended) {
      void checkpointRun(this, checkpointOf(gameData, after));
    }
    if (world.recorder.replaying()) {
      return undefined;
    }
    const celebration = zoneCelebration(gameData, profileSave(this).owned.walkers, {
      changes: payout.changes,
      finished: before.route.slice(0, before.zoneIndex + 1),
      walker: before.walker,
      zone: currentZone(gameData, before).name,
    });
    return ended && celebration.kind !== "newWalker"
      ? undefined
      : { celebration, delayMs: payout.ms };
  }

  // The celebration holds the walk while the fee coins land, then plays; next follows it.
  private celebrate({ celebration, delayMs }: Celebration, next: () => void): void {
    const menus = this.world?.menus;
    if (menus === undefined) {
      return;
    }
    menus.holdForCelebration();
    this.time.delayedCall(delayMs, () => {
      menus.showCelebration({
        celebration,
        onDone: next,
        openPause: () => this.openPause(),
        resume: SCENE_KEYS.run,
      });
    });
  }

  // An event's sounds, bursts, hints and labels, and the input log.
  private react(event: Exclude<SessionEvent, { kind: "cardOpened" | "zoneEnded" }>): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    const { moments, recorder } = world;
    switch (event.kind) {
      case "chosen": {
        const { choice, outcome, timeMs } = event;
        recorder.log({ choice, kind: "card", timeMs });
        world.menus.closeCard();
        moments.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
        moments.sayQuips(outcome.quips);
        moments.afterOutcome(outcome);
        return;
      }
      case "input":
        recorder.log({ ...event.input, timeMs: event.timeMs });
        return;
      case "drifted":
        return;
      case "pulled":
        moments.pulled(event.step);
        return;
      case "walked":
        moments.walked(event.step, packPoint(event.step.walk));
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
    cardHintTriggers(view.source).forEach((trigger) => showHint(this, trigger));
    const replayed = world.recorder.cardChoice();
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    const zone = currentZoneId(gameData, run);
    world.menus.showCard(zone, view, (choice) => this.choose(view, choice));
  }

  // A choice on a card that is no longer open picks nothing.
  private choose(view: CardView, choice: Choice): void {
    const session = this.session;
    const world = this.world;
    if (session === undefined || world === undefined) {
      return;
    }
    this.apply(chooseShownCard(gameData, world.streams, screenRoadGeometry, view, choice, session));
  }

  // What holds the walk still, for the walk's steps, the HUD's top bar, and lane moves.
  runPause(): RunPause {
    const hitStop = this.session?.walk.road.hitStop != null;
    const hold = this.world?.input.explanation() !== undefined;
    return { ...(this.world?.menus.pause() ?? NO_MENU_PAUSE), hitStop, hold };
  }

  openPause(mode: PauseSceneData["mode"] = "menu"): void {
    this.world?.menus.openPause(mode);
  }

  // The walk bar's Help and Settings buttons.
  openFromBar(open: "help" | "settings"): void {
    this.world?.menus.openFromBar(open);
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
    stopWakeLock();
    world.recorder.save();
    const overlays = [SCENE_KEYS.card, SCENE_KEYS.zoneCelebration, SCENE_KEYS.pause];
    for (const key of [SCENE_KEYS.hud, ...overlays]) {
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
    const { distanceBeforeZone, pulls } = session;
    const before = this.stepBefore ?? session.walk;
    const halted = !this.walking();
    const alpha = stepAlpha(this.stepClock.bankedMs, STEP_MS);
    const laneCount = screenRoadGeometry(session.walk.run).laneCount;
    const lead = halted
      ? session.walk
      : leadWalk(gameData, laneCount, alpha * STEP_SECONDS, world.input.queued(), session.walk);
    const walk = blendWalk(alpha, before, lead);
    const zone = currentZone(gameData, walk.run);
    const still = this.reducedMotion();
    world.backdrop.draw(zone);
    const zoneId = currentZoneId(gameData, walk.run);
    world.ambient.draw(gameData.ambient[zoneId], zoneId, {
      halted,
      now: (session.timeMs + (halted ? 0 : alpha * STEP_MS)) / 1000,
      still,
      travelled: distanceBeforeZone + walk.run.zoneDistance,
    });
    world.road.draw(walk, zone, distanceBeforeZone);
    const { route, zoneIndex } = walk.run;
    world.roadside.draw(
      zone.art,
      zoneIndex === 0 ? null : zoneAt(gameData, route, zoneIndex - 1).art,
      distanceBeforeZone,
      distanceBeforeZone + walk.run.zoneDistance,
    );
    const shadow = world.shadows.frame(colorFromHex(zone.roadShadowColor));
    world.items.draw(walk, halted, still, shadow);
    world.pack.draw(walk, {
      halted,
      itemPoint: (id) => world.items.point(id),
      pulls,
      shadow,
      still,
    });
    const cheats = cheatsFrom(this.registry.get(DEV_CHEATS_KEY));
    world.hitBoxes.draw(walk, cheatActive(cheats, "hitBoxes"));
    world.shadows.hideUnused();
  }
}
