import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import {
  backdropKey,
  dogSpriteKey,
  encounterSpriteKey,
  forcedStopSpriteKey,
  minorObstacleSpriteKey,
  roadStartKey,
  roadTileKey,
  SKUNK_CLOUD_KEY,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import type { DogId, EncounterId, HintTrigger, Zone } from "../data/types";
import { DEV_STATE_EVENT, type DevState } from "../dev/devOverlay";
import { DEV_LAST_LOG_KEY, DEV_REPLAY_KEY } from "../dev/devPanelModel";
import {
  decodeInputLog,
  encodeInputLog,
  type InputEvent,
  type InputLog,
  recordInput,
  replayInputs,
  startInputLog,
} from "../dev/inputLog";
import { pageRunSetup, runSetupLimitsFor } from "../dev/pageRunSetup";
import { randomStream } from "../dev/randomStreams";
import type { RunSetup } from "../dev/runSetup";
import { loadoutFor, withSetupStart } from "../dev/setupRun";
import { type ChangeLabel, changeLabels } from "../hud/hudView";
import { topBarButtonAt } from "../hud/topBar";
import {
  type GestureAction,
  type GestureContext,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "../input/gestures";
import { dogSlotForKey, isMuteKey, isPauseKey, laneDirectionForKey } from "../input/keyBindings";
import { laneCenterXs, type LaneDirection } from "../layout/lanes";
import { COLLAR_HEIGHT, leashHand, packPlacements } from "../layout/packFormation";
import {
  ballX,
  catReacts,
  catX,
  GAG_KEYS,
  GAG_SIZES,
  GAG_Y,
  ZONE_GAGS,
} from "../layout/sceneryGags";
import { screenLayout } from "../layout/screenLayout";
import { PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import type { Change } from "../rules/causes";
import {
  cardFor,
  type CardView,
  type Choice,
  type ChoiceOutcome,
  chooseOption,
  offerUpgrades,
  openCard,
  type QuipCue,
  quipLine,
} from "../rules/choices";
import { hintFor } from "../rules/hints";
import { giveTreat } from "../rules/treats";
import { read } from "../rules/units";
import { isSteeringLocked } from "../runner/laneControl";
import { laneMotionX } from "../runner/laneMotion";
import type { Random } from "../runner/random";
import {
  type EncounterCard,
  finishZone,
  headHome,
  isMinorObstacle,
  itemCategory,
  planZone,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
  type WalkStep,
  zoneLength,
} from "../runner/walk";
import { walkerFootY, walkGeometry } from "../runner/walkGeometry";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { packDogs } from "../state/pack";
import { type CardSource, type Loadout, newRun, type RunState } from "../state/runState";
import type { CardSceneData } from "./CardScene";
import { drawPixelLine, fillRect, shadowTexture } from "./draw";
import { hitLabelOf, playHitMoment } from "./hitMoment";
import { colorFromHex, PALETTE } from "./palette";
import type { PauseSceneData } from "./PauseScene";
import { addPixelText } from "./pixelText";
import {
  checkpointRun,
  currentSettings,
  finishRun,
  isMuted,
  markHintShown,
  onSettingsChanged,
  runLoadout,
  setMuted,
  type Settings,
  shownHints,
} from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import {
  addStandingSprite,
  ensurePlaceholder,
  playEffect,
  playTag,
  playTagOnce,
  spriteMetrics,
} from "./sprites";

// StartScene's pick; the run reads its loadout through runLoadout instead.
export interface RunSceneData {
  loadout: Loadout;
  // The chosen walker's sprite key.
  walkerSprite: string;
}

// What the HUD draws: the run, the dogs the open card affects, and how far through the zone.
export interface RunHudView {
  affected: readonly DogId[];
  run: RunState;
  zoneFraction: number;
}

// An owner's line, said beside their doghouse.
export interface QuipBubble {
  dog: DogId;
  text: string;
}

// Emitted on this scene's events: ChangeLabel[] whenever money or hearts change, a first-time
// hint's text, QuipBubble[] when owners react, and whether the pause menu is up when it opens
// or closes.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const PAUSE_MENU_EVENT = "pause-menu";
export const QUIPS_EVENT = "quips";

// The simulation steps at a fixed rate, so a seed and an input log replay a run exactly.
const STEP_MS = 1000 / 60;
const LONGEST_FRAME_MS = 250;
const ITEM_TAGS = ["idle", "walk", "wave", "loop"];
// The backdrop band draws over the road's sprites, so what enters at the top of the road
// comes out from behind the curb.
const DEPTH = {
  backdrop: 2400,
  banner: 3100,
  decal: 2,
  fx: 2500,
  gag: 2401,
  leash: 2000,
  popup: 3000,
  road: 0,
  shadow: 3,
  sprite: 10,
};
const ROAD_TILE = 64;
const LAYOUT = screenLayout(SCREEN_CONFIG);
// An instant lucky find's art pops up over the road, then floats up and fades.
const POPUP = { artY: 120, fadeMs: 1800, rise: 16 };
const BANNER = { holdMs: 1800, key: "ui-zone-banner", slideMs: 300, width: 248, y: 70 };

interface ItemView {
  // Drawn under everything else on the road, with no shadow.
  flat: boolean;
  sprites: { key: string; sprite: GameObjects.Sprite; y: (item: WalkItem) => number }[];
}

interface Gags {
  ball: GameObjects.Sprite;
  cat: { sprite: GameObjects.Sprite; x: number } | null;
  sprinklers: GameObjects.Sprite[];
}

interface Replay {
  events: InputEvent[];
  next: number;
}

// Placeholder sizes for road art that may be missing: a box the size of what it stands for.
const PLACEHOLDERS: readonly [string, number, number][] = [
  ["barrier-2", 88, 32],
  ["barrier-3", 144, 32],
  ["bench", 88, 32],
  ["bin", 32, 32],
  ["cone", 32, 32],
  ["hedge", 144, 32],
  ["hydrant", 32, 32],
  ["parked-car", 40, 144],
  [SKUNK_CLOUD_KEY, 88, 88],
];

// The walk: backdrop, road, walker, pack and everything spawned on the road. The simulation
// steps at a fixed rate and stops while a card or the pause menu is up.
export class RunScene extends Scene {
  private accumulatorMs = 0;
  private backdrop: GameObjects.Image | undefined;
  private banner: GameObjects.Container | undefined;
  private cardQueue: CardSource[] = [];
  private cardView: CardView | undefined;
  private changes: Change[] = [];
  private distanceBeforeZone = 0;
  private dizzy: GameObjects.Sprite | undefined;
  private dogSprites = new Map<DogId, GameObjects.Sprite>();
  private gags: Gags | undefined;
  private gesture: GestureState = idleGesture;
  private graphics?: {
    leash: GameObjects.Graphics;
    road: GameObjects.Graphics;
  };
  // What the leashes and the road fill were last drawn for, so an unchanged frame skips them.
  private drawnLeash = "";
  private drawnRoadFill = "";
  // Shadow images, reused frame to frame: the first shadowsUsed are in use this frame.
  private shadows: GameObjects.Image[] = [];
  private shadowsUsed = 0;
  private inputLog: InputLog | undefined;
  // A press that began on a top-bar button, which no gesture sees.
  private buttonPointerId: number | undefined;
  private items = new Map<number, ItemView>();
  private laneXs: number[] = [];
  private needsZonePlan = false;
  private pauseOpen = false;
  private pendingMoves: LaneDirection[] = [];
  private pointerId: number | undefined;
  private random: { cards: Random; quips: Random; rolls: Random; scenery: Random } | undefined;
  private replay: Replay | undefined;
  private roads?: {
    previous: GameObjects.TileSprite;
    start: GameObjects.Image;
    tiles: GameObjects.TileSprite;
  };
  private runTimeMs = 0;
  private settings: Settings | undefined;
  private setup: RunSetup | undefined;
  private stinky: GameObjects.Sprite | undefined;
  private stopSprites: GameObjects.Sprite[] = [];
  private stumbling = false;
  private walk: Walk | undefined;
  private walker: { key: string; sprite: GameObjects.Sprite } | undefined;
  private zoneEndPending = false;
  private zoneShown = -1;

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(): void {
    const layout = LAYOUT;
    this.laneXs = laneCenterXs(LANE_COUNT, layout.road);
    this.resetState();
    PLACEHOLDERS.forEach(([key, width, height]) =>
      ensurePlaceholder(this, key, { color: PALETTE.slate, height, width }),
    );

    const setup = this.startSetup();
    this.setup = setup;
    this.random = {
      cards: randomStream(setup.seed, "cards"),
      quips: randomStream(setup.seed, "quips"),
      rolls: randomStream(setup.seed, "rolls"),
      scenery: randomStream(setup.seed, "scenery"),
    };
    this.inputLog = startInputLog(setup);

    const picked = this.pickedLoadout(setup);
    const run = withSetupStart(setup, newRun(gameData, picked.dogSlots, picked.loadout));
    this.walk = this.planned({ road: startRoad(LANE_COUNT, setup.speed), run });

    this.settings = currentSettings(this);
    const sound = soundboardOf(this);
    this.applyVolumes();
    onSettingsChanged(this, (settings) => {
      this.settings = settings;
      this.applyVolumes();
    });

    this.createWorld(layout, picked.loadout, picked.walkerSprite);
    this.listen();

    this.scene.launch(SCENE_KEYS.hud);
    sound.setPaused(false);
    sound.setCardOpen(false);
    sound.startMusic();
    startWakeLock();
    this.showZoneBanner();
    if (this.sys.game.device.input.touch) {
      this.hint({ kind: "drag" });
    }
    this.draw();
  }

  // The settings' volumes, or silence while muted.
  private applyVolumes(): void {
    const settings = this.settings ?? currentSettings(this);
    const sound = soundboardOf(this);
    sound.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume });
    sound.setMuted(isMuted(this));
  }

  private toggleMute(): void {
    setMuted(this, !isMuted(this));
    this.applyVolumes();
  }

  private resetState(): void {
    this.accumulatorMs = 0;
    this.cardQueue = [];
    this.cardView = undefined;
    this.changes = [];
    this.distanceBeforeZone = 0;
    this.gesture = idleGesture;
    this.items = new Map();
    this.buttonPointerId = undefined;
    this.needsZonePlan = false;
    this.pauseOpen = false;
    this.pendingMoves = [];
    this.pointerId = undefined;
    this.replay = undefined;
    this.runTimeMs = 0;
    this.stopSprites = [];
    this.stumbling = false;
    this.zoneEndPending = false;
    this.zoneShown = -1;
  }

  // A replay log waiting in the session starts the run from its setup and drives its inputs;
  // otherwise the page's URL sets the run up.
  private startSetup(): RunSetup {
    const raw = sessionRead(DEV_REPLAY_KEY);
    if (raw !== null) {
      sessionRemove(DEV_REPLAY_KEY);
      const decoded = decodeInputLog(runSetupLimitsFor(gameData), raw);
      if (decoded.ok) {
        this.replay = { events: [...replayInputs(decoded.log)], next: 0 };
        return decoded.log.setup;
      }
      console.warn("Replay log rejected:", decoded.errors.join("; "));
    }
    return pageRunSetup().setup;
  }

  // The saved pick with the setup's pack and gear over it; a setup pack walks without one.
  private pickedLoadout(setup: RunSetup): {
    dogSlots: number;
    loadout: Loadout;
    walkerSprite: string;
  } {
    const typed = setup as RunSetup<DogId, never>;
    try {
      const picked = runLoadout(this);
      return {
        dogSlots: Math.max(picked.dogSlots, typed.pack?.length ?? 0),
        loadout: loadoutFor(picked.loadout, setup as Parameters<typeof loadoutFor>[1]),
        walkerSprite: picked.walkerSprite,
      };
    } catch (error) {
      const [first, ...rest] = typed.pack ?? [];
      if (first === undefined) {
        throw error;
      }
      const dogs = [first, ...rest.slice(0, 2)] as unknown as Loadout["dogs"];
      return {
        dogSlots: dogs.length,
        loadout: loadoutFor({ dogs, gear: null }, setup as Parameters<typeof loadoutFor>[1]),
        walkerSprite: gameData.walkers[gameData.defaultWalker].spriteKey,
      };
    }
  }

  private planned(walk: Walk): Walk {
    const seed = this.setup?.seed ?? 0;
    const spawns = randomStream(seed, `spawns-${walk.run.zoneIndex}`);
    return planZone(gameData, this.geometry(walk.run), spawns, walk);
  }

  private createWorld(
    layout: ReturnType<typeof screenLayout>,
    loadout: Loadout,
    walkerSprite: string,
  ): void {
    const { backdrop, road } = layout;
    this.backdrop = this.add.image(backdrop.x, backdrop.y, "__DEFAULT").setOrigin(0);
    this.backdrop.setDepth(DEPTH.backdrop);
    this.roads = {
      previous: this.add
        .tileSprite(road.x, road.y, road.width, road.height, "__DEFAULT")
        .setOrigin(0)
        .setDepth(DEPTH.road)
        .setVisible(false),
      start: this.add.image(road.x, road.y, "__DEFAULT").setOrigin(0).setVisible(false),
      tiles: this.add
        .tileSprite(road.x, road.y, road.width, road.height, "__DEFAULT")
        .setOrigin(0)
        .setDepth(DEPTH.road),
    };
    this.roads.start.setDepth(DEPTH.road);
    this.graphics = {
      leash: this.add.graphics().setDepth(DEPTH.leash),
      road: this.add.graphics().setDepth(DEPTH.road - 1),
    };
    this.drawnLeash = "";
    this.drawnRoadFill = "";
    this.shadows = [];
    this.dogSprites = new Map(
      loadout.dogs.map((dog) => {
        const key = dogSpriteKey(dog);
        const sprite = addStandingSprite(this, key, 0, 0);
        playTag(sprite, key, "walk");
        return [dog, sprite];
      }),
    );
    this.walker = { key: walkerSprite, sprite: addStandingSprite(this, walkerSprite, 0, 0) };
    playTag(this.walker.sprite, walkerSprite, "walk");
    this.dizzy = this.add.sprite(0, 0, "fx-dizzy").setDepth(DEPTH.fx).setVisible(false);
    this.stinky = this.add.sprite(0, 0, "fx-stinky").setDepth(DEPTH.fx).setVisible(false);
  }

  private listen(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    this.input.on("pointerdown", (pointer: Input.Pointer) => this.onPointer("down", pointer));
    this.input.on("pointermove", (pointer: Input.Pointer) => this.onPointer("move", pointer));
    this.input.on("pointerup", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    this.input.on("pointerupoutside", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    // A press that began before a pause belongs to the card or menu, not the road. Scene
    // events outlive a restart, so the listener goes with the walk.
    const onResume = () => {
      this.gesture = idleGesture;
      this.pointerId = undefined;
      this.buttonPointerId = undefined;
    };
    this.events.on("resume", onResume);
    this.events.once("shutdown", () => this.events.off("resume", onResume));
    const onBack = () => this.openPause();
    const onHidden = () => {
      this.openPause();
      const walk = this.walk;
      if (walk !== undefined && walk.run.phase.kind !== "ended") {
        void checkpointRun(this, checkpointOf(gameData, walk.run));
      }
    };
    const onSideways = () => this.openPause();
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    window.addEventListener(PHONE_EVENTS.appHidden, onHidden);
    window.addEventListener(PHONE_EVENTS.turnedSideways, onSideways);
    this.events.once("shutdown", () => {
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
      affected: this.cardView?.affected ?? [],
      run,
      zoneFraction: run.zoneDistance / zoneLength(gameData, run),
    };
  }

  // Whether animations and bursts keep still, from the player's settings.
  reducedMotion(): boolean {
    return this.settings?.reducedMotion ?? false;
  }

  private geometry(run: RunState): RoadGeometry {
    return walkGeometry(LANE_COUNT, packDogs(run).length, LAYOUT.road);
  }

  private gestureContext(): GestureContext {
    return {
      config: {
        laneCount: LANE_COUNT,
        tapMaxDistance: read(gameData.tuning, "pixels", "tapMaxDistance"),
      },
      layout: LAYOUT,
    };
  }

  private onKey(key: string): void {
    if (isMuteKey(key)) {
      this.toggleMute();
      return;
    }
    const direction = laneDirectionForKey(key);
    if (direction !== undefined) {
      this.act({ direction, kind: "move" });
      return;
    }
    if (isPauseKey(key)) {
      this.act({ kind: "pause" });
      return;
    }
    const slot = dogSlotForKey(SCREEN_CONFIG.dogSlotCount, key);
    if (slot !== undefined) {
      this.act({ kind: "treat", slot });
    }
  }

  // Only the first finger down drives the gestures until it lifts. A press on a top-bar button
  // presses it and is no gesture: the sound button never pauses, and neither moves the pack.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    if (pointer.id === this.buttonPointerId) {
      if (phase === "up") {
        this.buttonPointerId = undefined;
      }
      return;
    }
    const button = phase === "down" ? topBarButtonAt(pointer.x, pointer.y) : undefined;
    if (button !== undefined) {
      this.buttonPointerId = pointer.id;
      if (button === "sound") {
        this.toggleMute();
      } else {
        this.act({ kind: "pause" });
      }
      return;
    }
    if (phase === "down" && this.pointerId === undefined) {
      this.pointerId = pointer.id;
    }
    if (pointer.id !== this.pointerId) {
      return;
    }
    const sample = { x: pointer.x, y: pointer.y };
    const handler = { down: pointerDown, move: pointerMove, up: pointerUp }[phase];
    const result = handler(this.gestureContext(), sample, this.gesture);
    this.gesture = result.state;
    if (phase === "up") {
      this.pointerId = undefined;
    }
    result.actions.forEach((action) => this.act(action));
  }

  // Lane moves wait for the next simulation step, where they are logged.
  private act(action: GestureAction): void {
    const walk = this.walk;
    if (walk === undefined || walk.run.phase.kind !== "walking" || this.pauseOpen) {
      return;
    }
    switch (action.kind) {
      case "move":
        if (this.replay === undefined) {
          this.pendingMoves.push(action.direction);
        }
        return;
      case "pause":
        this.openPause();
        return;
      case "treat": {
        const slot = walk.run.pack[action.slot];
        if (slot === undefined) {
          return;
        }
        const { change, state: run } = giveTreat(gameData, slot.dog, walk.run);
        this.addChanges(change === null ? [] : [change]);
        this.walk = { ...walk, run };
        return;
      }
      default:
        action satisfies never;
    }
  }

  private addChanges(changes: readonly Change[]): void {
    this.changes.push(...changes);
    this.emitLabels(changeLabels(gameData, changes));
  }

  private emitLabels(labels: ChangeLabel[]): void {
    if (labels.length > 0) {
      this.events.emit(CHANGE_LABELS_EVENT, labels);
    }
  }

  // Shows the first-time hint for event, once per player.
  private hint(event: HintTrigger): void {
    const hint = hintFor(gameData, [...shownHints(this)], event);
    if (hint !== null) {
      markHintShown(this, hint.id);
      // On the next frame, so a hint raised as the run starts reaches the HUD it launches.
      this.time.delayedCall(0, () => this.events.emit(HINT_EVENT, hint));
    }
  }

  override update(_time: number, delta: number): void {
    if (this.walk === undefined || this.scene.isPaused()) {
      return;
    }
    this.accumulatorMs = Math.min(LONGEST_FRAME_MS, this.accumulatorMs + delta);
    while (this.accumulatorMs >= STEP_MS && this.walking()) {
      this.accumulatorMs -= STEP_MS;
      this.simulate();
    }
    if (!this.walking()) {
      this.accumulatorMs = 0;
    }
    this.draw();
    this.emitDevState();
  }

  private walking(): boolean {
    const walk = this.walk;
    return (
      walk !== undefined &&
      walk.run.phase.kind === "walking" &&
      !this.pauseOpen &&
      this.cardView === undefined
    );
  }

  // One fixed step: the inputs due now, then the walk.
  private simulate(): void {
    let walk = this.walk;
    const random = this.random;
    if (walk === undefined || random === undefined) {
      return;
    }
    for (const direction of this.dueMoves()) {
      walk = steerWalk(gameData, LANE_COUNT, direction, walk);
      this.log({ direction, kind: "lane", timeMs: this.runTimeMs });
    }
    const step = stepWalk(gameData, this.geometry(walk.run), random.rolls, STEP_MS / 1000, walk);
    this.runTimeMs += STEP_MS;
    this.walk = step.walk;
    this.react(step);
    this.zoneEndPending ||= step.zoneEnded;
    this.cardQueue.push(...step.cards);
    this.continueWalk();
  }

  private dueMoves(): LaneDirection[] {
    const replay = this.replay;
    if (replay === undefined) {
      const moves = this.pendingMoves;
      this.pendingMoves = [];
      return moves;
    }
    const moves: LaneDirection[] = [];
    for (let event = replay.events[replay.next]; event !== undefined;) {
      if (event.kind !== "lane" || event.timeMs > this.runTimeMs) {
        break;
      }
      moves.push(event.direction);
      replay.next += 1;
      event = replay.events[replay.next];
    }
    return moves;
  }

  // The next replayed card choice, if a replay is driving the run.
  private replayedChoice(): Choice | undefined {
    const replay = this.replay;
    const event = replay?.events[replay.next];
    if (replay === undefined || event?.kind !== "card") {
      return undefined;
    }
    replay.next += 1;
    return event.choice;
  }

  private log(event: InputEvent): void {
    if (this.inputLog !== undefined) {
      this.inputLog = recordInput(event, this.inputLog);
    }
  }

  // Sounds, bursts, labels and hints for what happened in a step.
  private react(step: WalkStep): void {
    const sound = soundboardOf(this);
    const pack = this.packPoint();
    if (step.tips.length > 0) {
      sound.play("tip");
      this.hint({ kind: "tip" });
    }
    this.addChanges(step.tips);
    for (const item of step.collected) {
      playEffect(this, "fx-sparkle", "play", { x: pack.x, y: pack.y - 24 }, DEPTH.fx);
      if (item.kind === "treat") {
        sound.play("treat");
        this.hint({ kind: "treat" });
      }
    }
    for (const bump of step.bumps) {
      sound.play("bump");
      this.addChanges(bump.change === null ? [] : [bump.change]);
      playEffect(this, "fx-bump", "play", { x: pack.x, y: pack.y - 20 }, DEPTH.fx);
      playEffect(this, "fx-coins", "play", { x: pack.x, y: pack.y - 36 }, DEPTH.fx);
      this.stumble();
      this.stumbling = true;
      this.hint({ kind: "minorBump" });
    }
    for (const { encounter, outcome } of step.instants) {
      this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
      this.showInstantPopup(encounter);
      this.sayQuips(outcome.quips);
      this.afterOutcome(outcome);
      this.hint({ kind: "luckyFind" });
    }
    for (const hit of step.encounterHits) {
      sound.play("bump");
      if (hit.encounter === "puddle") {
        playEffect(this, "fx-splash", "play", { x: pack.x, y: pack.y - 8 }, DEPTH.fx);
      }
      this.stumble();
      this.playHit(hit, step.walk.road.hitStop?.seconds ?? 0);
    }
  }

  // The hit moment over the stop, framed by the road and the backdrop band beside it.
  private playHit(hit: EncounterCard, seconds: number): void {
    const { backdrop, road } = LAYOUT;
    const pack = this.packPoint();
    playHitMoment(this, {
      caught: hit.affected.flatMap((dog) => this.dogSprites.get(dog) ?? []),
      centre: { x: pack.x, y: pack.y - 20 },
      depth: DEPTH.popup,
      encounter: hit.encounter,
      field: { ...road, height: road.y + road.height - backdrop.y, y: backdrop.y },
      label: hitLabelOf(gameData.encounters[hit.encounter]),
      labelX: road.x + road.width / 2,
      seconds,
      still: this.reducedMotion(),
    });
  }

  // The walker stumbles and the dogs hop; reduced motion skips it.
  private stumble(): void {
    if (this.reducedMotion()) {
      return;
    }
    const walker = this.walker;
    if (walker !== undefined) {
      playTagOnce(walker.sprite, walker.key, "stumble", () =>
        playTag(walker.sprite, walker.key, "walk"),
      );
    }
    for (const [dog, sprite] of this.dogSprites) {
      const key = dogSpriteKey(dog);
      playTagOnce(sprite, key, "react", () => playTag(sprite, key, "walk"));
    }
  }

  // The pack's centre at the leading dog's feet, in screen pixels.
  private packPoint(): { x: number; y: number } {
    const road = LAYOUT.road;
    const walk = this.walk;
    const x =
      walk === undefined
        ? road.x + road.width / 2
        : laneMotionX(this.laneXs, walk.road.control.motion);
    return { x, y: walkerFootY(road) - 20 };
  }

  // Firings and debuffs a choice or find brought about.
  private afterOutcome(outcome: ChoiceOutcome): void {
    if (outcome.fired.length > 0) {
      soundboardOf(this).play("fired");
      this.hint({ kind: "firedOwner" });
    }
    for (const { debuff } of outcome.state.debuffs) {
      this.hint({ debuff, kind: "debuff" });
    }
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
      this.walk = this.planned(walk);
      this.showZoneBanner();
    }
    if (this.scene.isPaused() && !this.pauseOpen) {
      this.scene.resume();
    }
  }

  // Pays the zone's fees, saves a checkpoint, then offers the upgrades before the next zone
  // is planned.
  private endZone(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const { fees, run } = finishZone(gameData, walk.run);
    this.addChanges(fees);
    this.walk = { ...walk, run };
    if (run.phase.kind !== "ended") {
      this.distanceBeforeZone += zoneLength(gameData, walk.run);
      void checkpointRun(this, checkpointOf(gameData, run));
      this.needsZonePlan = true;
      this.cardQueue.push({
        kind: "upgradeOffer",
        offered: offerUpgrades(gameData, this.random?.cards ?? Math.random, run),
      });
    }
    this.continueWalk();
  }

  private showCard(source: CardSource): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const run = openCard(source, walk.run);
    const view = cardFor(gameData, run, source);
    this.walk = { ...walk, run };
    this.cardView = view;
    this.cardHints(source);
    const replayed = this.replayedChoice();
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    const sound = soundboardOf(this);
    sound.play("cardOpen");
    sound.setCardOpen(true);
    if (!this.scene.isPaused()) {
      this.scene.pause();
    }
    const data: CardSceneData = { onChoose: (choice) => this.choose(view, choice), view };
    this.scene.launch(SCENE_KEYS.card, data);
  }

  private cardHints(source: CardSource): void {
    if (source.kind === "upgradeOffer") {
      return;
    }
    if (source.kind === "forcedStop") {
      this.hint({ kind: "forcedStop" });
    } else {
      this.hint({ encounter: source.encounter, kind: "encounter" });
      if (gameData.encounters[source.encounter].kind === "lucky") {
        this.hint({ kind: "luckyFind" });
      }
    }
    this.hint({ kind: "card" });
  }

  private choose(view: CardView, choice: Choice): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const outcome = chooseOption(
      gameData,
      this.random?.cards ?? Math.random,
      walk.run,
      view,
      choice,
    );
    this.log({ choice, kind: "card", timeMs: this.runTimeMs });
    this.walk = { ...walk, run: outcome.state };
    this.cardView = undefined;
    this.scene.stop(SCENE_KEYS.card);
    soundboardOf(this).setCardOpen(false);
    this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
    this.sayQuips(outcome.quips);
    this.afterOutcome(outcome);
    this.continueWalk();
  }

  // Each owner who reacted says one of their lines beside their doghouse.
  private sayQuips(quips: readonly QuipCue[]): void {
    const random = this.random?.quips ?? Math.random;
    const bubbles = quips.map((cue): QuipBubble => ({
      dog: cue.dog,
      text: quipLine(gameData, random, cue),
    }));
    if (bubbles.length > 0) {
      this.events.emit(QUIPS_EVENT, bubbles);
    }
  }

  // An instant lucky find opens no card: its art pops up over the road, then floats up and
  // fades while the walk goes on. With reduced motion it fades in place.
  private showInstantPopup(encounter: EncounterId): void {
    const { resolution } = gameData.encounters[encounter];
    if (resolution.kind !== "instant" || !this.textures.exists(resolution.art)) {
      return;
    }
    const { road } = LAYOUT;
    const art = this.add
      .image(road.x + road.width / 2, road.y + POPUP.artY, resolution.art)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.popup);
    this.tweens.add({
      alpha: 0,
      duration: POPUP.fadeMs,
      ease: "Sine.easeIn",
      onComplete: () => art.destroy(),
      targets: art,
      y: this.reducedMotion() ? art.y : art.y - POPUP.rise,
    });
  }

  // "MAPLE STREET, ZONE n" and the zone's name, slid in over the road at each zone's start.
  private showZoneBanner(): void {
    const walk = this.walk;
    if (walk === undefined || walk.run.zoneIndex === this.zoneShown) {
      return;
    }
    this.zoneShown = walk.run.zoneIndex;
    this.banner?.destroy();
    const zone = this.zone(walk.run);
    const { road } = LAYOUT;
    const x = road.x + Math.floor((road.width - BANNER.width) / 2);
    const banner = this.add.container(x, road.y + BANNER.y).setDepth(DEPTH.banner);
    if (this.textures.exists(BANNER.key)) {
      banner.add(this.add.image(0, 0, BANNER.key).setOrigin(0));
    } else {
      const g = this.add.graphics();
      fillRect(g, PALETTE.cream, { height: 48, width: BANNER.width, x: 0, y: 0 });
      banner.add(g);
    }
    const heading = `${gameData.world.name}, zone ${walk.run.zoneIndex + 1}`;
    banner.add(
      addPixelText(this, BANNER.width / 2, 11, heading, {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
      }),
    );
    banner.add(
      addPixelText(this, BANNER.width / 2, 27, zone.name, {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
        scale: 2,
      }),
    );
    this.banner = banner;
    const still = this.reducedMotion();
    if (!still) {
      banner.x = x - road.width;
    }
    this.tweens.chain({
      onComplete: () => banner.destroy(),
      targets: banner,
      tweens: [
        { duration: still ? 0 : BANNER.slideMs, ease: "Sine.easeOut", x },
        {
          delay: BANNER.holdMs,
          duration: BANNER.slideMs,
          ...(still ? { alpha: 0 } : { x: x + road.width }),
        },
      ],
    });
  }

  private openPause(): void {
    const walk = this.walk;
    if (walk === undefined || this.pauseOpen || walk.run.phase.kind !== "walking") {
      return;
    }
    this.pauseOpen = true;
    this.hint({ kind: "pause" });
    soundboardOf(this).setPaused(true);
    this.scene.pause();
    this.scene.pause(SCENE_KEYS.hud);
    this.events.emit(PAUSE_MENU_EVENT, true);
    const resume = () => {
      this.scene.stop(SCENE_KEYS.pause);
      this.pauseOpen = false;
      this.events.emit(PAUSE_MENU_EVENT, false);
      soundboardOf(this).setPaused(false);
      this.scene.resume(SCENE_KEYS.hud);
      this.scene.resume();
    };
    const data: PauseSceneData = {
      onHeadHome: () => {
        resume();
        const current = this.walk;
        if (current !== undefined) {
          this.walk = { ...current, run: headHome(current.run) };
        }
        this.endWalk();
      },
      onResume: resume,
    };
    this.scene.launch(SCENE_KEYS.pause, data);
  }

  // Saves the walk and its input log, then shows the end screen.
  private endWalk(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    this.walk = undefined;
    const sound = soundboardOf(this);
    sound.stopMusic();
    sound.setCardOpen(false);
    stopWakeLock();
    if (this.inputLog !== undefined) {
      sessionWrite(DEV_LAST_LOG_KEY, encodeInputLog(this.inputLog));
    }
    for (const key of [SCENE_KEYS.hud, SCENE_KEYS.card, SCENE_KEYS.pause]) {
      this.scene.stop(key);
    }
    const showEnd = () => this.scene.start(SCENE_KEYS.end);
    finishRun(this, runResultOf(gameData, walk.run), this.changes).then(
      showEnd,
      (error: unknown) => {
        console.error("The run could not be saved.", error);
        showEnd();
      },
    );
  }

  private emitDevState(): void {
    const walk = this.walk;
    const setup = this.setup;
    if (walk === undefined || setup === undefined) {
      return;
    }
    const state: DevState = {
      run: walk.run,
      scrollSpeed: walkScrollSpeed(gameData, walk.run) * walk.road.speedFactor,
      setup,
      zoneDistance: walk.run.zoneDistance,
      zoneIndex: walk.run.zoneIndex,
    };
    this.game.events.emit(DEV_STATE_EVENT, state);
  }

  private zone(run: RunState): Zone {
    const zones = gameData.world.zones;
    return itemAt(zones, Math.min(run.zoneIndex, zones.length - 1));
  }

  private draw(): void {
    const walk = this.walk;
    const graphics = this.graphics;
    if (walk === undefined || graphics === undefined) {
      return;
    }
    const zone = this.zone(walk.run);
    const shadowColor = colorFromHex(zone.roadShadowColor);
    this.drawBackdrop(walk, zone);
    this.drawRoad(walk, zone, graphics.road);

    this.shadowsUsed = 0;
    const shadow = (key: string, x: number, footY: number) =>
      this.placeShadow(shadowColor, key, x, footY);
    this.drawItems(walk, shadow);
    this.drawForcedStop(walk, shadow);
    this.drawPack(walk, shadow, graphics.leash);
    this.shadows.slice(this.shadowsUsed).forEach((image) => image.setVisible(false));
  }

  // A shadow under a sprite, centred on its x a pixel above its feet, from the pool.
  private placeShadow(color: number, key: string, x: number, footY: number): void {
    const { anchor, key: texture } = shadowTexture(this, color, spriteMetrics(key).opaqueWidth);
    let image = this.shadows[this.shadowsUsed];
    if (image === undefined) {
      image = this.add.image(0, 0, texture).setOrigin(0).setDepth(DEPTH.shadow);
      this.shadows.push(image);
    }
    this.shadowsUsed += 1;
    image
      .setTexture(texture)
      .setPosition(Math.round(x) - anchor.x, Math.round(footY) - 1 - anchor.y)
      .setVisible(true);
  }

  private drawBackdrop(walk: Walk, zone: Zone): void {
    const key = backdropKey(zone);
    if (this.backdrop !== undefined && this.backdrop.texture.key !== key) {
      this.backdrop.setTexture(this.textures.exists(key) ? key : "__DEFAULT");
      this.placeGags(zone);
    }
    const gags = this.gags;
    if (gags === undefined) {
      return;
    }
    const still = this.reducedMotion();
    const { backdrop } = LAYOUT;
    if (gags.cat !== null) {
      const reacting = !still && catReacts(gags.cat.x, this.packPoint().x);
      playTag(gags.cat.sprite, GAG_KEYS.cat, reacting ? "react" : "idle", still);
    }
    gags.sprinklers.forEach((sprite) => playTag(sprite, GAG_KEYS.sprinkler, "spray", still));
    const x = still
      ? backdrop.width - 60
      : ballX(backdrop.width, walk.run.zoneDistance / walkScrollSpeed(gameData, walk.run));
    gags.ball.setVisible(x !== null);
    if (x !== null) {
      gags.ball.setPosition(Math.round(x), backdrop.y + GAG_Y.ball);
      playTag(gags.ball, GAG_KEYS.ball, "roll", still);
    }
  }

  // The zone's gags from its row of the table: a cat on one of its fences, its sprinklers and
  // the ball.
  private placeGags(zone: Zone): void {
    const gags = this.gags;
    gags?.cat?.sprite.destroy();
    gags?.sprinklers.forEach((sprite) => sprite.destroy());
    gags?.ball.destroy();
    const { backdrop } = LAYOUT;
    const table = ZONE_GAGS[zone.id as keyof typeof ZONE_GAGS];
    const add = (key: string, x: number, y: number) =>
      this.add
        .sprite(Math.round(x), backdrop.y + y, key)
        .setOrigin(0)
        .setDepth(DEPTH.gag);
    const left = catX(table, (this.random?.scenery ?? Math.random)());
    this.gags = {
      ball: add(GAG_KEYS.ball, 0, GAG_Y.ball),
      cat: left === null ? null : { sprite: add(GAG_KEYS.cat, left, GAG_Y.cat), x: left },
      sprinklers: table.sprinklers.map((x) =>
        add(GAG_KEYS.sprinkler, x - GAG_SIZES.sprinkler.width / 2, GAG_Y.sprinkler),
      ),
    };
  }

  // The zone's road strip, scrolled with the walk; at a zone's start, its start strip rolls in
  // from the top over the previous zone's road. Without the art, the zone's colour.
  private drawRoad(walk: Walk, zone: Zone, fill: GameObjects.Graphics): void {
    const roads = this.roads;
    if (roads === undefined) {
      return;
    }
    const { road } = LAYOUT;
    const scrolled = this.distanceBeforeZone + walk.run.zoneDistance;
    const phase = (top: number) =>
      (((top - road.y - scrolled) % ROAD_TILE) + ROAD_TILE) % ROAD_TILE;
    if (this.drawnRoadFill !== zone.roadColor) {
      this.drawnRoadFill = zone.roadColor;
      fill.clear();
      fillRect(fill, colorFromHex(zone.roadColor), road);
    }
    const tileKey = roadTileKey(zone);
    roads.tiles.setVisible(this.textures.exists(tileKey));
    if (roads.tiles.texture.key !== tileKey && this.textures.exists(tileKey)) {
      roads.tiles.setTexture(tileKey);
    }
    roads.tiles.tilePositionY = phase(road.y);

    const previous = gameData.world.zones[walk.run.zoneIndex - 1];
    const startKey = roadStartKey(zone);
    const stripTop = road.y - ROAD_TILE + walk.run.zoneDistance;
    const rolling =
      previous !== undefined &&
      this.textures.exists(startKey) &&
      this.textures.exists(roadTileKey(previous)) &&
      stripTop < road.y + road.height;
    roads.start.setVisible(rolling);
    roads.previous.setVisible(rolling);
    if (!rolling) {
      return;
    }
    roads.start.setTexture(startKey).setPosition(road.x, Math.round(stripTop));
    roads.start.setCrop(0, Math.max(0, road.y - Math.round(stripTop)), road.width, ROAD_TILE);
    const previousTop = Math.round(stripTop) + ROAD_TILE;
    if (previousTop >= road.y + road.height) {
      roads.previous.setVisible(false);
      return;
    }
    const top = Math.max(road.y, previousTop);
    roads.previous.setTexture(roadTileKey(previous));
    roads.previous.setPosition(road.x, top).setSize(road.width, road.y + road.height - top);
    roads.previous.tilePositionY = phase(top);
  }

  private drawItems(walk: Walk, shadow: (key: string, x: number, footY: number) => void): void {
    const seen = new Set<number>();
    const still = this.reducedMotion();
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.items.get(item.id) ?? this.addItemView(item);
      const first = itemAt(this.laneXs, item.lane);
      const x = (first + itemAt(this.laneXs, item.lane + item.laneSpan - 1)) / 2;
      view.sprites.forEach(({ key, sprite, y }, i) => {
        const offset =
          item.kind === "otherDog" && view.sprites.length > 1 ? (i === 0 ? -8 : 10) : 0;
        const footY = y(item);
        sprite.setPosition(Math.round(x + offset), Math.round(footY));
        ITEM_TAGS.forEach((tag) => playTag(sprite, key, tag, still));
        if (view.flat && i === 0) {
          sprite.setDepth(DEPTH.decal);
        } else {
          sprite.setDepth(DEPTH.sprite + footY);
          shadow(key, x + offset, footY);
        }
      });
    }
    for (const [id, view] of this.items) {
      if (!seen.has(id)) {
        view.sprites.forEach(({ sprite }) => sprite.destroy());
        this.items.delete(id);
      }
    }
  }

  // Each item stands at the bottom of its hit box. A puddle lies flat under the rest, and a
  // skunk stands in the middle of its spray cloud, which lies flat too.
  private addItemView(item: WalkItem): ItemView {
    const bottom = (shown: WalkItem) => shown.y + shown.height;
    const standing = (key: string) => ({
      key,
      sprite: addStandingSprite(this, key, 0, 0),
      y: bottom,
    });
    let view: ItemView;
    if (item.kind === "tip" || item.kind === "treat") {
      view = { flat: false, sprites: [standing(item.kind)] };
    } else if (isMinorObstacle(gameData, item.kind)) {
      view = { flat: false, sprites: [standing(minorObstacleSpriteKey(item.kind))] };
    } else if (item.kind === "skunk") {
      const skunk = encounterSpriteKey("skunk");
      view = {
        flat: true,
        sprites: [
          standing(SKUNK_CLOUD_KEY),
          {
            key: skunk,
            sprite: addStandingSprite(this, skunk, 0, 0),
            y: (shown) => shown.y + shown.height / 2 + 16,
          },
        ],
      };
    } else if (item.kind === "otherDog" && this.textures.exists("other-dog-owner")) {
      view = {
        flat: false,
        sprites: [standing(encounterSpriteKey(item.kind)), standing("other-dog-owner")],
      };
    } else {
      view = { flat: item.kind === "puddle", sprites: [standing(encounterSpriteKey(item.kind))] };
    }
    if (itemCategory(gameData, item.kind) === "lucky" || view.flat) {
      view.sprites[0]?.sprite.setOrigin(0.5, 1);
    }
    this.items.set(item.id, view);
    return view;
  }

  // A forced stop's figure stands in the middle of the road; a construction barrier is
  // repeated across every lane.
  private drawForcedStop(
    walk: Walk,
    shadow: (key: string, x: number, footY: number) => void,
  ): void {
    const { road } = LAYOUT;
    const onRoad = walk.road.forcedStopOnRoad;
    if (onRoad === null) {
      this.stopSprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = [];
      return;
    }
    const key = forcedStopSpriteKey(onRoad.stop);
    const xs = onRoad.stop === "constructionDetour" ? this.laneXs : [road.x + road.width / 2];
    if (this.stopSprites.length !== xs.length || this.stopSprites[0]?.texture.key !== key) {
      this.stopSprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = xs.map(() => addStandingSprite(this, key, 0, 0));
    }
    const footY = onRoad.y + this.geometry(walk.run).itemHeights.forcedStop;
    const still = this.reducedMotion();
    this.stopSprites.forEach((sprite, i) => {
      const x = itemAt(xs, i);
      ITEM_TAGS.forEach((tag) => playTag(sprite, key, tag, still));
      sprite.setPosition(Math.round(x), Math.round(footY)).setDepth(DEPTH.sprite + footY);
      shadow(key, x, footY);
    });
  }

  private drawPack(
    walk: Walk,
    shadow: (key: string, x: number, footY: number) => void,
    leash: GameObjects.Graphics,
  ): void {
    const { road } = LAYOUT;
    const walkerX = Math.round(laneMotionX(this.laneXs, walk.road.control.motion));
    const footY = walkerFootY(road);
    const walking = packDogs(walk.run);
    const placements = packPlacements(walking.length);
    const leashColor = colorFromHex(this.zone(walk.run).leashColor);
    const leashKey = `${walkerX}|${walking.join()}|${leashColor}`;
    const redrawLeash = leashKey !== this.drawnLeash;
    if (redrawLeash) {
      this.drawnLeash = leashKey;
      leash.clear();
    }
    for (const [dog, sprite] of this.dogSprites) {
      const index = walking.indexOf(dog);
      sprite.setVisible(index >= 0);
      if (index < 0) {
        continue;
      }
      const placement = itemAt(placements, index);
      const x = walkerX + placement.dx;
      const dogFoot = footY + placement.footDy;
      sprite.setPosition(x, dogFoot).setDepth(DEPTH.sprite + dogFoot);
      shadow(sprite.texture.key, x, dogFoot);
      if (redrawLeash) {
        const hand = leashHand(placement);
        drawPixelLine(
          leash,
          leashColor,
          { x: walkerX + hand.dx, y: footY + hand.dy },
          { x, y: dogFoot - COLLAR_HEIGHT },
        );
      }
    }
    const walker = this.walker;
    if (walker !== undefined) {
      walker.sprite.setPosition(walkerX, footY).setDepth(DEPTH.sprite + footY);
      shadow(walker.key, walkerX, footY);
    }
    // Dizzy stars circle the walker's head for as long as a stumble locks steering.
    this.stumbling &&= isSteeringLocked(walk.road.control);
    const still = this.reducedMotion();
    if (this.dizzy !== undefined) {
      this.dizzy.setVisible(this.stumbling).setPosition(walkerX, footY - 52);
      playTag(this.dizzy, "fx-dizzy", "loop", still);
    }
    // Stink lines hang over the pack while Stinky lasts.
    if (this.stinky !== undefined) {
      const stinky = walk.run.debuffs.some(({ debuff }) => debuff === "stinky");
      this.stinky.setVisible(stinky).setPosition(walkerX, footY - 70);
      playTag(this.stinky, "fx-stinky", "loop", still);
    }
    // A pull will play the dog's "tell" tag, mirrored for the left, with fx-bark over its
    // head, and steer through pullLane; dogs do not pull yet.
  }
}

// sessionStorage can be missing or throw (private browsing, blocked storage): the run goes on.
function sessionRead(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionWrite(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // The dev panel then has no log to offer.
  }
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // A replay that cannot be cleared plays again on the next run.
  }
}
