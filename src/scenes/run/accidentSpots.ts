import type { GameObjects, Scene } from "phaser";

import { NEED_ART } from "../../assets/spriteKeys";
import { project } from "../../layout/projection";
import { addStandingSprite, playTag, showAtDepth } from "../sprites";
import { DEPTH, PROJECTION } from "./stage";

// An accident's spot is left behind on the road until it is this far behind the walker.
const DECAL_BEHIND = 60;

// Accident spots on the road: where they lie across it, and the road scrolled to their row.
export class AccidentSpots {
  private decals: { scroll: number; sprite: GameObjects.Sprite; x: number }[] = [];
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // A spot at x across the road, on the row the road had scrolled to.
  add(scroll: number, x: number, still: boolean): void {
    if (!this.scene.textures.exists(NEED_ART.accidentSpot)) {
      return;
    }
    const sprite = addStandingSprite(this.scene, NEED_ART.accidentSpot, 0, 0).setDepth(DEPTH.decal);
    playTag(sprite, NEED_ART.accidentSpot, "idle", still);
    this.decals.push({ scroll, sprite, x });
  }

  // Each spot lies flat on its row of road, sized by showAtDepth, until it is behind the
  // walker.
  draw(scroll: number): void {
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
}
