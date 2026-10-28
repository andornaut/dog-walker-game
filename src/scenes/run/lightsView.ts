import { BlendModes, GameObjects, type Scene } from "phaser";

import { animationKey } from "../../assets/asepriteAnimations";
import { IDLE_TAG } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { ZoneId } from "../../data/types";
import { distanceAtY } from "../../layout/projection";
import { getOrInsertComputed } from "../../lib/maps";
import {
  anchorSprite,
  type LightAnchor,
  newAttachedLightPlaces,
  newLightPlaces,
  placeAttachedLights,
  placeVergeLights,
  VERGE_LIGHT_LIMIT,
  type VergeLightFrame,
  type VergeLightStage,
} from "../../road/lightPlaces";
import {
  type BakedLight,
  bakeLight,
  LIGHT_ATTACHMENTS,
  LIGHTS,
  lightTextureKey,
} from "../../road/lights";
import { zoneLength } from "../../runner/walk";
import { spriteMetrics } from "../sprites";
import { DEPTH, JUNCTURE_Y, LAYOUT, PROJECTION, sceneryFade, showOnRoad } from "./stage";

// The lights' sprites: each light def baked once into a texture of its stepped rings, drawn
// with an additive blend over the road, the backdrop's approach and the shadows and under every
// sprite, scaled with its anchor's depth. The verges' lights stand along the road, faded in with
// the scenery from the juncture. The rest follow every sprite of a key that carries lights,
// whichever view drew it this frame: at its feet, scale and flip, at its own opacity times their
// pulse's strength, just under it, and cut off at the juncture as it is, while a band mover's
// stay whole. Cosmetic only.
export class LightsView {
  private readonly anchors: LightAnchor[] = [];
  private readonly attached = newAttachedLightPlaces();
  private readonly attachedSprites: GameObjects.Sprite[];
  private readonly baked = new Map<string, BakedLight>();
  // Each texture key's art key (its depth step's suffix dropped), and its idle tag's frames by
  // name.
  private readonly baseKeys = new Map<string, string>();
  private readonly carriers: GameObjects.Sprite[] = [];
  private readonly frame: VergeLightFrame = {
    current: "park",
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
  };
  private readonly idleFrames = new Map<string, ReadonlyMap<string, number>>();
  private readonly places = newLightPlaces(VERGE_LIGHT_LIMIT);
  private readonly scene: Scene;
  private readonly sprites: GameObjects.Sprite[];
  private readonly stage: VergeLightStage = {
    projection: PROJECTION,
    reach: distanceAtY(PROJECTION, JUNCTURE_Y),
    width: LAYOUT.roadView.width,
  };

  constructor(scene: Scene) {
    this.scene = scene;
    for (const [key, def] of LIGHTS) {
      const light = bakeLight(def);
      this.baked.set(key, light);
      bakeTexture(scene, lightTextureKey(key), light);
    }
    const sprite = () =>
      scene.add
        .sprite(0, 0, "__DEFAULT")
        .setVisible(false)
        .setBlendMode(BlendModes.ADD)
        .setDepth(DEPTH.light);
    this.sprites = this.places.map(sprite);
    this.attachedSprites = this.attached.map(sprite);
  }

  // The zone being walked and the one before it (null in the first); zoneStart is the road
  // distance from the walk's start where the current zone began, and scroll the road distance
  // at the walker's feet. Drawn after every other view, so lights follow where their sprites
  // stand this frame.
  draw(current: ZoneId, previous: ZoneId | null, zoneStart: number, scroll: number): void {
    const { attached, frame, places } = this;
    frame.current = current;
    frame.previous = previous;
    frame.currentStart = zoneStart;
    frame.previousStart = zoneStart - zoneLength(gameData);
    frame.scroll = scroll;
    const count = placeVergeLights(this.stage, frame, places);
    this.sprites.forEach((sprite, i) => {
      const place = places[i];
      const y = place?.y ?? 0;
      this.show(sprite, i < count ? place : undefined, 0, DEPTH.light);
      if (i < count) {
        showOnRoad(Math.round(y), sceneryFade(Math.round(y)), sprite);
      }
    });
    const anchors = this.collectAnchors();
    const attachedCount = placeAttachedLights(current, anchors, attached);
    this.attachedSprites.forEach((light, i) => {
      const place = attached[i];
      const carrier = place === undefined ? undefined : this.carriers[place.anchor];
      const shown = i < attachedCount && place !== undefined && carrier !== undefined;
      this.show(
        light,
        shown ? place : undefined,
        place?.rotation ?? 0,
        Math.min(DEPTH.light, (carrier?.depth ?? DEPTH.light) - UNDER),
      );
      if (!shown) {
        return;
      }
      const alpha = carrier.alpha * place.strength;
      if (carrier.depth < DEPTH.road) {
        light.setAlpha(alpha);
        if (light.isCropped) {
          light.setCrop();
        }
      } else {
        showOnRoad(Math.round(place.groundY), alpha, light);
      }
    });
  }

