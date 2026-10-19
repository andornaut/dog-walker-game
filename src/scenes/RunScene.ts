import { type GameObjects, type Input, Scene, type Textures, WEBGL } from "phaser";

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
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId, EncounterId, HintTrigger, Zone } from "../data/types";
import { DEV_ROAD_FADE_KEY, DEV_STATE_EVENT, type DevState } from "../dev/devOverlay";
import { DEV_LAST_LOG_KEY, DEV_REPLAY_KEY } from "../dev/devPanelModel";
import {
  decodeInputLog,
  encodeInputLog,
  type InputEvent,
  type InputLog,
  recordInput,
  replayInputs,
  startInputLog,
  takeDueInputs,
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
import { project, type ScaleStep, snapScale } from "../layout/projection";
import {
  drawRoad,
  type PixelImage,
  type RoadLook,
  type RoadRaster,
  roadRaster,
  solidStrip,
  STRIP,
  stripLevels,
} from "../layout/roadRaster";
import {
  ballAt,
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
import { walkerFootY, walkGeometry, walkProjection } from "../runner/walkGeometry";
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
  type DepthLook,
  depthLook,
  ensurePlaceholder,
  firstTag,
  playEffect,
  playTag,
  playTagOnce,
  showDepthLook,
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
// An item plays the first of these tags it has: its own motion while the walk goes on, and
// standing still while a card or the pause menu holds the walk.
const ITEM_TAGS = {
  halted: ["idle", "loop", "walk", "wave"],
  walking: ["walk", "wave", "loop", "idle"],
} as const;
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
const LAYOUT = screenLayout(SCREEN_CONFIG);
// Every road sprite, the road and its verge are drawn through this one projection.
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const ROAD_TEXTURE = "road-projected";
// An instant lucky find's art pops up over the road, then floats up and fades.
const POPUP = { artY: 120, fadeMs: 1800, rise: 16 };
const BANNER = { holdMs: 1800, key: "ui-zone-banner", slideMs: 300, width: 248, y: 70 };

// One sprite of an item. dx is across the road from the item's centre and footY the flat
// road row it stands on, both in road pixels. feet "bottom" stands it on its frame's bottom
// rather than its anchor. A flat sprite lies on the road, under everything else with no
// shadow, foreshortened like the road.
interface ItemPart {
  dx: number;
  feet: "anchor" | "bottom";
  flat: boolean;
  footY: (item: WalkItem) => number;
  key: string;
  sprite: GameObjects.Sprite;
}

interface ItemView {
  parts: ItemPart[];
}

type Shadow = (look: DepthLook, x: number, footY: number, step: ScaleStep) => void;

// The inputs a simulation step applies, waiting for it. Only a replay heads home at a step:
// played live, the pause menu ends the walk at once.
type PendingInput =
  { direction: LaneDirection; kind: "lane" } | { kind: "home" } | { kind: "treat"; slot: number };

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
  ["parked-car", 40, 80],
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
  };
  // What the leashes and the road were last drawn for, so an unchanged frame skips them.
  private drawnLeash = "";
  private drawnRoad = "";
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
  private packPose: "idle" | "walk" = "walk";
  private pendingInputs: PendingInput[] = [];
  private pointerId: number | undefined;
  private random: { cards: Random; quips: Random; rolls: Random; scenery: Random } | undefined;
  private replay: Replay | undefined;
  // The projected road, drawn a row at a time into pixels, then uploaded to its texture.
  private road: { pixels: Uint32Array; raster: RoadRaster; upload: () => void } | undefined;
  // Each road strip's look and each backdrop's bottom row, read once from their textures.
  private roadLooks = new Map<string, RoadLook>();
  private bandRows = new Map<string, Uint32Array | null>();
  private runTimeMs = 0;
  private settings: Settings | undefined;
  private setup: RunSetup | undefined;
  private stinky: GameObjects.Sprite | undefined;
  private stopSprites: { key: string; sprites: GameObjects.Sprite[] } = { key: "", sprites: [] };
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
    const picked = this.pickedLoadout(setup);
    // The log names the pack and gear walked, so its replay does not read the saved loadout.
    this.inputLog = startInputLog({
      ...setup,
      gear: picked.loadout.gear,
      pack: picked.loadout.dogs,
    });
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
    this.packPose = "walk";
    this.pendingInputs = [];
    this.pointerId = undefined;
    this.replay = undefined;
    this.runTimeMs = 0;
    this.stopSprites = { key: "", sprites: [] };
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
    this.createRoad(road);
    this.graphics = { leash: this.add.graphics().setDepth(DEPTH.leash) };
    this.drawnLeash = "";
    this.drawnRoad = "";
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
    return walkGeometry(LANE_COUNT, packDogs(run).length, PROJECTION, LAYOUT.road);
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
          this.pendingInputs.push({ direction: action.direction, kind: "lane" });
        }
        return;
      case "pause":
        this.openPause();
        return;
      case "treat":
        if (this.replay === undefined) {
          this.pendingInputs.push({ kind: "treat", slot: action.slot });
        }
        return;
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
    for (const input of this.dueInputs()) {
      if (input.kind === "home") {
        this.headHome(walk);
        return;
      }
      walk =
        input.kind === "lane"
          ? steerWalk(gameData, LANE_COUNT, input.direction, walk)
          : this.treated(input.slot, walk);
      this.log({ ...input, timeMs: this.runTimeMs });
    }
    const step = stepWalk(gameData, this.geometry(walk.run), random.rolls, STEP_MS / 1000, walk);
    this.runTimeMs += STEP_MS;
    this.walk = step.walk;
    this.react(step);
    this.zoneEndPending ||= step.zoneEnded;
    this.cardQueue.push(...step.cards);
    this.continueWalk();
  }

  private dueInputs(): PendingInput[] {
    const replay = this.replay;
    if (replay === undefined) {
      const inputs = this.pendingInputs;
      this.pendingInputs = [];
      return inputs;
    }
    const { due, next } = takeDueInputs(replay.events, replay.next, this.runTimeMs);
    replay.next = next;
    return due;
  }

  // A treat from the dog column, for the dog in slot; an empty slot takes none.
  private treated(slot: number, walk: Walk): Walk {
    const dog = walk.run.pack[slot]?.dog;
    if (dog === undefined) {
      return walk;
    }
    const { change, state: run } = giveTreat(gameData, dog, walk.run);
    this.addChanges(change === null ? [] : [change]);
    return { ...walk, run };
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
      // Drawn once more first, so the road holds still in its standing poses.
      this.draw();
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
    this.draw();
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
        if (this.walk !== undefined) {
          this.headHome(this.walk);
        }
      },
      onResume: resume,
    };
    this.scene.launch(SCENE_KEYS.pause, data);
  }

  // Logged at the run time of the step it comes before, which is where a replay applies it.
  private headHome(walk: Walk): void {
    this.log({ kind: "home", timeMs: this.runTimeMs });
    this.walk = { ...walk, run: headHome(walk.run) };
    this.endWalk();
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

  // While a card or the pause menu holds the walk, the road's sprites stand still.
  private draw(): void {
    const walk = this.walk;
    const graphics = this.graphics;
    if (walk === undefined || graphics === undefined) {
      return;
    }
    const zone = this.zone(walk.run);
    const shadowColor = colorFromHex(zone.roadShadowColor);
    const halted = !this.walking();
    this.drawBackdrop(walk, zone);
    this.paintRoad(walk, zone);

    this.shadowsUsed = 0;
    const shadow: Shadow = (look, x, footY, step) =>
      this.placeShadow(shadowColor, look, x, footY, step);
    this.drawItems(walk, halted, shadow);
    this.drawForcedStop(walk, halted, shadow);
    this.drawPack(walk, halted, shadow, graphics.leash);
    this.shadows.slice(this.shadowsUsed).forEach((image) => image.setVisible(false));
  }

  // A shadow under a sprite, centred on its x a pixel above its feet, from the pool. It
  // shrinks with the sprite's depth step.
  private placeShadow(
    color: number,
    look: DepthLook,
    x: number,
    footY: number,
    step: ScaleStep,
  ): void {
    const width = spriteMetrics(look.key).opaqueWidth * look.scale;
    const { anchor, key: texture } = shadowTexture(this, color, width, step);
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
    const ball = ballAt(walk.run.zoneDistance / walkScrollSpeed(gameData, walk.run), still);
    gags.ball.setVisible(ball !== null);
    if (ball !== null) {
      gags.ball.setPosition(ball.x, backdrop.y + ball.y);
      playTag(gags.ball, GAG_KEYS.ball, "roll", still);
    }
  }

  // The zone's gags from its row of the table: a cat on its perch, its sprinklers and the
  // ball.
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
      ball: add(GAG_KEYS.ball, 0, 0),
      cat: left === null ? null : { sprite: add(GAG_KEYS.cat, left, GAG_Y.cat), x: left },
      sprinklers: table.sprinklers.map((x) =>
        add(GAG_KEYS.sprinkler, x - GAG_SIZES.sprinkler.width / 2, GAG_Y.sprinkler),
      ),
    };
  }

  // One texture the size of the road, kept across runs, that the road is drawn into. Under
  // WebGL its pixel buffer uploads straight to the GPU; the Canvas renderer, which cannot draw
  // a buffer, gets a canvas texture instead.
  private createRoad(road: { height: number; width: number; x: number; y: number }): void {
    const raster = roadRaster(PROJECTION, road);
    this.road = undefined;
    if (this.renderer.type === WEBGL) {
      const texture = this.textures.exists(ROAD_TEXTURE)
        ? this.textures.get(ROAD_TEXTURE)
        : this.textures.addUint8Array(
            ROAD_TEXTURE,
            new Uint8Array(road.width * road.height * 4),
            road.width,
            road.height,
          );
      const source = texture?.source[0];
      if (source?.source instanceof Uint8Array) {
        const pixels = new Uint32Array(source.source.buffer);
        this.road = { pixels, raster, upload: () => source.update() };
      }
    } else {
      const canvas = this.textures.exists(ROAD_TEXTURE)
        ? (this.textures.get(ROAD_TEXTURE) as Textures.CanvasTexture)
        : this.textures.createCanvas(ROAD_TEXTURE, road.width, road.height);
      if (canvas !== null) {
        const image = canvas.getContext().createImageData(road.width, road.height);
        const upload = () => {
          canvas.getContext().putImageData(image, 0, 0);
          canvas.refresh();
        };
        this.road = { pixels: new Uint32Array(image.data.buffer), raster, upload };
      }
    }
    this.add.image(road.x, road.y, ROAD_TEXTURE).setOrigin(0).setDepth(DEPTH.road);
  }

  // The zone's road strip and verge, projected row by row; at a zone's start, its start strip
  // rolls in from the far edge over the previous zone's road. Without the art, the zone's
  // colour.
  private paintRoad(walk: Walk, zone: Zone): void {
    const road = this.road;
    if (road === undefined) {
      return;
    }
    const scroll = this.distanceBeforeZone + walk.run.zoneDistance;
    const fade = this.registry.get(DEV_ROAD_FADE_KEY) === true;
    const drawn = `${scroll}|${zone.id}|${fade}`;
    if (drawn === this.drawnRoad) {
      return;
    }
    this.drawnRoad = drawn;
    const previous = gameData.world.zones[walk.run.zoneIndex - 1];
    const startKey = roadStartKey(zone);
    const transition =
      previous !== undefined &&
      this.textures.exists(startKey) &&
      this.textures.exists(roadTileKey(previous))
        ? {
            previous: this.roadLook(previous, roadTileKey(previous)),
            start: this.roadLook(zone, startKey),
          }
        : null;
    drawRoad(
      road.raster,
      {
        current: this.roadLook(zone, roadTileKey(zone)),
        fade: fade ? this.bandRow(zone) : null,
        scroll,
        transition,
        zoneStart: this.distanceBeforeZone,
      },
      road.pixels,
    );
    road.upload();
  }

  private roadLook(zone: Zone, key: string): RoadLook {
    let look = this.roadLooks.get(key);
    if (look === undefined) {
      const image = this.imagePixels(key);
      const fits = image?.width === STRIP.width && image.height === STRIP.height;
      const strip = fits ? image : solidStrip(colorFromHex(zone.roadColor));
      look = { strip: stripLevels(strip), zone: zone.id as RoadLook["zone"] };
      this.roadLooks.set(key, look);
    }
    return look;
  }

  // The backdrop's bottom row across the road, which the far road fades into.
  private bandRow(zone: Zone): Uint32Array | null {
    const key = backdropKey(zone);
    let row = this.bandRows.get(key);
    if (row === undefined) {
      const image = this.imagePixels(key);
      const { road } = LAYOUT;
      const start = image === null ? 0 : (image.height - 1) * image.width + road.x;
      row = image === null ? null : image.pixels.slice(start, start + road.width);
      this.bandRows.set(key, row);
    }
    return row;
  }

  // A loaded image's pixels, read once through a canvas.
  private imagePixels(key: string): PixelImage | null {
    if (!this.textures.exists(key)) {
      return null;
    }
    const source = this.textures.get(key).getSourceImage();
    if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) {
      return null;
    }
    const { height, width } = source;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) {
      return null;
    }
    context.drawImage(source, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);
    return { height, pixels: new Uint32Array(data.buffer), width };
  }

  // Each item's sprites stand on the road through the projection, at the depth step of where
  // they stand, using a hand-drawn variant for the step when the art has one.
  private drawItems(walk: Walk, halted: boolean, shadow: Shadow): void {
    const seen = new Set<number>();
    const still = this.reducedMotion();
    const tags = halted ? ITEM_TAGS.halted : ITEM_TAGS.walking;
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.items.get(item.id) ?? this.addItemView(item);
      const first = itemAt(this.laneXs, item.lane);
      const laneX = (first + itemAt(this.laneXs, item.lane + item.laneSpan - 1)) / 2;
      for (const part of view.parts) {
        const distance = PROJECTION.footY - part.footY(item);
        const placed = project(PROJECTION, { distance, x: laneX + part.dx });
        const step = snapScale(placed.scale);
        const look = depthLook(this, part.key, step);
        showDepthLook(part.sprite, look, part.feet);
        const x = Math.round(placed.x);
        const y = Math.round(placed.y);
        part.sprite.setPosition(x, y);
        const tag = firstTag(this, look.key, tags);
        if (tag !== undefined) {
          playTag(part.sprite, look.key, tag, still);
        }
        if (part.flat) {
          // Foreshortened like the road it lies on: as long on screen as its rows of road.
          const length = spriteMetrics(part.key).frameHeight;
          const far = project(PROJECTION, { distance: distance + length, x: laneX }).y;
          const scaleY = (placed.y - far) / spriteMetrics(look.key).frameHeight;
          part.sprite.setScale(look.scale, scaleY).setDepth(DEPTH.decal);
        } else {
          part.sprite.setDepth(DEPTH.sprite + placed.y);
          shadow(look, x, y, step);
        }
      }
    }
    for (const [id, view] of this.items) {
      if (!seen.has(id)) {
        view.parts.forEach(({ sprite }) => sprite.destroy());
        this.items.delete(id);
      }
    }
  }

  // Each item stands at the bottom of its hit box, and a lucky find on its frame's bottom. A
  // puddle lies flat under the rest, a skunk stands in the middle of its spray cloud, which
  // lies flat too, and a parked car stands at the near end of its footprint, past its hit box.
  private addItemView(item: WalkItem): ItemView {
    const bottom = (shown: WalkItem) => shown.y + shown.height;
    const lucky = itemCategory(gameData, item.kind) === "lucky";
    const part = (key: string, overrides: Partial<Omit<ItemPart, "key" | "sprite">> = {}) => {
      const made: ItemPart = {
        dx: 0,
        feet: lucky ? "bottom" : "anchor",
        flat: false,
        footY: bottom,
        key,
        sprite: addStandingSprite(this, key, 0, 0),
        ...overrides,
      };
      if (made.feet === "bottom") {
        made.sprite.setOrigin(0.5, 1);
      }
      return made;
    };
    const flat = { feet: "bottom", flat: true } as const;
    let parts: ItemPart[];
    if (item.kind === "tip" || item.kind === "treat") {
      parts = [part(item.kind)];
    } else if (isMinorObstacle(gameData, item.kind)) {
      const inset = this.walk === undefined ? 0 : this.geometry(this.walk.run).cell.inset;
      const footY = item.kind === "parkedCar" ? (shown: WalkItem) => bottom(shown) + inset : bottom;
      parts = [part(minorObstacleSpriteKey(item.kind), { footY })];
    } else if (item.kind === "skunk") {
      parts = [
        part(SKUNK_CLOUD_KEY, flat),
        part(encounterSpriteKey("skunk"), { footY: (shown) => shown.y + shown.height / 2 + 16 }),
      ];
    } else if (item.kind === "otherDog" && this.textures.exists("other-dog-owner")) {
      parts = [
        part(encounterSpriteKey(item.kind), { dx: -8 }),
        part("other-dog-owner", { dx: 10 }),
      ];
    } else {
      parts = [part(encounterSpriteKey(item.kind), item.kind === "puddle" ? flat : {})];
    }
    const view = { parts };
    this.items.set(item.id, view);
    return view;
  }

  // A forced stop's figure stands in the middle of the road; a construction barrier is
  // repeated across every lane.
  private drawForcedStop(walk: Walk, halted: boolean, shadow: Shadow): void {
    const { road } = LAYOUT;
    const onRoad = walk.road.forcedStopOnRoad;
    if (onRoad === null) {
      this.stopSprites.sprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = { key: "", sprites: [] };
      return;
    }
    const key = forcedStopSpriteKey(onRoad.stop);
    const xs = onRoad.stop === "constructionDetour" ? this.laneXs : [road.x + road.width / 2];
    if (this.stopSprites.sprites.length !== xs.length || this.stopSprites.key !== key) {
      this.stopSprites.sprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = { key, sprites: xs.map(() => addStandingSprite(this, key, 0, 0)) };
    }
    const distance = PROJECTION.footY - (onRoad.y + this.geometry(walk.run).itemHeights.forcedStop);
    const still = this.reducedMotion();
    const tags = halted ? ITEM_TAGS.halted : ITEM_TAGS.walking;
    this.stopSprites.sprites.forEach((sprite, i) => {
      const placed = project(PROJECTION, { distance, x: itemAt(xs, i) });
      const step = snapScale(placed.scale);
      const look = depthLook(this, key, step);
      showDepthLook(sprite, look);
      const tag = firstTag(this, look.key, tags);
      if (tag !== undefined) {
        playTag(sprite, look.key, tag, still);
      }
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      sprite.setPosition(x, y).setDepth(DEPTH.sprite + placed.y);
      shadow(look, x, y, step);
    });
  }

  // The walker stands on the feet line at scale 1; each dog stands where the projection puts
  // its place in the formation. While the walk is held, they stand idle.
  private drawPack(walk: Walk, halted: boolean, shadow: Shadow, leash: GameObjects.Graphics): void {
    const walkerX = Math.round(laneMotionX(this.laneXs, walk.road.control.motion));
    const footY = PROJECTION.footY;
    const walking = packDogs(walk.run);
    const placements = packPlacements(walking.length);
    const leashColor = colorFromHex(this.zone(walk.run).leashColor);
    const leashKey = `${walkerX}|${walking.join()}|${leashColor}`;
    const redrawLeash = leashKey !== this.drawnLeash;
    if (redrawLeash) {
      this.drawnLeash = leashKey;
      leash.clear();
    }
    const still = this.reducedMotion();
    const pose = halted ? "idle" : "walk";
    const posed = pose !== this.packPose;
    this.packPose = pose;
    for (const [dog, sprite] of this.dogSprites) {
      const index = walking.indexOf(dog);
      sprite.setVisible(index >= 0);
      if (index < 0) {
        continue;
      }
      const placement = itemAt(placements, index);
      const placed = project(PROJECTION, {
        distance: -placement.footDy,
        x: walkerX + placement.dx,
      });
      const step = snapScale(placed.scale);
      const look = depthLook(this, dogSpriteKey(dog), step);
      showDepthLook(sprite, look);
      if (posed) {
        playTag(sprite, look.key, pose, still && halted);
      }
      const x = Math.round(placed.x);
      const dogFoot = Math.round(placed.y);
      sprite.setPosition(x, dogFoot).setDepth(DEPTH.sprite + dogFoot);
      shadow(look, x, dogFoot, step);
      if (redrawLeash) {
        const hand = leashHand(placement);
        drawPixelLine(
          leash,
          leashColor,
          { x: walkerX + hand.dx, y: footY + hand.dy },
          { x, y: dogFoot - Math.round(COLLAR_HEIGHT * step) },
        );
      }
    }
    const walker = this.walker;
    if (walker !== undefined) {
      walker.sprite.setPosition(walkerX, footY).setDepth(DEPTH.sprite + footY);
      if (posed) {
        playTag(walker.sprite, walker.key, pose, still && halted);
      }
      shadow({ key: walker.key, scale: 1 }, walkerX, footY, 1);
    }
    // Dizzy stars circle the walker's head for as long as a stumble locks steering.
    this.stumbling &&= isSteeringLocked(walk.road.control);
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
