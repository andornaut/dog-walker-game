import type { GameObjects, Scene } from "phaser";

import { gameData } from "../../data";
import { distanceAtY } from "../../layout/projection";
import {
  newRoadsidePlaces,
  placeRoadside,
  ROADSIDE,
  type RoadsideFrame,
  type RoadsideStage,
} from "../../road/roadsideProps";
import { zoneLength } from "../../runner/walk";
import { showAtDepth, spriteMetrics } from "../sprites";
import { ShadowPool } from "./shadowPool";
import { DEPTH, JUNCTURE_Y, LAYOUT, PROJECTION, ROW_DEPTH, sceneryFade, showOnRoad } from "./stage";

// The roadside props' sprites, a fixed pool made once and reused frame to frame: each drawn
// through the projection from its depth steps like the road's sprites, cut off at the
// juncture, with their zone's ground shadow under the free-standing ones. Cosmetic only.
export class RoadsideView {
  private readonly frame: RoadsideFrame = {
    current: "",
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
  };
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
    this.sprites = this.places.map(() =>
      scene.add.sprite(0, 0, "__DEFAULT").setVisible(false).setDepth(DEPTH.roadside),
    );
  }

  // The zone being walked and the one before it (null in the first), by art id; zoneStart is
  // the road distance from the walk's start where the current zone began, and scroll the road
  // distance at the walker's feet.
  draw(current: string, previous: string | null, zoneStart: number, scroll: number): void {
    const { frame, places, sprites } = this;
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
      const shown = i < count && sprite.scene.textures.exists(place.key);
      sprite.setVisible(shown);
      if (!shown) {
        continue;
      }
      const drawn = showAtDepth(sprite, place.key, place.scale);
      const x = Math.round(place.x);
      const y = Math.round(place.y);
      sprite.setPosition(x, y).setDepth(DEPTH.roadside + y * ROW_DEPTH);
      const alpha = sceneryFade(y);
      showOnRoad(y, alpha, sprite);
      if (place.shadow !== null) {
        shadow(place.shadow, alpha, place.key, drawn.depth, x, y);
      }
    }
    this.shadows.hideUnused();
  }
}
