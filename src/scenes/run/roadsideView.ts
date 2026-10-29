import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../../assets/asepriteAnimations";
import { IDLE_TAG } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { DepthDraw } from "../../layout/depthScale";
import { distanceAtY } from "../../layout/projection";
import { CARRIED_LIGHT_UP, carriedLightReach, distanceBehind } from "../../road/lightPlaces";
import {
  idleFrame,
  newRoadsidePlaces,
  placeRoadside,
  placeRoadsideLights,
  ROADSIDE,
  ROADSIDE_LIGHT_LIMIT,
  type RoadsideFrame,
  type RoadsideLights,
  type RoadsidePlace,
  type RoadsideStage,
} from "../../road/roadsideProps";
import { zoneLength } from "../../runner/walk";
import { showAtDepth, spriteMetrics } from "../sprites";
import { ShadowPool } from "./shadowPool";
import { DEPTH, JUNCTURE_Y, LAYOUT, PROJECTION, ROW_DEPTH, sceneryFade, showOnRoad } from "./stage";

// The roadside props' sprites, a fixed pool made once and reused frame to frame: each drawn
// through the projection from its depth steps like the road's sprites, cut off at the
// juncture, with their zone's ground shadow under the free-standing ones. Cosmetic only.
// A prop whose art step has an idle tag of more than one frame shows the frame idleFrame picks
// on the walk's ambient clock, set each frame rather than played: the pool hands a sprite to
// another prop as props scroll out, and every depth step shows the same frame. A prop whose art
// has left the screen but whose lights may still show stands hidden in a second pool
// (lightCarriers), placed as it would be drawn, so its lights follow it until their own rects
// leave the screen.
export class RoadsideView {
  private readonly carrierPlaces = newRoadsidePlaces(ROADSIDE_LIGHT_LIMIT);
  private readonly carrierSprites: GameObjects.Sprite[];
  private readonly carriers: GameObjects.Sprite[] = [];
  private readonly frame: RoadsideFrame = {
    current: "",
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
  };
  private readonly lights: RoadsideLights = {
    behind: distanceBehind(
      PROJECTION,
      LAYOUT.walkView.y + LAYOUT.walkView.height,
      CARRIED_LIGHT_UP,
    ),
    reach: carriedLightReach,
  };
  // Each art step's idle loop by texture key, null for one with no loop.
  private readonly loops = new Map<string, IdleLoop | null>();
  private readonly places = newRoadsidePlaces();
  private readonly shadows: ShadowPool;
  private readonly sprites: GameObjects.Sprite[];
  private readonly stage: RoadsideStage = {
    frameWidth: (key) => spriteMetrics(key).frameWidth,
    projection: PROJECTION,
    reach: distanceAtY(PROJECTION, JUNCTURE_Y),
    table: ROADSIDE,
    width: LAYOUT.roadView.width,
  };

  constructor(scene: Scene) {
    this.shadows = new ShadowPool(scene);
    const sprite = () =>
      scene.add.sprite(0, 0, "__DEFAULT").setVisible(false).setDepth(DEPTH.roadside);
    this.sprites = this.places.map(sprite);
    this.carrierSprites = this.carrierPlaces.map(sprite);
  }

  // The hidden sprites this frame of props whose art has left the screen but whose lights may
  // still show, each placed, sized, framed and faded as it would be drawn.
  lightCarriers(): readonly GameObjects.Sprite[] {
    return this.carriers;
  }

  // The zone being walked and the one before it (null in the first), by art id; zoneStart is
  // the road distance from the walk's start where the current zone began, and scroll the road
  // distance at the walker's feet; ms is the ambient clock idle loops run on, and still holds
  // each on its first frame.
  draw(
    current: string,
    previous: string | null,
    zoneStart: number,
    scroll: number,
    motion: { ms: number; still: boolean },
  ): void {
    const { carrierPlaces, carriers, frame, places, sprites } = this;
    frame.current = current;
    frame.previous = previous;
    frame.currentStart = zoneStart;
    frame.previousStart = zoneStart - zoneLength(gameData);
    frame.scroll = scroll;
    const count = placeRoadside(this.stage, frame, places);
    const shadow = this.shadows.frameInColours();
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const place = places[i];
      if (sprite === undefined || place === undefined) {
        continue;
      }
      const drawn = i < count ? this.showProp(sprite, place, motion) : null;
      sprite.setVisible(drawn !== null);
      if (drawn !== null && place.shadow !== null) {
        shadow(place.shadow, sprite.alpha, place.key, drawn.depth, sprite.x, sprite.y);
      }
    }
    this.shadows.hideUnused();
    const carried = placeRoadsideLights(this.stage, this.lights, frame, carrierPlaces);
    carriers.length = 0;
    this.carrierSprites.forEach((sprite, i) => {
      const place = carrierPlaces[i];
      sprite.setVisible(false);
      if (i < carried && place !== undefined && this.showProp(sprite, place, motion) !== null) {
        carriers.push(sprite);
      }
    });
  }

  // Places, sizes, frames and fades a prop's sprite as it is drawn, and returns its depth draw,
  // or null for a prop whose art is not loaded.
  private showProp(
    sprite: GameObjects.Sprite,
    place: RoadsidePlace,
    motion: { ms: number; still: boolean },
  ): DepthDraw | null {
    if (!sprite.scene.textures.exists(place.key)) {
      return null;
    }
    const drawn = showAtDepth(sprite, place.key, place.scale);
    const loop = this.loop(sprite.scene, drawn.key);
    if (loop !== null) {
      const shown = loop.frames[idleFrame(motion.still, loop.durations, place.phase, motion.ms)];
      if (shown !== undefined && sprite.frame.name !== shown) {
        sprite.setFrame(shown);
      }
    }
    const y = Math.round(place.y);
    sprite.setPosition(Math.round(place.x), y).setDepth(DEPTH.roadside + y * ROW_DEPTH);
    showOnRoad(y, sceneryFade(y), sprite);
    return drawn;
  }

  // An art step's idle tag as frame names and durations, read once; null with no tag or a
  // one-frame tag, which draws as a still image.
  private loop(scene: Scene, key: string): IdleLoop | null {
    return getOrInsertComputed(
      key,
      () => {
        const frames = scene.anims.get(animationKey(key, IDLE_TAG))?.frames ?? [];
        return frames.length < 2
          ? null
          : {
              durations: frames.map(({ duration }) => duration),
              frames: frames.map(({ textureFrame }) => String(textureFrame)),
            };
      },
      this.loops,
    );
  }
}

interface IdleLoop {
  readonly durations: readonly number[];
  readonly frames: readonly string[];
}
