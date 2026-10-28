import { BlendModes, type GameObjects, type Scene } from "phaser";

import { gameData } from "../../data";
import type { ZoneId } from "../../data/types";
import { distanceAtY } from "../../layout/projection";
import {
  newLightPlaces,
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
// sprite, scaled with its anchor's depth and faded in with the scenery from the juncture.
// Cosmetic only.
export class LightsView {
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
    this.sprites = this.places.map(() =>
      scene.add
        .sprite(0, 0, "__DEFAULT")
        .setVisible(false)
        .setBlendMode(BlendModes.ADD)
        .setDepth(DEPTH.light),
    );
  }

  // The zone being walked and the one before it (null in the first); zoneStart is the road
  // distance from the walk's start where the current zone began, and scroll the road distance
  // at the walker's feet.
  draw(current: ZoneId, previous: ZoneId | null, zoneStart: number, scroll: number): void {
    const { frame, places, sprites } = this;
    frame.current = current;
    frame.previous = previous;
    frame.currentStart = zoneStart;
    frame.previousStart = zoneStart - zoneLength(gameData);
    frame.scroll = scroll;
    const count = placeVergeLights(this.stage, frame, places);
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const place = places[i];
      const baked = place === undefined ? undefined : this.baked.get(place.key);
      const shown = i < count && sprite !== undefined && place !== undefined && baked !== undefined;
      sprite?.setVisible(shown);
      if (!shown) {
        continue;
      }
      const y = Math.round(place.y);
      sprite
        .setTexture(lightTextureKey(place.key))
        .setOrigin(baked.originX, baked.originY)
        .setScale(place.scale)
        .setPosition(Math.round(place.x), y);
      showOnRoad(y, sceneryFade(y), sprite);
    }
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
