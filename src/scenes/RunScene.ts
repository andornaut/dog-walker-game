import {
  type FixedStepLimits,
  frameSteps,
  holdStepClock,
  startStepClock,
  STEP_SECONDS,
  type StepClock,
} from "@andornaut/game-kit/clock/fixedStep";
import { Scene } from "phaser";

import { musicKey } from "../audio/music";
import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { DogId } from "../data/types";
import {
  type Cheats,
  cheatsFrom,
  DEV_CHEATS_KEY,
  timeScaleOf,
  withCheats,
} from "../dev/devPanelModel";
import type { InputEvent } from "../dev/inputLog";
import type { RunSetup } from "../dev/runSetup";
import { withSetupStart } from "../dev/setupRun";
import { startZoneClocks, tickZoneClocks, type ZoneClocks } from "../dev/zoneClock";
import { effectItems } from "../hud/effectIcons";
import { cardHintTriggers, startHintTriggers } from "../hud/hintTriggers";
import { homeQuestionNote, pauseNote } from "../hud/homeQuestion";
import { NOTHING_PAUSED, type RunPause, walkBackAction, walkPaused } from "../hud/topBar";
import { type ExplainShown } from "../hud/walkHud";
import {
  newWalkerCelebrations,
  playInTurn,
  type ZoneCelebration,
  zoneCelebration,
} from "../hud/zoneCelebration";
import { isPhoneSideways, PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import { type CardView, type Choice, outcomeChanges } from "../rules/choices";
import { currentZone, currentZoneId, previousZone, previousZoneId } from "../rules/route";
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
import { startRoad, type Walk } from "../runner/walk";
import { dogsFinishedWith } from "../save/checkpoint";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { type Loadout, newRun, type RunState } from "../state/runState";
import { colourFromHex, PALETTE } from "../ui/phaser/palette";
import type { HudSceneData } from "./HudScene";
import type { HudRun, RunHudView } from "./hudWalk";
import { onWindowEvent } from "./overlay";
import type { PauseSceneData } from "./PauseScene";
import {
  applySound,
  checkpointRun,
  currentSettings,
  finishRun,
  onSettingsChanged,
  profileSave,
  type Settings,
  walkerSpriteKey,
} from "./profileStore";
import { AmbientView } from "./run/ambientView";
import { BackdropView } from "./run/backdropView";
import { DistractionView } from "./run/distractionView";
import { HitBoxView } from "./run/hitBoxView";
import { blendWalk, leadWalk, stepAlpha } from "./run/interpolate";
import { ensureRoadPlaceholders, ItemViews } from "./run/itemViews";
import { LightsView } from "./run/lightsView";
import { MenuFlow } from "./run/menuFlow";
import { PackView } from "./run/packView";
import { ZoneBanner, zoneBannerMs } from "./run/roadBanners";
import { RoadsideView } from "./run/roadsideView";
import { RoadArt, RoadView } from "./run/roadView";
import { RunInput } from "./run/runInput";
import { RunMoments, showHint } from "./run/runMoments";
import { emitDevState, RunRecorder } from "./run/runRecorder";
import { type RunRandom, runRandom } from "./run/runStart";
import { ShadowPool } from "./run/shadowPool";
import { LAYOUT, overPack, packPoint } from "./run/stage";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";

// How the walk starts, from runSceneData: its setup, the loadout and dog slots it walks with, and
// the inputs that drive it when it replays a log.
export interface RunSceneData {
  dogSlots: number;
  loadout: Loadout;
  replay: readonly InputEvent[] | undefined;
  setup: RunSetup;
}

// Steps of 1/60 s. A frame catches up at most a second of steps (60), which covers a frame held
// up by garbage collection or a slow device; a longer stall drops the rest rather than jumping
// the walk ahead.
const STEP_MS = STEP_SECONDS * 1000;
const STEPPING: FixedStepLimits = { maxFrameMs: 1000, stepMs: STEP_MS };

// Before the walk starts, the HUD shows nothing to explain.
const NOTHING_SHOWN: ExplainShown = { debuffs: [], dogs: [], effects: [] };

// The celebrations due, one after another, once a zone's fee coins have landed, delayMs from its
// end.
interface Celebration {
  celebrations: readonly ZoneCelebration[];
  delayMs: number;
}

// One run's views, input, menus and dev hooks, made as it starts.
interface RunWorld {
  ambient: AmbientView;
  backdrop: BackdropView;
  banner: ZoneBanner;
  distractions: DistractionView;
  hitBoxes: HitBoxView;
  input: RunInput;
  items: ItemViews;
  lights: LightsView;
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
export class RunScene extends Scene implements HudRun {
  // The ambient movers' clock: the walk's simulated time less its firings' holds, in which
  // they stand still.
  private ambientMs = 0;
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

  create(data: RunSceneData): void {
    this.resetState();
    ensureRoadPlaceholders(this);
    // Ink under the walk, where a bump's nudge moves the road off the canvas's edge rows and the
    // canvas's plum clear colour would show.
    this.cameras.main.setBackgroundColor(PALETTE.ink);

    const { setup } = data;
    const recorder = new RunRecorder(data.replay);
    const run = withSetupStart(gameData, setup, newRun(gameData, data.dogSlots, data.loadout));
    // The log names the pack, gear and walker walked and a later start's route, so its replay
    // does not read the saved loadout. Each fork's path is a card choice in its events.
    recorder.start({
      ...setup,
      gear: data.loadout.gear,
      pack: data.loadout.dogs,
      walker: run.walker,
      ...(setup.zone === 1 ? {} : { route: run.route }),
    });
    const streams = runStreams(setup.seed);
    const road = startRoad(LANE_COUNT, setup.speed);
    this.session = startSession(gameData, streams, screenRoadGeometry, { road, run });

    this.settings = currentSettings(this);
    const sound = soundboardOf(this);
    applySound(this, this.settings);
    // Kept for reduced motion: setSettings applies each change's volumes and mute itself.
    onSettingsChanged(this, (settings) => {
      this.settings = settings;
    });

    this.world = this.createWorld(
      { random: runRandom(setup.seed), recorder, setup, streams },
      data,
    );
    this.world.input.listen();
    this.listen();

    const hud: HudSceneData = { run: this };
    this.scene.launch(SCENE_KEYS.hud, hud);
    sound.setPaused(false);
    startWakeLock();
    this.startZone(this.session.walk.run);
    // The HUD this launches hears the walk's start a frame later.
    const { moments } = this.world;
    const started = this.session.walk.run;
    this.time.delayedCall(0, () => moments.walkStarted(started));
    // The first hints wait for the zone banner to leave: how to steer, the lead dog's
    // pack-size bonus, then heading home.
    this.time.delayedCall(zoneBannerMs(this.reducedMotion()), () => {
      if (this.sys.game.device.input.touch) {
        showHint(this, { kind: "drag" });
      }
      startHintTriggers(gameData.tuning, run).forEach((trigger) => showHint(this, trigger));
      showHint(this, { kind: "homeButton" });
    });
    this.draw();
    // A phone already on its side, as when a walk starts from the page's URL, gets no
    // turned-sideways event, so the walk opens paused under the turn-upright notice.
    if (isPhoneSideways()) {
      this.openPause();
    }
  }

  private resetState(): void {
    this.ambientMs = 0;
    this.session = undefined;
    this.stepBefore = undefined;
    this.stepClock = startStepClock;
    this.world = undefined;
    this.zoneClocks = startZoneClocks(0);
  }

  // The views are made in draw order: the backdrop and its ambient movers, the road and its
  // roadside props, the distraction movers, then the pack.
  private createWorld(
    run: Pick<RunWorld, "random" | "recorder" | "setup" | "streams">,
    picked: Pick<RunSceneData, "loadout">,
  ): RunWorld {
    const { random, recorder } = run;
    const backdrop = new BackdropView(this);
    const ambient = new AmbientView(this, random.ambient);
    const road = new RoadView(this, this.roadArt, LAYOUT.rasterView);
    const roadside = new RoadsideView(this);
    const lights = new LightsView(this);
    const distractions = new DistractionView(this, random.distractions);
    const pack = new PackView(
      this,
      picked.loadout.dogs,
      walkerSpriteKey(this, picked.loadout.walker),
    );
    const items = new ItemViews(this, (event) => showHint(this, event));
    const still = () => this.reducedMotion();
    return {
      ...run,
      ambient,
      backdrop,
      banner: new ZoneBanner(this),
      distractions,
      hitBoxes: new HitBoxView(this),
      input: new RunInput(this, {
        explainShown: () => this.explainShown(),
        replaying: () => recorder.replaying(),
        runPause: () => this.runPause(),
        walk: () => this.session?.walk,
      }),
      items,
      lights,
      menus: new MenuFlow(this, {
        dropPress: () => this.world?.input.dropPress(),
        headHome: () => this.headHome(),
        homeNote: () =>
          this.session === undefined ? [] : homeQuestionNote(gameData, this.session.walk.run),
        over: () => this.session === undefined || this.session.walk.run.phase.kind === "ended",
        pauseNote: () =>
          this.session === undefined ? "" : pauseNote(gameData, this.session.walk.run),
      }),
      moments: new RunMoments(this, { items, pack, quips: random.quips, still }),
      pack,
      road,
      roadside,
      shadows: new ShadowPool(this),
    };
  }

  // A hidden tab or a window out of focus pauses the walk under the pause menu, which stays
  // when the page comes back, so the walk resumes only on Resume.
  private listen(): void {
    // The run scene hears back before any overlay launched over it, so it reads the overlays as
    // they were when back was pressed; help and the settings close themselves.
    const onBack = () => {
      const over = this.session === undefined || this.session.walk.run.phase.kind === "ended";
      const action = walkBackAction(over, this.runPause());
      switch (action) {
        case "closeExplanation":
          this.world?.input.dropPress();
          return;
        case "menu":
          this.openPause();
          return;
        case "none":
          return;
        case "resume":
          this.closePause();
          return;
        default:
          action satisfies never;
      }
    };
    const onHidden = () => {
      this.world?.menus.setPageHidden(true);
      this.openPause();
      const walk = this.session?.walk;
      if (
        walk !== undefined &&
        walk.run.phase.kind !== "ended" &&
        this.world?.recorder.replaying() === false
      ) {
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
    };
  }

  // What the HUD shows that a press can explain: the kinds of the walk's effects, its debuffs in the
  // order they began, and each card's dog.
  private explainShown(): ExplainShown {
    const run = this.session?.walk.run;
    if (run === undefined) {
      return NOTHING_SHOWN;
    }
    return {
      debuffs: run.debuffs.map(({ debuff }) => debuff),
      dogs: LAYOUT.dogSlots.map((_, i) => run.pack[i]?.dog),
      effects: effectItems(gameData, run).map((item) => item.kind),
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
    this.world?.menus.coverOverlay(this.world.input.explanation() !== undefined);
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
      const stop = this.session?.walk.road.hitStop;
      if (stop == null) {
        roadMs += STEP_MS;
      } else {
        stoppedMs += STEP_MS;
      }
      if (stop?.firing !== true) {
        this.ambientMs += STEP_MS;
      }
      this.simulate();
    }
    this.world?.pack.holdTrots(walkPaused(this.runPause()));
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

  // Ends the walk with what the finished zones earned, as the Home answer or a replayed one does.
  private headHome(): void {
    if (this.session !== undefined) {
      this.apply(headHomeSession(this.session));
    }
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
      if (run.phase.reason === "wentHome") {
        this.world?.moments.headedHome(run);
      }
      // Each walker a finished walk unlocks joins before the end screen.
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
      this.showCard(card);
    } else {
      this.celebrate(celebration, () => this.showCard(card));
    }
  }

  // Pays out the zone's fees. Unless replayed, saves the walk between zones and returns the
  // celebrations that play once the coins land: Neighbourhood done between zones, and after the
  // last zone a New walker for each walker the walk unlocks (newWalkerCelebrations).
  private endZone(event: Extract<SessionEvent, { kind: "zoneEnded" }>): Celebration | undefined {
    const world = this.world;
    if (world === undefined) {
      return undefined;
    }
    const { after, before } = event;
    const payout = world.moments.payOut(event.fees, before);
    if (world.recorder.replaying()) {
      return undefined;
    }
    if (after.phase.kind === "ended") {
      const finishedWith = dogsFinishedWith(runResultOf(gameData, after));
      const owned = profileSave(this).owned.walkers;
      const celebrations = newWalkerCelebrations(gameData, owned, finishedWith);
      return celebrations.length === 0 ? undefined : { celebrations, delayMs: payout.ms };
    }
    void checkpointRun(this, checkpointOf(gameData, after));
    const celebration = zoneCelebration({
      changes: payout.changes,
      walker: before.walker,
      zone: currentZone(gameData, before).name,
    });
    return { celebrations: [celebration], delayMs: payout.ms };
  }

  // The celebrations hold the walk while the fee coins land, then play one after another, each
  // on its button (playInTurn); next follows the last.
  private celebrate({ celebrations, delayMs }: Celebration, next: () => void): void {
    const menus = this.world?.menus;
    if (menus === undefined) {
      return;
    }
    const show = (celebration: ZoneCelebration, done: () => void) => {
      menus.holdForCelebration();
      menus.showCelebration({ celebration, onDone: done, openPause: () => this.openPause() });
    };
    menus.holdForCelebration();
    this.time.delayedCall(delayMs, () => playInTurn(show, next, celebrations));
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
        const over = overPack(packPoint(this.session?.walk));
        moments.addChanges(over, outcomeChanges(outcome));
        moments.chosen(outcome);
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
          this.startZone(this.session.walk.run);
        }
    }
  }

  // A zone starts with its banner and its own music loop, which plays until the next zone's
  // banner: through the celebration and the fork.
  private startZone(run: RunState): void {
    this.world?.banner.show(run, this.reducedMotion());
    soundboardOf(this).playMusic(musicKey(currentZone(gameData, run)));
  }

  private showCard(view: CardView): void {
    const world = this.world;
    if (world === undefined) {
      return;
    }
    world.menus.holdForCard(view);
    world.input.dropPress();
    cardHintTriggers(view.source).forEach((trigger) => showHint(this, trigger));
    const replayed = world.recorder.cardChoice();
    if (replayed === "home") {
      this.headHome();
      return;
    }
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    world.menus.showCard(view, (choice) => this.choose(view, choice));
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
    return { ...(this.world?.menus.pause() ?? NOTHING_PAUSED), hitStop, hold };
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

  // The walk bar's Settings button over the settings.
  closeSettings(): void {
    this.world?.menus.closeSettings();
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
    // A replay banks nothing, so the save keeps the walk it plays again and has no end to show.
    if (world.recorder.replaying()) {
      this.scene.start(SCENE_KEYS.start);
      return;
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

  // While a card or the pause menu holds the walk, or a firing holds it in its stop, the road's
  // sprites, the pack, the ambient movers and the distraction movers stand still.
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
    const lead = halted
      ? session.walk
      : leadWalk(gameData, LANE_COUNT, alpha * STEP_SECONDS, world.input.queued(), session.walk);
    const walk = blendWalk(alpha, before, lead);
    const zone = currentZone(gameData, walk.run);
    const still = this.reducedMotion();
    const held = halted || session.walk.road.hitStop?.firing === true;
    world.backdrop.draw(zone);
    const zoneId = currentZoneId(gameData, walk.run);
    const ambientMs = this.ambientMs + (held ? 0 : alpha * STEP_MS);
    world.ambient.draw(gameData.ambient[zoneId], zoneId, {
      halted: held,
      now: ambientMs / 1000,
      still,
      travelled: distanceBeforeZone + walk.run.zoneDistance,
    });
    world.road.draw(walk, zone, distanceBeforeZone);
    const previous = previousZone(gameData, walk.run);
    world.roadside.draw(
      zone.art,
      previous?.art ?? null,
      distanceBeforeZone,
      distanceBeforeZone + walk.run.zoneDistance,
      { ms: ambientMs, still },
    );
    const shadow = world.shadows.frame(colourFromHex(zone.roadShadowColour));
    world.items.draw(walk, held, still, shadow);
    world.distractions.draw(walk, world.items.vergeItems(walk), { halted: held, still });
    world.pack.draw(walk, {
      halted: held,
      itemPoint: (id) => world.items.point(id),
      pulls,
      shadow,
      still,
    });
    const cheats = cheatsFrom(this.registry.get(DEV_CHEATS_KEY));
    world.hitBoxes.draw(walk, cheats.hitBoxes);
    world.shadows.hideUnused();
    // Last, so the lights follow every sprite where this frame has drawn it.
    world.lights.draw(
      zoneId,
      previousZoneId(gameData, walk.run),
      distanceBeforeZone,
      distanceBeforeZone + walk.run.zoneDistance,
      world.roadside.lightCarriers(),
    );
  }
}