  // Every visible sprite this frame of a key that carries lights, as an anchor, beside the
  // sprite it stands for.
  private collectAnchors(): readonly LightAnchor[] {
    const { anchors, carriers } = this;
    carriers.length = 0;
    for (const object of this.scene.children.list) {
      if (!(object instanceof GameObjects.Sprite) || !object.visible || object.alpha <= 0) {
        continue;
      }
      const textureKey = object.texture.key;
      const key = this.baseKey(textureKey);
      if (!LIGHT_ATTACHMENTS.has(key)) {
        continue;
      }
      const drawn = spriteMetrics(textureKey);
      const anchor = anchors[carriers.length] ?? newAnchor();
      anchors[carriers.length] = anchor;
      anchorSprite(
        PROJECTION.centreX,
        key,
        object,
        {
          feetY: drawn.feetY,
          fullHeight: spriteMetrics(key).frameHeight,
          height: drawn.frameHeight,
          width: drawn.frameWidth,
        },
        this.idleFrame(object, textureKey),
        anchor,
      );
      carriers.push(object);
    }
    anchors.length = carriers.length;
    return anchors;
  }

  private baseKey(textureKey: string): string {
    return getOrInsertComputed(
      textureKey,
      () => textureKey.replace(DEPTH_STEP_SUFFIX, ""),
      this.baseKeys,
    );
  }

  // The place in its idle tag of the frame a sprite shows, or 0 for a frame outside it.
  private idleFrame(sprite: GameObjects.Sprite, textureKey: string): number {
    const frames = getOrInsertComputed(
      textureKey,
      () =>
        new Map(
          (this.scene.anims.get(animationKey(textureKey, IDLE_TAG))?.frames ?? []).map(
            ({ textureFrame }, i) => [String(textureFrame), i],
          ),
        ),
      this.idleFrames,
    );
    return frames.get(sprite.frame.name) ?? 0;
  }

  // Shows a light at its place and depth, or hides it with none.
  private show(
    sprite: GameObjects.Sprite,
    place: { key: string; scale: number; x: number; y: number } | undefined,
    rotation: number,
    depth: number,
  ): void {
    const baked = place === undefined ? undefined : this.baked.get(place.key);
    const shown = place !== undefined && baked !== undefined;
    sprite.setVisible(shown);
    if (!shown) {
      return;
    }
    sprite
      .setTexture(lightTextureKey(place.key))
      .setOrigin(baked.originX, baked.originY)
      .setScale(place.scale)
      .setRotation(rotation)
      .setDepth(depth)
      .setPosition(Math.round(place.x), Math.round(place.y));
  }
}

// A depth step's suffix on its art key, such as "@75".
const DEPTH_STEP_SUFFIX = /@\d+$/;
// How far under its sprite an attached light lies.
const UNDER = 1e-6;

function newAnchor(): LightAnchor {
  return { flipX: false, frame: 0, key: "", leftOfRoad: false, scale: 1, x: 0, y: 0 };
}

// A baked light as a canvas texture, which either renderer can draw.
function bakeTexture(scene: Scene, key: string, light: BakedLight): void {
  const { textures } = scene;
  if (textures.exists(key)) {
    return;
  }
  const canvas = textures.createCanvas(key, light.width, light.height);
  if (canvas === null) {
    return;
  }
  canvas.context.putImageData(new ImageData(light.pixels, light.width, light.height), 0, 0);
  canvas.refresh();
}
