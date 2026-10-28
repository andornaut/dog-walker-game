import { BlendModes, type GameObjects, type Scene } from "phaser";

import { gameData } from "../../data";
import type { ZoneId } from "../../data/types";
import { distanceAtY } from "../../layout/projection";
import {
  type LightAnchor,
  newAttachedLightPlaces,
  newLightPlaces,
  placeAttachedLights,
  placeVergeLights,
  VERGE_LIGHT_LIMIT,
  type VergeLightFrame,
  type VergeLightStage,
} from "../../road/lightPlaces";
import { type BakedLight, bakeLight, LIGHTS, lightTextureKey } from "../../road/lights";
import { zoneLength } from "../../runner/walk";
import { DEPTH, JUNCTURE_Y, LAYOUT, PROJECTION, sceneryFade, showOnRoad } from "./stage";

// The lights' sprites: each light def baked once into a texture of its stepped rings, drawn
// with an additive blend over the road, the backdrop's approach and the shadows and under every
// sprite, scaled with its anchor's depth and faded in with the scenery from the juncture. The
// verges' lights stand along the road; the rest follow the sprites they are attached to, at
// their pulse's strength. Cosmetic only.
export class LightsView {
  private readonly attached = newAttachedLightPlaces();
  private readonly attachedSprites: GameObjects.Sprite[];
  private readonly baked = new Map<string, BakedLight>();
  private readonly frame: VergeLightFrame = {
    current: "park",
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
  };
  private readonly places = newLightPlaces(VERGE_LIGHT_LIMIT);
  private readonly sprites: GameObjects.Sprite[];
  private readonly stage: VergeLightStage = {
    projection: PROJECTION,
    reach: distanceAtY(PROJECTION, JUNCTURE_Y),
    width: LAYOUT.roadView.width,
  };

  constructor(scene: Scene) {
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
  // distance from the walk's start where the current zone began, scroll the road distance at
  // the walker's feet, and anchors the sprites drawn this frame that may carry lights.
  draw(
    current: ZoneId,
    previous: ZoneId | null,
    zoneStart: number,
    scroll: number,
    anchors: readonly LightAnchor[],
  ): void {
    const { attached, frame, places } = this;
    frame.current = current;
    frame.previous = previous;
    frame.currentStart = zoneStart;
    frame.previousStart = zoneStart - zoneLength(gameData);
    frame.scroll = scroll;
    const count = placeVergeLights(this.stage, frame, places);
    this.sprites.forEach((sprite, i) => {
      const place = places[i];
      this.show(sprite, i < count ? place : undefined, 0, 1, place?.y ?? 0);
    });
    const attachedCount = placeAttachedLights(current, anchors, attached);
    this.attachedSprites.forEach((sprite, i) => {
      const place = attached[i];
      this.show(
        sprite,
        i < attachedCount ? place : undefined,
        place?.rotation ?? 0,
        place?.strength ?? 1,
        place?.groundY ?? 0,
      );
    });
  }

  // Shows a light at its place, or hides it with none: its strength scales its additive blend,
  // and it fades in and is cut off by the row its ground lies on.
  private show(
    sprite: GameObjects.Sprite,
    place: { key: string; scale: number; x: number; y: number } | undefined,
    rotation: number,
    strength: number,
    groundY: number,
  ): void {
    const baked = place === undefined ? undefined : this.baked.get(place.key);
    const shown = place !== undefined && baked !== undefined;
    sprite.setVisible(shown);
    if (!shown) {
      return;
    }
    const ground = Math.round(groundY);
    sprite
      .setTexture(lightTextureKey(place.key))
      .setOrigin(baked.originX, baked.originY)
      .setScale(place.scale)
      .setRotation(rotation)
      .setPosition(Math.round(place.x), Math.round(place.y));
    showOnRoad(ground, sceneryFade(ground) * strength, sprite);
  }
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
