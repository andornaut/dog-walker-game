import { type GameObjects, type Input, Scene, type Textures, WEBGL } from "phaser";

import { itemAt } from "../arrays";
import { traitIconKey } from "../assets/iconKeys";
import {
  backdropKey,
  dogSpriteKey,
  encounterSpriteKey,
  forcedStopSpriteKey,
  minorObstacleSpriteKey,
  MOVER_SPRITES,
  NEED_ART,
  needSpotSpriteKey,
  roadStartKey,
  roadTileKey,
  SKUNK_CLOUD_KEY,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
} from "../assets/spriteKeys";
import { hitCue } from "../audio/sound";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId, EncounterId, HintTrigger, MinorObstacleId, Zone } from "../data/types";
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
} from "../hud/moments";
import { onStrip, stripItems } from "../hud/stateStrip";
import { gameplayAllowed, type RunPause, topBarButtonAt, walkCovered } from "../hud/topBar";
import type { GestureAction, GestureContext } from "../input/gestures";
import { dogSlotForKey, laneDirectionForKey } from "../input/keyBindings";
import {
  idleTrack,
  type PointerSample,
  type PointerTrack,
  trackPointer,
} from "../input/pointerTracking";
import { laneCenterXs, type LaneDirection } from "../layout/lanes";
import { COLLAR_HEIGHT, leashHand, PACK_DEPTH, packPlacements } from "../layout/packFormation";
import { project } from "../layout/projection";
import type { Rect } from "../layout/rect";
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
import { isPhoneSideways, PHONE_EVENTS, startWakeLock, stopWakeLock } from "../pwa";
import { amountText, type Change, type MoneyChange } from "../rules/causes";
import {
  cardFor,
  type CardView,
  type Choice,
  type ChoiceOutcome,
  chooseOption,
  offerFork,
  offerUpgrades,
  openCard,
  type QuipCue,
  quipLine,
} from "../rules/choices";
import { hintFor } from "../rules/hints";
import { currentZone, walkLength, zoneAt } from "../rules/route";
import { giveTreat } from "../rules/treats";
import { read } from "../rules/units";
import { holdForFiring } from "../runner/firingStop";
import { isSteeringLocked } from "../runner/laneControl";
import { laneMotionX } from "../runner/laneMotion";
import { isMoverObstacle, type MoverOnRoad, moverPlace } from "../runner/movers";
import { isNeedSpot, isNeedUrgent, type NeedStep, stepNeeds } from "../runner/needs";
import {
  gestureAfterPulls,
  NO_PULLS,
  pullPose,
  type Pulls,
  type PullStep,
  type PullTargetKind,
  stepPulls,
} from "../runner/pulls";
import type { Random } from "../runner/random";
import { activeStatuses, shownStatus, startStatuses, type StatusMark } from "../runner/statuses";
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
import {
  type AchievementPreview,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "../save/achievementPreview";
import type { RunResult } from "../save/checkpoint";
import { checkpointOf, runResultOf } from "../save/runSlices";
import { packDogs } from "../state/pack";
import { type CardSource, type Loadout, newRun, type RunState } from "../state/runState";
import type { CardSceneData } from "./CardScene";
import { drawPixelLine, fillRect, shadowTexture } from "./draw";
import { trotOffRoad } from "./feedbackMoments";
import { hitLabelOf, playHitMoment } from "./hitMoment";
import {
  type DogSignal,
  dogTop,
  type IconArt,
  iconArt,
  needIcon,
  NeedSignals,
  playPullFail,
} from "./needSignals";
import { colorFromHex, PALETTE } from "./palette";
import type { PauseSceneData } from "./PauseScene";
import { addPixelText } from "./pixelText";
import {
  checkpointRun,
  currentSettings,
  earnedIfBanked,
  finishRun,
  isMuted,
  markHintShown,
  onSettingsChanged,
  runLoadout,
  type Settings,
  shownHints,
} from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import {
  addStandingSprite,
  ensurePlaceholder,
  firstTag,
  playEffect,
  playTag,
  playTagOnce,
  showAtDepth,
  spriteMetrics,
} from "./sprites";
import { StatusOverlays } from "./statusDraw";

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

// An owner's line, said beside their doghouse.
export interface QuipBubble {
  dog: DogId;
  text: string;
}

// Emitted on this scene's events: ChangeLabel[] whenever money or hearts change, a first-time
// hint's text, and QuipBubble[] when owners react.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const QUIPS_EVENT = "quips";
// AchievementId[] when the walk so far has earned badges, for a toast.
export const ACHIEVEMENTS_EVENT = "achievements";

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
// comes out from behind the curb. The road's approach in the band draws over the backdrop,
// under its gags.
const DEPTH = {
  approach: 2400.5,
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
// A mover's cue, in road pixels before projection: its sign inset from the road's edge, or
// down from the far end of the road for a cyclist, and the arrow a sign's width beside it or
// below it on screen.
const CUE = { inset: 10, size: 16, top: 20 };
// The icon of a need spot that shares an obstacle's art floats this high over it, at 1x.
const SPOT_ICON_LIFT = 40;
// An accident's spot is left behind on the road until it is this far behind the walker.
const DECAL_BEHIND = 60;

// One sprite of an item. dx is across the road from the item's centre and footY the flat
// road row it stands on, both in road pixels. feet "bottom" stands it on its frame's bottom
// rather than its anchor. A flat sprite lies on the road, under everything else with no
// shadow. A lifted sprite floats that many pixels, at its scale, over where it stands, with
// no shadow.
interface ItemPart {
  dx: number;
  feet: "anchor" | "bottom";
  flat: boolean;
  footY: (item: WalkItem) => number;
  key: string;
  lift: number;
  sprite: GameObjects.Sprite;
}

interface ItemView {
  parts: ItemPart[];
}

// A shadow under a sprite drawn from key's art steps at depth, its drawn size over its 1x.
type Shadow = (key: string, depth: number, x: number, footY: number) => void;

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

// Road art that may be missing is drawn as a box this tall, as wide as its hit box.
const PLACEHOLDER_HEIGHT = 32;

// The walk: backdrop, road, walker, pack and everything spawned on the road. The simulation
// steps at a fixed rate and stops while a card or the pause menu is up.
// Road pixels the skunk stands behind its cloud's near edge, so it reads as inside the spray.
const SKUNK_IN_CLOUD = 8;

export class RunScene extends Scene {
  private accumulatorMs = 0;
  private achievements: AchievementPreview = NOTHING_PREVIEWED;
  private backdrop: GameObjects.Image | undefined;
  private banner: GameObjects.Container | undefined;
  private cardQueue: CardSource[] = [];
  private cardView: CardView | undefined;
  private changes: Change[] = [];
  private distanceBeforeZone = 0;
  private dizzy: GameObjects.Sprite | undefined;
  private dogSprites = new Map<DogId, GameObjects.Sprite>();
  // Where each walking dog stood last, in road pixels: across the road, and ahead of the walker.
  private dogFeet = new Map<DogId, { distance: number; x: number }>();
  // Accident spots on the road: where they lie across it, and the road scrolled to their row.
  private decals: { scroll: number; sprite: GameObjects.Sprite; x: number }[] = [];
  // The tag each dog's sprite last played.
  private dogTags = new Map<DogId, string>();
  // How long the end screen waits for a final firing or payout.
  private endMoments = { firingSeconds: 0, payoutMs: 0 };
  // Owners who fired you since the walk last stepped, whose moment holds the walk.
  private firedNow: DogId[] = [];
  private gags: Gags | undefined;
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
  private items = new Map<number, ItemView>();
  private laneXs: number[] = [];
  // Fired dogs trotting off the road, drawn by their trot and not with the pack.
  private leaving = new Set<DogId>();
  private needsZonePlan = false;
  private pauseMode: PauseSceneData["mode"] = "menu";
  private pauseOpen = false;
  private packPose: "idle" | "walk" = "walk";
  private pendingInputs: PendingInput[] = [];
  // The press driving the walk's gestures.
  private pointers: PointerTrack = idleTrack;
  private needSignals: NeedSignals | undefined;
  private pulls: Pulls = NO_PULLS;
  private random:
    | {
        cards: Random;
        forks: Random;
        needs: Random;
        quips: Random;
        rolls: Random;
        scenery: Random;
      }
    | undefined;
  private replay: Replay | undefined;
  // The projected road, drawn a row at a time into pixels, then uploaded to its texture.
  private road: { pixels: Uint32Array; raster: RoadRaster; upload: () => void } | undefined;
  // Each road strip's look and each backdrop's bottom row, read once from their textures.
  private roadLooks = new Map<string, RoadLook>();
  private bandRows = new Map<string, Uint32Array | null>();
  private runTimeMs = 0;
  private settings: Settings | undefined;
  private setup: RunSetup | undefined;
  private statusMarks: readonly StatusMark[] = [];
  private statusOverlays: StatusOverlays | undefined;
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
    this.ensureRoadPlaceholders();

    const setup = this.startSetup();
    this.setup = setup;
    this.random = {
      cards: randomStream(setup.seed, "cards"),
      forks: randomStream(setup.seed, "forks"),
      needs: randomStream(setup.seed, "needs"),
      quips: randomStream(setup.seed, "quips"),
      rolls: randomStream(setup.seed, "rolls"),
      scenery: randomStream(setup.seed, "scenery"),
    };
    const picked = this.pickedLoadout(setup);
    const run = withSetupStart(setup, newRun(gameData, picked.dogSlots, picked.loadout));
    // The log names the pack and gear walked and a later start's route, so its replay does
    // not read the saved loadout. Each fork's path is a card choice in its events.
    this.inputLog = startInputLog({
      ...setup,
      gear: picked.loadout.gear,
      pack: picked.loadout.dogs,
      ...(setup.zone === 1 ? {} : { route: run.route }),
    });
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
    this.accumulatorMs = 0;
    this.achievements = NOTHING_PREVIEWED;
    this.cardQueue = [];
    this.cardView = undefined;
    this.changes = [];
    this.distanceBeforeZone = 0;
    this.dogTags = new Map();
    this.endMoments = { firingSeconds: 0, payoutMs: 0 };
    this.firedNow = [];
    this.leaving = new Set();
    this.items = new Map();
    this.needsZonePlan = false;
    this.pauseOpen = false;
    this.packPose = "walk";
    this.pendingInputs = [];
    this.pointers = idleTrack;
    this.dogFeet = new Map();
    this.decals = [];
    this.pulls = NO_PULLS;
    this.replay = undefined;
    this.runTimeMs = 0;
    this.statusMarks = [];
    this.stopSprites = { key: "", sprites: [] };
    this.stumbling = false;
    this.zoneEndPending = false;
    this.zoneShown = -1;
  }

  // A box for each minor obstacle and the skunk's cloud whose art is missing, from its shape
  // in the data.
  private ensureRoadPlaceholders(): void {
    const { cell } = walkGeometry(LANE_COUNT, 1, PROJECTION, LAYOUT.road);
    const add = (key: string, lanes: number) =>
      ensurePlaceholder(this, key, {
        color: PALETTE.slate,
        height: PLACEHOLDER_HEIGHT,
        width: lanes * cell.length - 2 * cell.inset,
      });
    for (const [id, obstacle] of Object.entries(gameData.minorObstacles)) {
      add(minorObstacleSpriteKey(id as MinorObstacleId), obstacle.shape.lanes);
    }
    const skunk = gameData.encounters.skunk;
    add(SKUNK_CLOUD_KEY, skunk.kind === "obstacle" ? skunk.shape.lanes : 1);
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
    const { backdrop, rasterView } = layout;
    this.backdrop = this.add.image(backdrop.x, backdrop.y, "__DEFAULT").setOrigin(0);
    this.backdrop.setDepth(DEPTH.backdrop);
    this.createRoad(rasterView);
    this.graphics = { leash: this.add.graphics().setDepth(DEPTH.leash) };
    this.drawnLeash = "";
    this.drawnRoad = "";
    this.shadows = [];
    this.dogSprites = new Map(
      loadout.dogs.map((dog) => {
        const key = dogSpriteKey(gameData, dog);
        const sprite = addStandingSprite(this, key, 0, 0);
        playTag(sprite, key, "walk");
        return [dog, sprite];
      }),
    );
    this.walker = { key: walkerSprite, sprite: addStandingSprite(this, walkerSprite, 0, 0) };
    playTag(this.walker.sprite, walkerSprite, "walk");
    this.dizzy = this.add.sprite(0, 0, "fx-dizzy").setDepth(DEPTH.fx).setVisible(false);
    this.statusOverlays = new StatusOverlays(this);
    this.needSignals = new NeedSignals(this, DEPTH.fx);
  }

  private listen(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    this.input.on("pointerdown", (pointer: Input.Pointer) => this.onPointer("down", pointer));
    this.input.on("pointermove", (pointer: Input.Pointer) => this.onPointer("move", pointer));
    this.input.on("pointerup", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    this.input.on("pointerupoutside", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    const onBack = () => this.openPause();
    const onHidden = () => {
      this.openPause();
      const walk = this.walk;
      if (walk !== undefined && walk.run.phase.kind !== "ended") {
        void checkpointRun(this, checkpointOf(gameData, walk.run));
      }
    };
    const onSideways = () => this.openPause();
    const onBlur = () => this.dropPress();
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
      affected: this.cardView?.affected ?? [],
      run,
      statuses: this.statuses(run),
      zoneFraction: run.zoneDistance / zoneLength(gameData, run),
    };
  }

  private statuses(run: RunState): StatusMark[] {
    const seconds = read(gameData.tuning, "seconds", "statusVisualSeconds");
    return activeStatuses(seconds, run, this.runTimeMs, this.statusMarks);
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

  // M, P and Escape are the top bar's keys, which the HUD handles.
  private onKey(key: string): void {
    const direction = laneDirectionForKey(key);
    if (direction !== undefined) {
      this.act({ direction, kind: "move" });
      return;
    }
    const slot = dogSlotForKey(SCREEN_CONFIG.dogSlotCount, key);
    if (slot !== undefined) {
      this.act({ kind: "treat", slot });
    }
  }

  // Phaser reports a cancelled touch as a release with wasCanceled set. This scene keeps
  // running while a card or the pause menu covers the walk, and the press is theirs then.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    const walk = this.walk;
    const walking = walk !== undefined && walk.run.phase.kind === "walking";
    const held = !walking || walkCovered(this.runPause());
    const sample: PointerSample = {
      onButton: phase === "down" && topBarButtonAt(pointer.x, pointer.y) !== undefined,
      onStrip:
        phase === "down" &&
        walk !== undefined &&
        onStrip(SCREEN_CONFIG.width, stripItems(gameData, walk.run).length, pointer),
      phase: phase === "up" && pointer.wasCanceled ? "cancel" : phase,
      point: { x: pointer.x, y: pointer.y },
      press: { downTime: pointer.downTime, id: pointer.id },
    };
    const result = trackPointer(this.gestureContext(), held, sample, this.pointers);
    this.pointers = result.track;
    result.actions.forEach((action) => this.act(action));
  }

  // A press under way when a card or the menu opens, or the page loses focus, is dropped:
  // its release may never arrive.
  private dropPress(): void {
    this.pointers = idleTrack;
  }

  // Lane moves wait for the next simulation step, where they are logged.
  private act(action: GestureAction): void {
    const walk = this.walk;
    if (walk === undefined || walk.run.phase.kind !== "walking") {
      return;
    }
    if (action.kind !== "pause" && !gameplayAllowed(this.runPause())) {
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
      // A hint raised as the run starts waits a frame for the HUD it launches. The HUD keeps
      // running while this scene is paused, so the pause menu's hint shows over the menu.
      if (this.scene.isActive(SCENE_KEYS.hud)) {
        this.events.emit(HINT_EVENT, hint);
      } else {
        this.time.delayedCall(0, () => this.events.emit(HINT_EVENT, hint));
      }
    }
  }

  override update(_time: number, delta: number): void {
    if (this.walk === undefined) {
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

  // One fixed step: the inputs due now, the pulls, then the walk.
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
    const geometry = this.geometry(walk.run);
    const pulls = stepPulls(gameData, geometry, STEP_MS / 1000, this.pulls, walk);
    this.reactToPulls(pulls);
    walk = pulls.walk;
    const moving = walk.road.hitStop === null;
    const step = stepWalk(gameData, this.geometry(walk.run), random.rolls, STEP_MS / 1000, walk);
    this.runTimeMs += STEP_MS;
    const spots = step.spots.flatMap(({ kind }) => (isNeedSpot(gameData, kind) ? [kind] : []));
    const needs = stepNeeds(gameData, random.needs, STEP_MS / 1000, moving, spots, step.walk.run);
    this.walk = { ...step.walk, run: needs.run };
    this.react(step);
    this.reactToNeeds(needs);
    this.zoneEndPending ||= step.zoneEnded;
    this.cardQueue.push(...step.cards, ...needs.cards);
    this.holdForFiring();
    this.continueWalk();
  }

  // An owner who just fired you holds the walk while their moment plays, as a hit stop does:
  // the queued cards and the zone end wait for it.
  private holdForFiring(): void {
    const walk = this.walk;
    const fired = this.firedNow;
    this.firedNow = [];
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

  // A treat from the doghouses, for the dog in slot; an empty slot takes none.
  private treated(slot: number, walk: Walk): Walk {
    const dog = walk.run.pack[slot]?.dog;
    if (dog === undefined) {
      return walk;
    }
    const { change, state: run } = giveTreat(gameData, dog, walk.run);
    if (change !== null) {
      // The HUD floats the change's label when the treat lands.
      this.changes.push(change);
      const cue: TreatCue = { dog, labels: changeLabels(gameData, [change]) };
      this.events.emit(TREAT_EVENT, cue);
    }
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

  // A tell barks, a blocked strain that ends without a pull bursts over its dog, and a pull that
  // moved the pack re-anchors the drag. The strain, the bubble and the bark pop are drawn with the pack.
  private reactToPulls(step: PullStep): void {
    this.pulls = step.pulls;
    if (step.tells.length > 0) {
      soundboardOf(this).play("bark");
      this.hint({ kind: "pull" });
    }
    for (const dog of step.failed) {
      const sprite = this.dogSprites.get(dog);
      if (sprite?.visible === true) {
        playPullFail(this, dogTop(sprite), DEPTH.fx);
      }
    }
    this.pointers = {
      ...this.pointers,
      gesture: gestureAfterPulls(step.pulled, this.pointers.gesture),
    };
  }

  // A need met bursts at each met dog's feet, with its changes and the owners' lines; one gone
  // wrong shows its changes, and a Regular dog's accident bursts on the dog and leaves a spot
  // on the road. Their cards are queued with the walk's.
  private reactToNeeds(step: NeedStep): void {
    const still = this.reducedMotion();
    for (const moment of step.moments) {
      const { outcome } = moment;
      if (moment.kind === "met") {
        soundboardOf(this).play("treat");
        for (const dog of moment.dogs) {
          const sprite = this.dogSprites.get(dog);
          if (sprite?.visible === true) {
            const feet = { x: sprite.x, y: sprite.y };
            this.needSignals?.met(feet, moment.need, needIcon(this, moment.need), still);
          }
        }
      } else if (moment.need === "regular") {
        this.accident(moment.dog);
      }
      if (outcome !== null) {
        this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
        this.sayQuips(outcome.quips);
        this.afterOutcome(outcome);
      }
    }
  }

  // The accident plays on the dog's own frame, then its spot lies at the dog's feet.
  private accident(dog: DogId): void {
    const sprite = this.dogSprites.get(dog);
    const feet = this.dogFeet.get(dog);
    const walk = this.walk;
    if (sprite === undefined || feet === undefined || walk === undefined) {
      return;
    }
    playEffect(this, NEED_ART.accident, "play", sprite, sprite.depth + 1)
      ?.setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY);
    if (this.textures.exists(NEED_ART.accidentSpot)) {
      const decal = addStandingSprite(this, NEED_ART.accidentSpot, 0, 0).setDepth(DEPTH.decal);
      playTag(decal, NEED_ART.accidentSpot, "idle", this.reducedMotion());
      const scroll = this.distanceBeforeZone + walk.run.zoneDistance - feet.distance;
      this.decals.push({ scroll, sprite: decal, x: feet.x });
    }
  }

  // Each accident spot lies flat on its row of road, sized by showAtDepth, until it is behind
  // the walker.
  private drawDecals(walk: Walk): void {
    const scroll = this.distanceBeforeZone + walk.run.zoneDistance;
    this.decals = this.decals.filter((decal) => {
      const distance = decal.scroll - scroll;
      if (distance < -DECAL_BEHIND) {
        decal.sprite.destroy();
        return false;
      }
      const placed = project(PROJECTION, { distance, x: decal.x });
      showAtDepth(decal.sprite, NEED_ART.accidentSpot, placed.scale);
      decal.sprite.setPosition(Math.round(placed.x), Math.round(placed.y));
      return true;
    });
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
      const { kind } = gameData.encounters[hit.encounter];
      sound.play(hitCue(kind, hit.encounter));
      if (hit.encounter === "puddle") {
        playEffect(this, "fx-splash", "play", { x: pack.x, y: pack.y - 8 }, DEPTH.fx);
      }
      if (kind === "obstacle") {
        this.stumble();
      }
      this.playHit(hit, step.walk.road.hitStop?.seconds ?? 0);
    }
  }

  // The hit moment over the stop, framed by the road and the backdrop band beside it.
  private playHit(hit: EncounterCard, seconds: number): void {
    const { backdrop, road, roadView } = LAYOUT;
    const pack = this.packPoint();
    playHitMoment(this, {
      caught: hit.affected.flatMap((dog) => this.dogSprites.get(dog) ?? []),
      centre: { x: pack.x, y: pack.y - 20 },
      depth: DEPTH.popup,
      encounter: hit.encounter,
      field: { ...roadView, height: roadView.y + roadView.height - backdrop.y, y: backdrop.y },
      kind: gameData.encounters[hit.encounter].kind,
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
      const key = dogSpriteKey(gameData, dog);
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
      this.firedNow.push(...outcome.fired);
      outcome.fired.forEach((dog) => this.trotOff(dog));
      if (outcome.state.phase.kind === "ended") {
        this.endMoments.firingSeconds = firingSeconds();
      }
    }
    for (const { debuff } of outcome.state.debuffs) {
      this.hint({ debuff, kind: "debuff" });
    }
  }

  // The fired dog trots off the road over the firing's hold.
  private trotOff(dog: DogId): void {
    const sprite = this.dogSprites.get(dog);
    if (sprite === undefined || !sprite.visible) {
      return;
    }
    this.leaving.add(dog);
    const trot = { road: LAYOUT.roadView, seconds: firingSeconds(), still: this.reducedMotion() };
    trotOffRoad(this, trot, sprite, () => {
      this.leaving.delete(dog);
      sprite.setVisible(false);
    });
  }

  // Badges the walk so far would earn on heading home toast in the HUD; nothing is awarded
  // until the walk is banked.
  private previewAchievements(run: RunState): void {
    const earned = (result: RunResult) => earnedIfBanked(this, result);
    const preview = previewAchievements(gameData, earned, this.achievements, run);
    this.achievements = preview.preview;
    if (preview.earned.length > 0) {
      this.events.emit(ACHIEVEMENTS_EVENT, preview.earned);
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
    this.previewAchievements(walk.run);
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
  }

  // Pays the zone's fees, saves a checkpoint, then offers the upgrades and the fork before
  // the next zone is planned.
  private endZone(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const { fees, run } = finishZone(gameData, walk.run);
    this.payOut(fees, walk.run);
    this.walk = { ...walk, run };
    if (run.phase.kind !== "ended") {
      this.distanceBeforeZone += zoneLength(gameData, walk.run);
      void checkpointRun(this, checkpointOf(gameData, run));
      this.needsZonePlan = true;
      this.cardQueue.push(
        {
          kind: "upgradeOffer",
          offered: offerUpgrades(gameData, this.random?.cards ?? Math.random, run),
        },
        offerFork(gameData, this.random?.forks ?? Math.random, run),
      );
    }
    this.continueWalk();
  }

  // Each fee flies as a coin from its doghouse to the bank while its amount rises over the
  // doghouse.
  private payOut(fees: readonly MoneyChange[], run: RunState): void {
    this.changes.push(...fees);
    const cues = fees.flatMap((fee): PayoutCue[] =>
      fee.dog === null
        ? []
        : [{ amount: fee.amount, dog: fee.dog, text: amountText("money", fee.amount) }],
    );
    this.events.emit(PAYOUT_EVENT, cues);
    if (run.zoneIndex >= walkLength(gameData) - 1) {
      this.endMoments.payoutMs = payoutMs(payoutFlights(cues, run.pack, this.reducedMotion()));
    }
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
    this.dropPress();
    this.cardHints(source);
    const replayed = this.replayedChoice();
    if (replayed !== undefined) {
      this.choose(view, replayed);
      return;
    }
    const sound = soundboardOf(this);
    sound.play("cardOpen");
    sound.setCardOpen(true);
    const data: CardSceneData = { onChoose: (choice) => this.choose(view, choice), view };
    this.scene.launch(SCENE_KEYS.card, data);
  }

  private cardHints(source: CardSource): void {
    if (source.kind === "upgradeOffer" || source.kind === "fork") {
      return;
    }
    if (source.kind === "forcedStop") {
      this.hint({ kind: "forcedStop" });
    } else if (source.kind === "encounter") {
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
    const at = { timeMs: this.runTimeMs, zoneIndex: walk.run.zoneIndex };
    this.statusMarks = startStatuses(gameData, view, at, choice, this.statusMarks);
    this.walk = { ...walk, run: outcome.state };
    this.cardView = undefined;
    this.scene.stop(SCENE_KEYS.card);
    soundboardOf(this).setCardOpen(false);
    this.addChanges([...outcome.heartChanges, ...outcome.moneyChanges]);
    this.sayQuips(outcome.quips);
    this.afterOutcome(outcome);
    this.holdForFiring();
    this.continueWalk();
  }

  // Each owner who reacted says one of their lines beside their doghouse; an owner who fired
  // you says theirs in the firing moment.
  private sayQuips(quips: readonly QuipCue[]): void {
    const random = this.random?.quips ?? Math.random;
    const lines = quips.map((cue) => ({ cue, text: quipLine(gameData, random, cue) }));
    const bubbles = lines.flatMap(({ cue, text }): QuipBubble[] =>
      cue.moment === "fired" ? [] : [{ dog: cue.dog, text }],
    );
    if (bubbles.length > 0) {
      this.events.emit(QUIPS_EVENT, bubbles);
    }
    for (const { cue, text } of lines) {
      if (cue.moment === "fired") {
        const firing: FiringCue = { dog: cue.dog, line: text, seconds: firingSeconds() };
        this.events.emit(FIRING_EVENT, firing);
      }
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

  // What holds the walk still, for the HUD's top bar and for lane moves and treats.
  runPause(): RunPause {
    return {
      card: this.cardView !== undefined,
      hitStop: this.walk?.road.hitStop != null,
      menu: this.pauseMenuState(),
    };
  }

  private pauseMenuState(): RunPause["menu"] {
    if (!this.pauseOpen) {
      return "closed";
    }
    if (this.scene.isActive(SCENE_KEYS.help)) {
      return "help";
    }
    if (this.scene.isActive(SCENE_KEYS.settings)) {
      return "settings";
    }
    return this.pauseMode === "homeQuestion" ? "confirmHome" : "open";
  }

  // The pause menu, or the Home button's question, over the walk or over the card that holds
  // it. The walk steps only while walking, so the menu stops it without pausing this scene:
  // sprite animations loop on, while tweens and timers stop, keeping a hit moment in step
  // with its hit stop. The card under the menu pauses. The HUD keeps running, so the top
  // bar's buttons work and redraw. Asked while the menu is up, the question replaces it.
  openPause(mode: PauseSceneData["mode"] = "menu"): void {
    const walk = this.walk;
    if (walk === undefined || walk.run.phase.kind === "ended") {
      return;
    }
    if (this.pauseOpen) {
      if (mode !== this.pauseMode) {
        this.pauseMode = mode;
        this.scene.get(SCENE_KEYS.pause).scene.restart(this.pauseData());
      }
      return;
    }
    this.pauseOpen = true;
    this.pauseMode = mode;
    this.dropPress();
    this.hint({ kind: "pause" });
    soundboardOf(this).setPaused(true);
    this.tweens.pauseAll();
    this.time.paused = true;
    if (this.cardView !== undefined) {
      this.scene.pause(SCENE_KEYS.card);
    }
    this.scene.launch(SCENE_KEYS.pause, this.pauseData());
  }

  private pauseData(): PauseSceneData {
    return {
      mode: this.pauseMode,
      onHeadHome: () => {
        this.closePause();
        if (this.walk !== undefined) {
          this.headHome(this.walk);
        }
      },
      onResume: () => this.closePause(),
    };
  }

  closePause(): void {
    if (!this.pauseOpen) {
      return;
    }
    this.scene.stop(SCENE_KEYS.pause);
    this.pauseOpen = false;
    soundboardOf(this).setPaused(false);
    this.tweens.resumeAll();
    this.time.paused = false;
    if (this.cardView !== undefined) {
      this.scene.resume(SCENE_KEYS.card);
    }
  }

  // Logged at the run time of the step it comes before, which is where a replay applies it.
  private headHome(walk: Walk): void {
    this.log({ kind: "home", timeMs: this.runTimeMs });
    this.walk = { ...walk, run: headHome(walk.run) };
    this.endWalk();
  }

  // Saves the walk and its input log, then shows the end screen, once a final firing or
  // payout has played.
  private endWalk(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const delayMs = endScreenDelayMs(this.endMoments);
    if (delayMs > 0) {
      this.endMoments = { firingSeconds: 0, payoutMs: 0 };
      this.time.delayedCall(delayMs, () => this.endWalk());
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
    return currentZone(gameData, run);
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
    const shadow: Shadow = (key, depth, x, footY) =>
      this.placeShadow(shadowColor, key, depth, x, footY);
    this.drawItems(walk, halted, shadow);
    this.drawForcedStop(walk, halted, shadow);
    this.drawPack(walk, halted, shadow, graphics.leash);
    this.shadows.slice(this.shadowsUsed).forEach((image) => image.setVisible(false));
  }

  // A shadow under a sprite, centred on its x a pixel above its feet, from the pool. It is
  // sized from the sprite's 1x art at its depth, whichever art step draws it.
  private placeShadow(color: number, key: string, depth: number, x: number, footY: number): void {
    const width = spriteMetrics(key).opaqueWidth * depth;
    const { anchor, key: texture } = shadowTexture(this, color, width, depth);
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
      const band = LAYOUT.backdrop;
      this.backdrop
        .setTexture(this.textures.exists(key) ? key : "__DEFAULT")
        .setCrop(0, 0, band.width, band.height);
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
  // a buffer, gets a canvas texture instead. Its approach rows are a second image of it, over
  // the backdrop.
  private createRoad(road: Rect): void {
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
    const near = road.height - raster.approachRows;
    const image = () => this.add.image(road.x, road.y, ROAD_TEXTURE).setOrigin(0);
    image().setCrop(0, raster.approachRows, road.width, near).setDepth(DEPTH.road);
    image().setCrop(0, 0, road.width, raster.approachRows).setDepth(DEPTH.approach);
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
    const previous =
      walk.run.zoneIndex === 0
        ? undefined
        : zoneAt(gameData, walk.run.route, walk.run.zoneIndex - 1);
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
      const { rasterView } = LAYOUT;
      const start = image === null ? 0 : (image.height - 1) * image.width + rasterView.x;
      row = image === null ? null : image.pixels.slice(start, start + rasterView.width);
      this.bandRows.set(key, row);
    }
    return row;
  }

  // A loaded image's pixels, read once through a canvas from its frame, which in a build is a
  // rect of an atlas page.
  private imagePixels(key: string): PixelImage | null {
    if (!this.textures.exists(key)) {
      return null;
    }
    const { cutHeight: height, cutWidth: width, cutX, cutY, source } = this.textures.getFrame(key);
    const { image } = source;
    if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) {
      return null;
    }
    context.drawImage(image, cutX, cutY, width, height, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return { height, pixels: new Uint32Array(data.buffer), width };
  }

  // Each item's sprites stand on the road through the projection, sized for where they stand
  // by showAtDepth.
  private drawItems(walk: Walk, halted: boolean, shadow: Shadow): void {
    const seen = new Set<number>();
    const still = this.reducedMotion();
    const tags = halted ? ITEM_TAGS.halted : ITEM_TAGS.walking;
    const { roadTop } = this.geometry(walk.run);
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.items.get(item.id) ?? this.addItemView(item);
      if (item.mover !== undefined) {
        this.drawMover(item.mover, view, item.y + item.height, roadTop, halted, shadow);
        continue;
      }
      const first = itemAt(this.laneXs, item.lane);
      const laneX = (first + itemAt(this.laneXs, item.lane + item.laneSpan - 1)) / 2;
      // A need spot, such as the waving stranger, holds its idle frame under reduced motion.
      const itemTags = still && isNeedSpot(gameData, item.kind) ? ITEM_TAGS.halted : tags;
      for (const part of view.parts) {
        const distance = PROJECTION.footY - part.footY(item);
        const placed = project(PROJECTION, { distance, x: laneX + part.dx });
        const drawn = showAtDepth(part.sprite, part.key, placed.scale, part.feet);
        const x = Math.round(placed.x);
        const y = Math.round(placed.y);
        part.sprite.setPosition(x, y - Math.round(part.lift * placed.scale));
        const tag = firstTag(this, drawn.key, itemTags);
        if (tag !== undefined) {
          playTag(part.sprite, drawn.key, tag, still);
        }
        if (part.lift > 0) {
          part.sprite.setDepth(DEPTH.sprite + placed.y + 1);
        } else if (part.flat) {
          part.sprite.setDepth(DEPTH.decal);
        } else {
          part.sprite.setDepth(DEPTH.sprite + placed.y);
          shadow(part.key, drawn.depth, x, y);
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

  // A mover stands on the road through the projection once it moves, sized by showAtDepth, a
  // crosser mirrored when it runs left. Until then only its cue shows, at 1x: a sign at the
  // road's edge on its row with the arrow pointing across, or a cyclist's sign at the top of
  // its lane with the arrow pointing down. The ball carries its own shadow. A mover with an idle
  // tag, the goose, also stands at the edge during its cue, playing it then and while halted.
  private drawMover(
    mover: MoverOnRoad,
    view: ItemView,
    footY: number,
    roadTop: number,
    halted: boolean,
    shadow: Shadow,
  ): void {
    const { road } = LAYOUT;
    const { path } = mover;
    const [body, cue, arrow] = view.parts;
    const place = moverPlace(LANE_COUNT, path, mover.since);
    const still = this.reducedMotion();
    const laneX = itemAt(this.laneXs, 0) + (place.lanePosition * road.width) / LANE_COUNT;
    const leftward = path.motion === "cross" && path.direction === -1;
    const sprite = MOVER_SPRITES[path.mover];
    const idle = "idle" in sprite ? sprite.idle : undefined;
    if (body !== undefined) {
      const shown = place.moving || idle !== undefined;
      body.sprite.setVisible(shown);
      if (shown) {
        const placed = project(PROJECTION, { distance: PROJECTION.footY - footY, x: laneX });
        const { key } = sprite;
        const tag = idle !== undefined && (halted || !place.moving) ? idle : sprite.tag;
        const drawn = showAtDepth(body.sprite, key, placed.scale);
        const x = Math.round(placed.x);
        const y = Math.round(placed.y);
        body.sprite
          .setPosition(x, y)
          .setDepth(DEPTH.sprite + placed.y)
          .setFlipX(leftward);
        playTag(body.sprite, drawn.key, tag, still);
        const cycle = body.sprite.anims.currentAnim?.duration;
        if (path.mover !== "ball") {
          shadow(key, drawn.depth, x, y);
        } else if (cycle !== undefined) {
          const bounce = read(gameData.tuning, "seconds", "ballBounceSeconds");
          body.sprite.anims.timeScale = cycle / (bounce * 1000);
        }
      }
    }
    const edgeX = leftward ? road.x + road.width - CUE.inset : road.x + CUE.inset;
    const cueAt = project(
      PROJECTION,
      path.motion === "cross"
        ? { distance: PROJECTION.footY - footY, x: edgeX }
        : { distance: PROJECTION.footY - (roadTop + CUE.top), x: laneX },
    );
    const x = Math.round(cueAt.x);
    const y = Math.round(cueAt.y);
    cue?.sprite.setVisible(!place.moving).setPosition(x, y).setDepth(DEPTH.fx);
    arrow?.sprite.setVisible(!place.moving).setDepth(DEPTH.fx).setFlipX(leftward);
    if (place.moving) {
      return;
    }
    if (cue !== undefined) {
      playTag(cue.sprite, WARNING_KEY, WARNING_TAG, still);
    }
    if (arrow !== undefined && path.motion === "cross") {
      arrow.sprite.setPosition(x + path.direction * CUE.size, y);
      playTag(arrow.sprite, WARNING_ARROW_KEY, WARNING_TAG, still);
    } else if (arrow !== undefined) {
      arrow.sprite.setPosition(x, y + CUE.size);
      playTag(arrow.sprite, WARNING_ARROW_KEY, WARNING_DOWN_TAG, still);
    }
  }

  // Each item stands once at the near edge of its hit box, however many rows it covers, and a
  // lucky find on its frame's bottom. A puddle lies flat under the rest, and a skunk stands just
  // inside the front of its spray cloud, which lies flat too.
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
        lift: 0,
        sprite: addStandingSprite(this, key, 0, 0),
        ...overrides,
      };
      if (made.feet === "bottom") {
        made.sprite.setOrigin(0.5, 1);
      }
      return made;
    };
    const flat = { flat: true } as const;
    let parts: ItemPart[];
    if (item.mover !== undefined) {
      const body = MOVER_SPRITES[item.mover.path.mover].key;
      parts = [part(body), part(WARNING_KEY), part(WARNING_ARROW_KEY)];
    } else if (isMoverObstacle(item.kind)) {
      parts = [part(MOVER_SPRITES[item.kind].key)];
    } else if (item.kind === "tip" || item.kind === "treat") {
      parts = [part(item.kind)];
    } else if (isNeedSpot(gameData, item.kind)) {
      // A spot whose art is missing stands in as a hydrant. The need's icon floats over a spot
      // that looks like an obstacle, the hydrant and the other dog, and any without its art.
      const art = needSpotSpriteKey(item.kind);
      const key = this.textures.exists(art) ? art : "hydrant";
      const shared = key === "hydrant" || key === encounterSpriteKey("otherDog");
      const icon = needIcon(this, gameData.needSpots[item.kind].need);
      parts = shared
        ? [part(key), part(icon.key, { feet: "bottom", lift: SPOT_ICON_LIFT })]
        : [part(key)];
    } else if (isMinorObstacle(gameData, item.kind)) {
      parts = [part(minorObstacleSpriteKey(item.kind))];
    } else if (item.kind === "skunk") {
      parts = [
        part(SKUNK_CLOUD_KEY, flat),
        part(encounterSpriteKey("skunk"), { footY: (shown) => bottom(shown) - SKUNK_IN_CLOUD }),
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
      const drawn = showAtDepth(sprite, key, placed.scale);
      const tag = firstTag(this, drawn.key, tags);
      if (tag !== undefined) {
        playTag(sprite, drawn.key, tag, still);
      }
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      sprite.setPosition(x, y).setDepth(DEPTH.sprite + placed.y);
      shadow(key, drawn.depth, x, y);
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
    const taut = this.pulls.strain?.dog ?? null;
    const leashKey = `${walkerX}|${walking.join()}|${leashColor}|${taut}`;
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
      if (this.leaving.has(dog)) {
        continue;
      }
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
      const drawn = showAtDepth(sprite, dogSpriteKey(gameData, dog), PACK_DEPTH);
      const x = Math.round(placed.x);
      const dogFoot = Math.round(placed.y);
      this.poseDog(dog, sprite, drawn.key, pose, still && halted, {
        x,
        y: dogFoot - Math.round(spriteMetrics(drawn.key).feetY * drawn.scale),
      });
      sprite.setPosition(x, dogFoot).setDepth(DEPTH.sprite + dogFoot);
      shadow(dogSpriteKey(gameData, dog), drawn.depth, x, dogFoot);
      this.dogFeet.set(dog, { distance: -placement.footDy, x: walkerX + placement.dx });
      if (redrawLeash) {
        const hand = leashHand(placement);
        const from = { x: walkerX + hand.dx, y: footY + hand.dy };
        const to = { x, y: dogFoot - Math.round(COLLAR_HEIGHT * drawn.depth) };
        drawPixelLine(leash, leashColor, from, to);
        if (dog === taut) {
          // A taut leash has a yellow line along its upper-left side.
          const side =
            Math.abs(to.y - from.y) >= Math.abs(to.x - from.x) ? { x: -1, y: 0 } : { x: 0, y: -1 };
          const shift = (point: { x: number; y: number }) => ({
            x: point.x + side.x,
            y: point.y + side.y,
          });
          drawPixelLine(leash, PALETTE.yellow, shift(from), shift(to));
        }
      }
    }
    const walker = this.walker;
    if (walker !== undefined) {
      walker.sprite.setPosition(walkerX, footY).setDepth(DEPTH.sprite + footY);
      if (posed) {
        playTag(walker.sprite, walker.key, pose, still && halted);
      }
      shadow(walker.key, 1, walkerX, footY);
    }
    // Dizzy stars circle the walker's head for as long as a stumble locks steering.
    this.stumbling &&= isSteeringLocked(walk.road.control);
    if (this.dizzy !== undefined) {
      this.dizzy.setVisible(this.stumbling).setPosition(walkerX, footY - 52);
      playTag(this.dizzy, "fx-dizzy", "loop", still);
    }
    const statuses = this.statuses(walk.run);
    const shown = (dog: DogId) => shownStatus(statuses, this.runTimeMs, dog);
    this.statusOverlays?.draw(this.dogSprites, shown, still);
    this.drawSignals(walk, walking);
  }

  // A bubble over each dog that strains or has an urgent need: the need's icon, or what it
  // strains toward, with the dotted line and arrow to it, and the blocked mark while the
  // fairness rule holds the pull back.
  private drawSignals(walk: Walk, walking: readonly DogId[]): void {
    const { strain } = this.pulls;
    const signals = walking.flatMap((dog): DogSignal[] => {
      const sprite = this.dogSprites.get(dog);
      const straining = strain?.dog === dog ? strain : null;
      const urgent = isNeedUrgent(gameData, walk.run, dog);
      if (sprite === undefined || (straining === null && !urgent)) {
        return [];
      }
      return [
        {
          blocked: straining?.blocked === true,
          dog,
          icon: this.signalIcon(dog, straining?.kind ?? "need"),
          target: straining === null ? null : this.itemPoint(straining.itemId),
          top: dogTop(sprite),
          urgent,
        },
      ];
    });
    this.needSignals?.draw(signals, this.reducedMotion());
    this.drawDecals(walk);
  }

  // The icon of what a dog strains toward: its need's, the treat, or the chaser's.
  private signalIcon(dog: DogId, kind: PullTargetKind): IconArt {
    switch (kind) {
      case "need":
        return needIcon(this, gameData.dogs[dog].need);
      case "squirrel":
        return iconArt(this, traitIconKey("chaser"), "S");
      case "treat":
        return iconArt(this, "treat", "T");
      default:
        return kind satisfies never;
    }
  }

  // The middle of an item's sprite on screen: a mover's body once it moves, else its cue.
  private itemPoint(id: number): { x: number; y: number } | null {
    const parts = this.items.get(id)?.parts ?? [];
    const sprite = parts.map(({ sprite: shown }) => shown).find((shown) => shown.visible);
    return sprite === undefined
      ? null
      : { x: sprite.x, y: Math.round(sprite.y - sprite.displayHeight / 2) };
  }

  // A dog leans for its tell and its pull, mirrored for the left, and otherwise takes the
  // pack's pose; the bark pops over its head as the tell starts.
  private poseDog(
    dog: DogId,
    sprite: GameObjects.Sprite,
    key: string,
    pose: string,
    still: boolean,
    head: { x: number; y: number },
  ): void {
    const pull = pullPose(gameData, this.pulls, dog);
    const tag = pull?.tag ?? pose;
    const shown = this.dogTags.get(dog);
    if (tag !== shown) {
      playTag(sprite, key, tag, pull === null ? still : this.reducedMotion());
      this.dogTags.set(dog, tag);
    }
    if (tag === "tell" && shown !== "tell") {
      playEffect(this, "fx-bark", "pop", head, DEPTH.fx);
    }
    sprite.setFlipX(pull?.direction === -1);
  }
}

// A firing holds the walk as long as an encounter's hit stop, read live from the tuning.
function firingSeconds(): number {
  return read(gameData.tuning, "seconds", "hitStopSeconds");
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
