import type { GameObjects, Scene } from "phaser";

import { itemAt } from "../../arrays";
import { forcedStopSpriteKey } from "../../assets/spriteKeys";
import { project } from "../../layout/projection";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import type { Walk } from "../../runner/walk";
import { addStandingSprite, firstTag, playTag, showAtDepth } from "../sprites";
import { clipToRoad, DEPTH, ITEM_TAGS, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// A forced stop's figure stands in the middle of the road; a construction barrier is
// repeated across every lane.
export class ForcedStopView {
  private key = "";
  private readonly scene: Scene;
  private sprites: GameObjects.Sprite[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  draw(walk: Walk, halted: boolean, still: boolean, shadow: Shadow): void {
    const { road } = LAYOUT;
    const onRoad = walk.road.forcedStopOnRoad;
    if (onRoad === null) {
      this.clear();
      return;
    }
    const key = forcedStopSpriteKey(onRoad.stop);
    const xs = onRoad.stop === "constructionDetour" ? LANE_XS : [road.x + road.width / 2];
    if (this.sprites.length !== xs.length || this.key !== key) {
      this.clear();
      this.key = key;
      this.sprites = xs.map(() => addStandingSprite(this.scene, key, 0, 0));
    }
    const distance =
      PROJECTION.footY - (onRoad.y + screenRoadGeometry(walk.run).itemHeights.forcedStop);
    const tags = halted ? ITEM_TAGS.halted : ITEM_TAGS.walking;
    this.sprites.forEach((sprite, i) => {
      const placed = project(PROJECTION, { distance, x: itemAt(xs, i) });
      const drawn = showAtDepth(sprite, key, placed.scale);
      const tag = firstTag(this.scene, drawn.key, tags);
      if (tag !== undefined) {
        playTag(sprite, drawn.key, tag, still);
      }
      const x = Math.round(placed.x);
      const y = Math.round(placed.y);
      sprite.setPosition(x, y).setDepth(DEPTH.sprite + placed.y);
      clipToRoad(sprite);
      shadow(key, drawn.depth, x, y);
    });
  }

  private clear(): void {
    this.sprites.forEach((sprite) => sprite.destroy());
    this.key = "";
    this.sprites = [];
  }
}
