import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { dogSpriteKey, encounterSpriteKey, forcedStopSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { recordWalk, walkResult } from "../home/home";
import { DEFAULT_WALKER, walkerSpriteKeyOf } from "../home/walkers";
import { type ChangeLabel, changeLabels } from "../hud/hudView";
import {
  advanceGesture,
  type GestureAction,
  type GestureContext,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "../input/gestures";
import { dogSlotForKey, isPauseKey, laneDirectionForKey } from "../input/keyBindings";
import { laneCenterXs, laneDividerXs } from "../layout/lanes";
import { COLLAR_HEIGHT, leashHand, packPlacements } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import {
  cardFor,
  type CardView,
  type Choice,
  chooseOption,
  offerUpgrades,
  openCard,
} from "../rules/choices";
import { giveTreat } from "../rules/treats";
import { cents, read } from "../rules/units";
import { laneMotionX } from "../runner/laneMotion";
import { type Random, seededRandom } from "../runner/random";
import {
  finishZone,
  headHome,
  planZone,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkItem,
  zoneLength,
} from "../runner/walk";
import { walkerFootY, walkGeometry } from "../runner/walkGeometry";
import { packDogs } from "../state/pack";
import { type CardSource, type Loadout, newRun, type RunState } from "../state/runState";
import type { CardSceneData } from "./CardScene";
import { drawPixelLine, drawShadow, fillRect } from "./draw";
import type { EndSceneData } from "./EndScene";
import { colorFromHex, LANE_MARK_COLORS, PALETTE } from "./palette";
import type { PauseSceneData } from "./PauseScene";
import { homeProfile, setHomeProfile } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag, spriteMetrics } from "./sprites";

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

// Emitted on this scene's events with ChangeLabel[] whenever money or hearts change.
export const CHANGE_LABELS_EVENT = "change-labels";

const DASH = { length: 12, spacing: 32, width: 2 };
const LONGEST_STEP_SECONDS = 0.1;
const ITEM_TAGS = ["idle", "walk", "wave"];
const DEPTH = { decal: 1, leash: 2000, road: 0, shadow: 2, sprite: 10 };

interface ItemView {
  footY: (item: WalkItem) => number;
  sprites: GameObjects.Sprite[];
}

// The walk: road, walker, pack and everything spawned on the road. Paused while a card or
// the pause menu is up, which stops its scrolling, animations and lane input.
export class RunScene extends Scene {
  private cardQueue: CardSource[] = [];
  private cardView: CardView | undefined;
  private dogSprites = new Map<DogId, GameObjects.Sprite>();
  private gesture: GestureState = idleGesture;
  private graphics?: {
    leash: GameObjects.Graphics;
    road: GameObjects.Graphics;
    shadows: GameObjects.Graphics;
  };
  private items = new Map<number, ItemView>();
  private laneXs: number[] = [];
  private needsZonePlan = false;
  private pointerId: number | undefined;
  private random: Random = Math.random;
  private stopSprites: GameObjects.Sprite[] = [];
  private walk: Walk | undefined;
  private walker: GameObjects.Sprite | undefined;
  private zoneEndPending = false;

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(data: RunSceneData): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    this.laneXs = laneCenterXs(LANE_COUNT, road);
    this.random = seededRandom(Date.now());
    this.cardQueue = [];
    this.cardView = undefined;
    this.zoneEndPending = false;
    this.needsZonePlan = false;
    this.items = new Map();
    this.stopSprites = [];
    this.gesture = idleGesture;
    this.pointerId = undefined;

    const run = newRun(gameData, data.loadout);
    this.walk = planZone(gameData, this.geometry(run), this.random, {
      road: startRoad(LANE_COUNT),
      run,
    });

    this.graphics = {
      leash: this.add.graphics().setDepth(DEPTH.leash),
      road: this.add.graphics().setDepth(DEPTH.road),
      shadows: this.add.graphics().setDepth(DEPTH.shadow),
    };
    this.dogSprites = new Map(
      data.loadout.dogs.map((dog) => {
        const key = dogSpriteKey(dog);
        const sprite = addStandingSprite(this, key, 0, 0);
        playTag(sprite, key, "walk");
        return [dog, sprite];
      }),
    );
    this.walker = addStandingSprite(this, data.walkerSprite, 0, 0);
    playTag(this.walker, data.walkerSprite, "walk");

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    this.input.on("pointerdown", (pointer: Input.Pointer) => this.onPointer("down", pointer));
    this.input.on("pointermove", (pointer: Input.Pointer) => this.onPointer("move", pointer));
    this.input.on("pointerup", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    this.input.on("pointerupoutside", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    // A press that began before a pause belongs to the card or menu, not the road.
    this.events.on("resume", () => {
      this.gesture = idleGesture;
      this.pointerId = undefined;
    });

    this.scene.launch(SCENE_KEYS.hud);
    this.draw();
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

  private geometry(run: RunState): RoadGeometry {
    return walkGeometry(LANE_COUNT, packDogs(run).length, screenLayout(SCREEN_CONFIG).road);
  }

  private gestureContext(): GestureContext {
    const { tuning } = gameData;
    return {
      config: {
        holdDelayMs: read(tuning, "seconds", "holdDelay") * 1000,
        holdRepeatMs: read(tuning, "seconds", "holdRepeat") * 1000,
        swipeMinDistance: read(tuning, "pixels", "swipeMinDistance"),
        tapMaxDistance: read(tuning, "pixels", "tapMaxDistance"),
      },
      layout: screenLayout(SCREEN_CONFIG),
    };
  }

  private onKey(key: string): void {
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

  // Only the first finger down drives the gestures until it lifts; all on the scene clock.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    if (phase === "down" && this.pointerId === undefined) {
      this.pointerId = pointer.id;
    }
    if (pointer.id !== this.pointerId) {
      return;
    }
    const sample = { timeMs: this.time.now, x: pointer.x, y: pointer.y };
    const handler = { down: pointerDown, move: pointerMove, up: pointerUp }[phase];
    const result = handler(this.gestureContext(), sample, this.gesture);
    this.gesture = result.state;
    if (phase === "up") {
      this.pointerId = undefined;
    }
    result.actions.forEach((action) => this.act(action));
  }

  private act(action: GestureAction): void {
    const walk = this.walk;
    if (walk === undefined || walk.run.phase.kind !== "walking") {
      return;
    }
    switch (action.kind) {
      case "move":
        this.walk = steerWalk(gameData, LANE_COUNT, action.direction, walk);
        return;
      case "pause":
        this.openPause();
        return;
      case "treat": {
        const slot = walk.run.pack[action.slot];
        if (slot === undefined) {
          return;
        }
        const run = giveTreat(gameData, slot.dog, walk.run);
        const before = walk.run.pack[action.slot];
        const after = run.pack[action.slot];
        if (before?.status === "walking" && after?.status === "walking") {
          this.emitLabels(
            changeLabels({
              heartChanges:
                before.hearts === after.hearts
                  ? []
                  : [{ after: after.hearts, before: before.hearts, dog: slot.dog }],
              moneyDelta: cents(0),
            }),
          );
        }
        this.walk = { ...walk, run };
        return;
      }
      default:
        action satisfies never;
    }
  }

  private emitLabels(labels: ChangeLabel[]): void {
    if (labels.length > 0) {
      this.events.emit(CHANGE_LABELS_EVENT, labels);
    }
  }

  override update(_time: number, delta: number): void {
    const before = this.walk;
    if (before === undefined) {
      return;
    }
    const gesture = advanceGesture(this.gestureContext(), this.time.now, this.gesture);
    this.gesture = gesture.state;
    gesture.actions.forEach((action) => this.act(action));
    if (this.scene.isPaused()) {
      return;
    }

    const walk = this.walk ?? before;
    const seconds = Math.min(LONGEST_STEP_SECONDS, delta / 1000);
    const step = stepWalk(gameData, this.geometry(walk.run), this.random, seconds, walk);
    this.walk = step.walk;
    const moneyDelta = step.walk.run.money - walk.run.money;
    if (moneyDelta !== 0) {
      this.emitLabels(changeLabels({ heartChanges: [], moneyDelta: cents(moneyDelta) }));
    }
    this.zoneEndPending ||= step.zoneEnded;
    this.cardQueue.push(...step.cards);
    this.draw();
    this.continueWalk();
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
      this.walk = planZone(gameData, this.geometry(walk.run), this.random, walk);
    }
    if (this.scene.isPaused()) {
      this.scene.resume();
    }
  }

  // Pays the zone's fees, then offers the upgrades before the next zone is planned.
  private endZone(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const run = finishZone(gameData, walk.run);
    this.emitLabels(
      changeLabels({ heartChanges: [], moneyDelta: cents(run.money - walk.run.money) }),
    );
    this.walk = { ...walk, run };
    if (run.phase.kind !== "ended") {
      this.needsZonePlan = true;
      this.cardQueue.push({
        kind: "upgradeOffer",
        offered: offerUpgrades(gameData, this.random, run),
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
    if (!this.scene.isPaused()) {
      this.scene.pause();
    }
    const data: CardSceneData = { onChoose: (choice) => this.choose(view, choice), view };
    this.scene.launch(SCENE_KEYS.card, data);
  }

  private choose(view: CardView, choice: Choice): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const outcome = chooseOption(gameData, this.random, walk.run, view, choice);
    this.walk = { ...walk, run: outcome.state };
    this.cardView = undefined;
    this.scene.stop(SCENE_KEYS.card);
    this.emitLabels(changeLabels(outcome));
    this.continueWalk();
  }

  private openPause(): void {
    this.scene.pause();
    const data: PauseSceneData = {
      onHeadHome: () => {
        this.scene.stop(SCENE_KEYS.pause);
        const walk = this.walk;
        if (walk !== undefined) {
          this.walk = { ...walk, run: headHome(walk.run) };
        }
        this.endWalk();
      },
      onResume: () => {
        this.scene.stop(SCENE_KEYS.pause);
        this.scene.resume();
      },
    };
    this.scene.launch(SCENE_KEYS.pause, data);
  }

  // Banks the walk into the profile held for this session and shows the end screen.
  private endWalk(): void {
    const walk = this.walk;
    if (walk === undefined) {
      return;
    }
    const result = walkResult(gameData, walk.run);
    setHomeProfile(this, recordWalk(gameData, result, homeProfile(this)));
    this.walk = undefined;
    for (const key of [SCENE_KEYS.hud, SCENE_KEYS.card, SCENE_KEYS.pause]) {
      this.scene.stop(key);
    }
    const data: EndSceneData = { result };
    this.scene.start(SCENE_KEYS.end, data);
  }

  private draw(): void {
    const walk = this.walk;
    const graphics = this.graphics;
    if (walk === undefined || graphics === undefined) {
      return;
    }
    const { road: roadRect } = screenLayout(SCREEN_CONFIG);
    const zone = itemAt(
      gameData.world.zones,
      Math.min(walk.run.zoneIndex, gameData.world.zones.length - 1),
    );
    const shadowColor = colorFromHex(zone.roadShadowColor);

    graphics.road.clear();
    fillRect(graphics.road, colorFromHex(zone.roadColor), roadRect);
    const markColor = LANE_MARK_COLORS[zone.id] ?? PALETTE.lightGrey;
    const offset = walk.run.zoneDistance % DASH.spacing;
    for (const x of laneDividerXs(LANE_COUNT, roadRect)) {
      for (
        let y = roadRect.y - DASH.spacing + offset;
        y < roadRect.y + roadRect.height;
        y += DASH.spacing
      ) {
        const top = Math.max(roadRect.y, Math.round(y));
        const bottom = Math.min(roadRect.y + roadRect.height, Math.round(y + DASH.length));
        if (bottom > top) {
          fillRect(graphics.road, markColor, {
            height: bottom - top,
            width: DASH.width,
            x: x - 1,
            y: top,
          });
        }
      }
    }

    graphics.shadows.clear();
    const shadow = (key: string, x: number, footY: number) =>
      drawShadow(graphics.shadows, shadowColor, x, footY, spriteMetrics(key).opaqueWidth);
    this.drawItems(walk, shadow);
    this.drawForcedStop(walk, roadRect, shadow);
    this.drawPack(walk, shadow, graphics.leash);
  }

  private drawItems(walk: Walk, shadow: (key: string, x: number, footY: number) => void): void {
    const seen = new Set<number>();
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.items.get(item.id) ?? this.addItemView(item);
      const x = itemAt(this.laneXs, item.lane);
      const footY = view.footY(item);
      view.sprites.forEach((sprite, i) => {
        const spriteX = x + (view.sprites.length > 1 ? (i === 0 ? -8 : 10) : 0);
        sprite.setPosition(Math.round(spriteX), Math.round(footY));
        if (item.kind !== "puddle") {
          sprite.setDepth(DEPTH.sprite + footY);
          shadow(sprite.texture.key, spriteX, footY);
        }
      });
    }
    for (const [id, view] of this.items) {
      if (!seen.has(id)) {
        view.sprites.forEach((sprite) => sprite.destroy());
        this.items.delete(id);
      }
    }
  }

  // Each item stands at the bottom of its collision box; a puddle lies flat under the rest.
  private addItemView(item: WalkItem): ItemView {
    const keys =
      item.kind === "tip" || item.kind === "treat"
        ? [item.kind]
        : item.kind === "otherDog" && this.textures.exists("other-dog-owner")
          ? [encounterSpriteKey(item.kind), "other-dog-owner"]
          : [encounterSpriteKey(item.kind)];
    const sprites = keys.map((key) => {
      const sprite = addStandingSprite(this, key, 0, 0);
      ITEM_TAGS.forEach((tag) => playTag(sprite, key, tag));
      return sprite;
    });
    const view: ItemView = { footY: (shown) => shown.y + shown.height, sprites };
    if (item.kind === "puddle") {
      sprites.forEach((sprite) => sprite.setDepth(DEPTH.decal).setOrigin(0.5, 1));
    }
    this.items.set(item.id, view);
    return view;
  }

  // A forced stop's figure stands in the middle of the road; a construction barrier is
  // repeated across every lane.
  private drawForcedStop(
    walk: Walk,
    roadRect: { width: number; x: number },
    shadow: (key: string, x: number, footY: number) => void,
  ): void {
    const onRoad = walk.road.forcedStopOnRoad;
    if (onRoad === null) {
      this.stopSprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = [];
      return;
    }
    const key = forcedStopSpriteKey(onRoad.stop);
    const xs =
      onRoad.stop === "constructionDetour" ? this.laneXs : [roadRect.x + roadRect.width / 2];
    if (this.stopSprites.length !== xs.length || this.stopSprites[0]?.texture.key !== key) {
      this.stopSprites.forEach((sprite) => sprite.destroy());
      this.stopSprites = xs.map(() => {
        const sprite = addStandingSprite(this, key, 0, 0);
        ITEM_TAGS.forEach((tag) => playTag(sprite, key, tag));
        return sprite;
      });
    }
    const footY = onRoad.y + this.geometry(walk.run).itemHeights.forcedStop;
    this.stopSprites.forEach((sprite, i) => {
      const x = itemAt(xs, i);
      sprite.setPosition(Math.round(x), Math.round(footY)).setDepth(DEPTH.sprite + footY);
      shadow(key, x, footY);
    });
  }

  private drawPack(
    walk: Walk,
    shadow: (key: string, x: number, footY: number) => void,
    leash: GameObjects.Graphics,
  ): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    const walkerX = Math.round(laneMotionX(this.laneXs, walk.road.control.motion));
    const footY = walkerFootY(road);
    const walking = packDogs(walk.run);
    const placements = packPlacements(walking.length);
    leash.clear();
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
      const hand = leashHand(placement);
      drawPixelLine(
        leash,
        PALETTE.darkRed,
        { x: walkerX + hand.dx, y: footY + hand.dy },
        { x, y: dogFoot - COLLAR_HEIGHT },
      );
    }
    this.walker?.setPosition(walkerX, footY).setDepth(DEPTH.sprite + footY);
    shadow(this.walker?.texture.key ?? walkerSpriteKeyOf(DEFAULT_WALKER), walkerX, footY);
    // A pull will play the dog's "tell" tag, mirrored for the left, with fx-bark over its
    // head, and steer through pullLane; dogs do not pull yet.
  }
}
