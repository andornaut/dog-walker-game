import type { GameObjects, Scene } from "phaser";

import { itemAt } from "../../arrays";
import { GROWL_ICON_KEY, traitIconKey } from "../../assets/iconKeys";
import { dogSpriteKey, NEED_ART, ROAD_SPRITE_SIZE } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { DogId, NeedId, QuirkId } from "../../data/types";
import {
  COLLAR_HEIGHTS,
  leashHand,
  PACK_DEPTH,
  packPlacements,
  tautLeashLine,
} from "../../layout/packFormation";
import { distanceAtY, project } from "../../layout/projection";
import { currentZone } from "../../rules/route";
import { isSteeringLocked } from "../../runner/laneControl";
import { laneMotionX } from "../../runner/laneMotion";
import { isNeedUrgent, isNervousAlone } from "../../runner/needs";
import { pullPose, type Pulls, type PullTargetKind } from "../../runner/pulls";
import type { StatusMark } from "../../runner/statuses";
import type { Walk } from "../../runner/walk";
import { packDogs } from "../../state/pack";
import { drawPixelLine } from "../draw";
import { FEEDBACK_ART } from "../feedbackArt";
import { trotOffRoad } from "../feedbackMoments";
import {
  type DogSignal,
  dogTop,
  type IconArt,
  iconArt,
  needIcon,
  NeedSignals,
  playPullFail,
} from "../needSignals";
import { colorFromHex, PALETTE } from "../palette";
import {
  addStandingSprite,
  firstTag,
  playEffect,
  playTag,
  playTagOnce,
  showAtDepth,
  spriteMetrics,
} from "../sprites";
import { StatusOverlays } from "../statusDraw";
import { DEPTH, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// The dizzy stars' centre over the walker's feet: 5px over the head of the 1.5-sprite-tall
// walker.
const DIZZY_LIFT = ROAD_SPRITE_SIZE * 1.5 + 5;

// What the pack is drawn with each frame besides the walk.
export interface PackFrame {
  halted: boolean;
  // A road item's middle on screen, for the line a strain points along.
  itemPoint: (id: number) => { x: number; y: number } | null;
  pulls: Pulls;
  shadow: Shadow;
  // Whether animations keep still, from the player's settings.
  still: boolean;
  // The status mark a dog shows, if any.
  statusOf: (dog: DogId) => StatusMark | undefined;
}

// The walker, the dogs on their leashes, and what shows over them: the stumble's dizzy
// stars, each dog's status, its pull and need signals and the bursts over it.
export class PackView {
  // Where each walking dog stood last, in road pixels: across the road, and ahead of the walker.
  private readonly dogFeet = new Map<DogId, { distance: number; x: number }>();
  private readonly dogSprites: Map<DogId, GameObjects.Sprite>;
  // The tag each dog's sprite last played.
  private readonly dogTags = new Map<DogId, string>();
  private readonly dizzy: GameObjects.Sprite;
  // What the leashes were last drawn for, so an unchanged frame skips them.
  private drawnLeash = "";
  private readonly leash: GameObjects.Graphics;
  // Fired dogs trotting off the road, drawn by their trot and not with the pack.
  private readonly leaving = new Set<DogId>();
  private readonly needSignals: NeedSignals;
  private pose: "idle" | "walk" = "walk";
  // Dogs whose quirk pose is due on their next pose, and those whose quirk pose is playing
  // through.
  private readonly poseDue = new Set<DogId>();
  private readonly posing = new Set<DogId>();
  private readonly scene: Scene;
  private readonly statusOverlays: StatusOverlays;
  // Whether the dizzy stars show, for as long as a stumble locks steering.
  private stumbling = false;
  private readonly walker: { key: string; sprite: GameObjects.Sprite };

  constructor(scene: Scene, dogs: readonly DogId[], walkerSprite: string) {
    this.scene = scene;
    this.leash = scene.add.graphics();
    this.dogSprites = new Map(
      dogs.map((dog) => {
        const key = dogSpriteKey(gameData, dog);
        const sprite = addStandingSprite(scene, key, 0, 0);
        playTag(sprite, key, "walk");
        return [dog, sprite];
      }),
    );
    this.walker = { key: walkerSprite, sprite: addStandingSprite(scene, walkerSprite, 0, 0) };
    playTag(this.walker.sprite, walkerSprite, "walk");
    this.dizzy = scene.add.sprite(0, 0, "fx-dizzy").setDepth(DEPTH.fx).setVisible(false);
    this.statusOverlays = new StatusOverlays(scene);
    this.needSignals = new NeedSignals(scene, DEPTH.fx);
  }

  // The dog's centre column and top opaque row on the road, while it is shown there.
  dogPoint(dog: DogId): { x: number; y: number } | undefined {
    const sprite = this.dogSprites.get(dog);
    return sprite?.visible === true ? dogTop(sprite) : undefined;
  }

  walkerSprite(): GameObjects.Sprite {
    return this.walker.sprite;
  }

  // The dogs' sprites shown on the road, of those given.
  sprites(dogs: readonly DogId[]): GameObjects.Sprite[] {
    return dogs.flatMap((dog) => this.dogSprites.get(dog) ?? []);
  }

  // The walker stumbles and the dogs hop; reduced motion skips it.
  stumble(still: boolean): void {
    if (still) {
      return;
    }
    this.posing.clear();
    const { walker } = this;
    playTagOnce(walker.sprite, walker.key, "stumble", () =>
      playTag(walker.sprite, walker.key, "walk"),
    );
    for (const [dog, sprite] of this.dogSprites) {
      const key = dogSpriteKey(gameData, dog);
      playTagOnce(sprite, key, "react", () => playTag(sprite, key, "walk"));
    }
  }

  // The dogs whose quirk just acted play its pose on their next frame.
  quirkActed(dogs: readonly DogId[]): void {
    dogs.forEach((dog) => this.poseDue.add(dog));
  }

  showDizzy(): void {
    this.stumbling = true;
  }

  // A blocked strain that ended without a pull bursts over its dog.
  pullFailed(dogs: readonly DogId[]): void {
    for (const dog of dogs) {
      const sprite = this.dogSprites.get(dog);
      if (sprite?.visible === true) {
        playPullFail(this.scene, dogTop(sprite), DEPTH.fx);
      }
    }
  }

  // Debuffs a treat cured end with a puff over every dog on the road.
  debuffsCured(): void {
    const { key, tag } = FEEDBACK_ART.curePuff;
    for (const sprite of this.dogSprites.values()) {
      if (sprite.visible) {
        playEffect(this.scene, key, tag, dogTop(sprite), DEPTH.fx);
      }
    }
  }

  // A need met bursts at each met dog's feet.
  needMet(dogs: readonly DogId[], need: NeedId, still: boolean): void {
    for (const dog of dogs) {
      const sprite = this.dogSprites.get(dog);
      if (sprite?.visible === true) {
        const feet = { x: sprite.x, y: sprite.y };
        this.needSignals.met(feet, need, needIcon(this.scene, need), still);
      }
    }
  }

  // The accident plays centred on the dog's frame, its bottom on the frame's bottom row, at the
  // dog's scale, whatever the dog's frame size. Returns where the dog last stood, for its spot.
  accident(dog: DogId): { distance: number; x: number } | undefined {
    const sprite = this.dogSprites.get(dog);
    const feet = this.dogFeet.get(dog);
    if (sprite === undefined || feet === undefined) {
      return undefined;
    }
    const bottom = sprite.getBottomCenter();
    playEffect(this.scene, NEED_ART.accident, "play", bottom, sprite.depth + 1)
      ?.setOrigin(0.5, 1)
      .setScale(sprite.scaleX, sprite.scaleY);
    return feet;
  }

  // The fired dog trots off the road over the firing's hold.
  trotOff(dog: DogId, seconds: number, still: boolean): void {
    const sprite = this.dogSprites.get(dog);
    if (sprite === undefined || !sprite.visible) {
      return;
    }
    this.leaving.add(dog);
    const trot = { road: LAYOUT.roadView, seconds, still };
    trotOffRoad(this.scene, trot, sprite, () => {
      this.leaving.delete(dog);
      sprite.setVisible(false);
    });
  }

  // The walker stands on the feet line at scale 1; each dog's feet stand its place in the drawn
  // formation up the screen, across the road where the projection puts that row. While the
  // walk is held, they stand idle.
  draw(walk: Walk, frame: PackFrame): void {
    const { halted, pulls, shadow, still } = frame;
    const { leash } = this;
    const walkerX = Math.round(laneMotionX(LANE_XS, walk.road.control.motion));
    const footY = PROJECTION.footY;
    const walking = packDogs(walk.run);
    const placements = packPlacements(
      spriteMetrics(this.walker.key),
      walking.map((dog) => spriteMetrics(dogSpriteKey(gameData, dog))),
    );
    const leashColor = colorFromHex(currentZone(gameData, walk.run).leashColor);
    const taut = pulls.strain?.dog ?? null;
    const leashKey = `${walkerX}|${walking.join()}|${leashColor}|${taut}`;
    const redrawLeash = leashKey !== this.drawnLeash;
    if (redrawLeash) {
      this.drawnLeash = leashKey;
      leash.clear();
    }
    const pose = halted ? "idle" : "walk";
    const posed = pose !== this.pose;
    this.pose = pose;
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
      const distance = distanceAtY(PROJECTION, footY + placement.footDy);
      const placed = project(PROJECTION, { distance, x: walkerX + placement.dx });
      const drawn = showAtDepth(sprite, dogSpriteKey(gameData, dog), PACK_DEPTH);
      const x = Math.round(placed.x);
      const dogFoot = Math.round(placed.y);
      const alone = isNervousAlone(gameData, walk.run, dog);
      this.poseDog(dog, sprite, drawn.key, { alone, pose }, frame, {
        x,
        y: dogFoot - Math.round(spriteMetrics(drawn.key).feetY * drawn.scale),
      });
      sprite.setPosition(x, dogFoot).setDepth(DEPTH.sprite + dogFoot);
      shadow(dogSpriteKey(gameData, dog), drawn.depth, x, dogFoot);
      this.dogFeet.set(dog, { distance, x: walkerX + placement.dx });
      if (redrawLeash) {
        const hand = leashHand(placement);
        const from = { x: walkerX + hand.dx, y: footY + hand.dy };
        const to = { x, y: dogFoot - Math.round(COLLAR_HEIGHTS[dog] * drawn.depth) };
        drawPixelLine(leash, leashColor, from, to);
        if (dog === taut) {
          const line = tautLeashLine(from, to);
          drawPixelLine(leash, PALETTE.yellow, line.from, line.to);
        }
      }
    }
    const { walker } = this;
    walker.sprite.setPosition(walkerX, footY).setDepth(DEPTH.sprite + footY);
    // The leashes run from the walker's hands up the road to the dogs: under the walker, whose
    // body hides the part behind it, and over the dogs ahead.
    leash.setDepth(DEPTH.sprite + footY - 0.5);
    if (posed) {
      playTag(walker.sprite, walker.key, pose, still && halted);
    }
    shadow(walker.key, 1, walkerX, footY);
    this.stumbling &&= isSteeringLocked(walk.road.control);
    this.dizzy.setVisible(this.stumbling).setPosition(walkerX, footY - DIZZY_LIFT);
    playTag(this.dizzy, "fx-dizzy", "loop", still);
    this.statusOverlays.draw(this.dogSprites, frame.statusOf, still);
    this.drawSignals(walk, walking, frame);
  }

  // A bubble over each dog that strains or has an urgent need: the need's icon, or what it
  // strains toward, with the dotted line and arrow to it, and the blocked mark while the
  // fairness rule holds the pull back.
  private drawSignals(walk: Walk, walking: readonly DogId[], frame: PackFrame): void {
    const { strain } = frame.pulls;
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
          target: straining === null ? null : frame.itemPoint(straining.itemId),
          top: dogTop(sprite),
          urgent,
        },
      ];
    });
    this.needSignals.draw(signals, frame.still);
  }

  // The icon of what a dog strains toward: its need's, the growl at another dog, the treat, or
  // the chaser's.
  private signalIcon(dog: DogId, kind: PullTargetKind): IconArt {
    switch (kind) {
      case "need":
        return needIcon(this.scene, gameData.dogs[dog].need);
      case "otherDog":
        return this.scene.textures.exists(GROWL_ICON_KEY)
          ? iconArt(this.scene, GROWL_ICON_KEY, "G")
          : iconArt(this.scene, traitIconKey("chaser"), "G");
      case "squirrel":
        return iconArt(this.scene, traitIconKey("chaser"), "S");
      case "treat":
        return iconArt(this.scene, "treat", "T");
      default:
        return kind satisfies never;
    }
  }

  // A dog leans for its tell and its pull, mirrored for the left, and otherwise takes the
  // pack's pose; the bark pops over its head as the tell starts. The pack's pose holds still
  // only while the walk is halted. A quirk's pose stands in where the dog's art has it: the
  // nervous lunge for the tell, worried for idle once firings leave her alone, and a quirk pose
  // played through once when the quirk acts.
  private poseDog(
    dog: DogId,
    sprite: GameObjects.Sprite,
    key: string,
    { alone, pose }: { alone: boolean; pose: string },
    frame: PackFrame,
    head: { x: number; y: number },
  ): void {
    const { halted, still } = frame;
    const pull = pullPose(gameData, frame.pulls, dog);
    if (this.poseDue.delete(dog) || pull?.quirkTag === "flourish") {
      this.quirkPose(dog, sprite, key, still);
    }
    if (this.posing.has(dog)) {
      return;
    }
    const base = pull?.tag ?? pose;
    const quirkTag = pull?.quirkTag ?? (base === "idle" && alone ? "worried" : base);
    const tag = firstTag(this.scene, key, [quirkTag]) ?? base;
    const shown = this.dogTags.get(dog);
    if (tag !== shown) {
      playTag(sprite, key, tag, pull === null ? still && halted : still);
      this.dogTags.set(dog, tag);
    }
    if (base === "tell" && shown !== tag) {
      // WOOF! in motion; the plain bark with reduced motion or without the word art.
      const word = !still && firstTag(this.scene, "fx-bark-word", ["pop"]) !== undefined;
      playEffect(this.scene, word ? "fx-bark-word" : "fx-bark", "pop", head, DEPTH.fx);
    }
    sprite.setFlipX(pull?.direction === -1);
  }

  // The dog's quirk pose plays through once, then the dog takes its pose again. Without the
  // art, or with reduced motion, the dog keeps its pose instead.
  private quirkPose(dog: DogId, sprite: GameObjects.Sprite, key: string, still: boolean): void {
    const tag = QUIRK_POSES[gameData.dogs[dog].quirk];
    const art = tag !== undefined && firstTag(this.scene, key, [tag]) !== undefined;
    if (tag === undefined || !art || this.posing.has(dog) || still) {
      return;
    }
    this.posing.add(dog);
    this.dogTags.set(dog, tag);
    playTagOnce(sprite, key, tag, () => {
      this.posing.delete(dog);
      this.dogTags.delete(dog);
    });
  }
}

// The road tag a dog plays through once as its quirk acts: an acrobatic dog's pull or
// playmate, a camera-ready dog's photo op, a ratter's squirrel chase and a scent hound's tip
// from beside the pack.
const QUIRK_POSES: Readonly<Partial<Record<QuirkId, string>>> = {
  acrobatic: "flourish",
  cameraReady: "pose",
  ratter: "pounce",
  scentHound: "sniff",
};
