import type { GameObjects, Scene, Tweens } from "phaser";

import { itemAt } from "../../arrays";
import { SQUIRREL_ICON_KEY } from "../../assets/iconKeys";
import { dogSpriteKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { DogId } from "../../data/types";
import {
  COLLAR_HEIGHTS,
  formationOrder,
  leashHand,
  PACK_DEPTH,
  packDogOf,
  packPlacements,
  tautLeashLine,
} from "../../layout/packFormation";
import { distanceAtY, project } from "../../layout/projection";
import { currentZone } from "../../rules/route";
import { laneMotionX } from "../../runner/laneMotion";
import { pullPose, type Pulls } from "../../runner/pulls";
import type { Walk } from "../../runner/walk";
import { packDogs } from "../../state/pack";
import { playBarkWord } from "../comicWord";
import { drawPixelLine } from "../draw";
import { trotOffRoad } from "../feedbackMoments";
import { colorFromHex, PALETTE } from "../palette";
import { type DogSignal, dogTop, iconArt, playPullFail, PullSignals } from "../pullSignals";
import {
  addStandingSprite,
  playEffect,
  playTag,
  playTagOnce,
  showAtDepth,
  spriteMetrics,
} from "../sprites";
import { DEPTH, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// What the pack is drawn with each frame besides the walk.
export interface PackFrame {
  halted: boolean;
  // A road item's middle on screen, for the line a strain points along.
  itemPoint: (id: number) => { x: number; y: number } | null;
  pulls: Pulls;
  shadow: Shadow;
  // Whether animations keep still, from the player's settings.
  still: boolean;
}

// The walker, the dogs on their leashes, and what shows over them: each dog's pull signals
// and the bursts over it.
export class PackView {
  private readonly dogSprites: Map<DogId, GameObjects.Sprite>;
  // The tag each dog's sprite last played.
  private readonly dogTags = new Map<DogId, string>();
  // What the leashes were last drawn for, so an unchanged frame skips them.
  private drawnLeash = "";
  private readonly leash: GameObjects.Graphics;
  // Fired dogs trotting off the road, drawn by their trot and not with the pack.
  private readonly leaving = new Map<DogId, Tweens.Tween>();
  private pose: "idle" | "walk" = "walk";
  private readonly pullSignals: PullSignals;
  // Sprites playing a one-off reaction, which the pack's pose waits for.
  private readonly reacting = new Set<GameObjects.Sprite>();
  private readonly scene: Scene;
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
    this.pullSignals = new PullSignals(scene, DEPTH.fx);
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

  // The dog's centre column and the row its feet stand on, while it is shown on the road.
  dogFeet(dog: DogId): { x: number; y: number } | undefined {
    const sprite = this.dogSprites.get(dog);
    return sprite?.visible === true ? { x: dogTop(sprite).x, y: sprite.y } : undefined;
  }

  // The walker stumbles and every dog plays tags in order, then each takes the pose the pack
  // has by then; reduced motion skips it.
  stumble(still: boolean, tags: readonly string[]): void {
    if (still) {
      return;
    }
    const { walker } = this;
    this.react(walker.sprite, walker.key, ["stumble"], () =>
      playTag(walker.sprite, walker.key, this.pose),
    );
    this.dogsReact([...this.dogSprites.keys()], tags);
  }

  // Each dog plays tags in order, then takes the pack's pose, a dog trotting off its walk; with
  // no tags it carries on as it was.
  dogsReact(dogs: readonly DogId[], tags: readonly string[]): void {
    if (tags.length === 0) {
      return;
    }
    for (const dog of dogs) {
      const sprite = this.dogSprites.get(dog);
      if (sprite === undefined) {
        continue;
      }
      const key = dogSpriteKey(gameData, dog);
      this.react(sprite, key, tags, () => {
        this.dogTags.delete(dog);
        if (this.leaving.has(dog)) {
          playTag(sprite, key, "walk");
        }
      });
    }
  }

  // The sprite plays tags once each in order, the pack's pose waiting for them, then done.
  private react(
    sprite: GameObjects.Sprite,
    key: string,
    tags: readonly string[],
    done: () => void,
  ): void {
    const [tag, ...rest] = tags;
    if (tag === undefined) {
      this.reacting.delete(sprite);
      done();
      return;
    }
    this.reacting.add(sprite);
    playTagOnce(sprite, key, tag, () => this.react(sprite, key, rest, done));
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

  // The fired dog trots off the road over ms, the firing's hold.
  trotOff(dog: DogId, ms: number, still: boolean): void {
    const sprite = this.dogSprites.get(dog);
    if (sprite === undefined || !sprite.visible) {
      return;
    }
    const trot = { ms, road: LAYOUT.roadView, still };
    const tween = trotOffRoad(this.scene, trot, sprite, () => {
      this.leaving.delete(dog);
      sprite.setVisible(false);
    });
    this.leaving.set(dog, tween);
  }

  // The fired dogs' trots stop while the walk is paused, so each ends with its hold.
  holdTrots(paused: boolean): void {
    for (const [dog, tween] of this.leaving) {
      if (paused === tween.isPaused()) {
        continue;
      }
      const sprite = this.dogSprites.get(dog);
      if (paused) {
        tween.pause();
        sprite?.anims.pause();
      } else {
        tween.resume();
        sprite?.anims.resume();
      }
    }
  }

  // The walker stands on the feet line at scale 1; each dog's feet stand its place in the
  // formation, up the screen and across from where the projection puts the walker's lane on that
  // row, so the pack is drawn as it collides. Lower feet are drawn in front. While the walk is
  // held, they stand idle.
  draw(walk: Walk, frame: PackFrame): void {
    const { halted, pulls, shadow, still } = frame;
    const { leash } = this;
    const walkerX = Math.round(laneMotionX(LANE_XS, walk.road.control.motion));
    const footY = PROJECTION.footY;
    const walking = formationOrder(packDogs(walk.run));
    const placements = packPlacements(PROJECTION, walking.map(packDogOf));
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
      const placed = project(PROJECTION, { distance, x: walkerX });
      const drawn = showAtDepth(sprite, dogSpriteKey(gameData, dog), PACK_DEPTH);
      const x = Math.round(placed.x + placement.dx);
      const dogFoot = Math.round(placed.y);
      this.poseDog(dog, sprite, drawn.key, pose, frame, {
        x,
        y: dogFoot - Math.round(spriteMetrics(drawn.key).feetY * drawn.scale),
      });
      // Of two dogs on one row, the later in formation order is drawn in front.
      sprite.setPosition(x, dogFoot).setDepth(DEPTH.sprite + dogFoot + index / 1000);
      shadow(dogSpriteKey(gameData, dog), drawn.depth, x, dogFoot);
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
    if (posed && !this.reacting.has(walker.sprite)) {
      playTag(walker.sprite, walker.key, pose, still && halted);
    }
    shadow(walker.key, 1, walkerX, footY);
    this.drawSignals(walking, frame);
  }

  // A bubble over the straining dog with the squirrel's icon, the dotted line and arrow to it,
  // and the blocked mark while the fairness rule holds the pull back.
  private drawSignals(walking: readonly DogId[], frame: PackFrame): void {
    const { strain } = frame.pulls;
    const sprite = strain === null ? undefined : this.dogSprites.get(strain.dog);
    const signals: DogSignal[] =
      strain === null || sprite === undefined || !walking.includes(strain.dog)
        ? []
        : [
            {
              blocked: strain.blocked,
              dog: strain.dog,
              icon: iconArt(this.scene, SQUIRREL_ICON_KEY, "S"),
              target: frame.itemPoint(strain.itemId),
              top: dogTop(sprite),
            },
          ];
    this.pullSignals.draw(signals, frame.still);
  }

  // A dog leans for its tell and its pull, mirrored for the left, and otherwise takes the
  // pack's pose; the bark pops over its head as the tell starts. The pack's pose holds still
  // only while the walk is halted.
  private poseDog(
    dog: DogId,
    sprite: GameObjects.Sprite,
    key: string,
    pose: string,
    frame: PackFrame,
    head: { x: number; y: number },
  ): void {
    const { halted, still } = frame;
    const pull = pullPose(gameData, frame.pulls, dog);
    const tag = pull?.tag ?? pose;
    const shown = this.dogTags.get(dog);
    if (tag !== shown && !this.reacting.has(sprite)) {
      playTag(sprite, key, tag, pull === null ? still && halted : still);
      this.dogTags.set(dog, tag);
    }
    if (tag === "tell" && shown !== tag) {
      // The bark word in motion; the plain bark with reduced motion or without font-comic.
      const word = gameData.runText.comicWords.bark;
      if (still || !playBarkWord(this.scene, head, DEPTH.fx, word)) {
        playEffect(this.scene, "fx-bark", "pop", head, DEPTH.fx);
      }
    }
    sprite.setFlipX(pull?.direction === -1);
  }
}
