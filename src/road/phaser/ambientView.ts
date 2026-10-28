import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../../assets/asepriteAnimations";
import { AMBIENT_VARIANTS, IDLE_TAG } from "../../assets/spriteKeys";
import type { AmbientMover, ZoneId } from "../../data/types";
import type { Random } from "../../lib/random";
import { DEPTH, LAYOUT, PROJECTION, showOnRoad } from "../../scenes/run/stage";
import { firstTag, playTag, showAtDepth } from "../../scenes/sprites";
import {
  type AmbientDeps,
  type AmbientFrame,
  clearAmbient,
  newPlace,
  placeAmbient,
  startAmbient,
  stepAmbient,
} from "../ambient";

// The sprites a mover may wear, one picked by its slot's look.
const NO_ART: readonly string[] = [];

// Band movers lie over the backdrop's approach, nearer rows in front; the rows add at most
// this much to their depth, so they stay under the road.
const BAND_ROW_DEPTH = 1 / 10000;

// The ambient movers' sprites, one per slot, made once and reused. With reduced motion none
// is shown. A mover on the cross street is drawn at its row's scale over the backdrop, and one
// in the sky at full size;
// one beside the road stands through the projection like the road's sprites, cut off at the
// juncture.
export class AmbientView {
  private readonly arts = new Map<string, readonly string[]>();
  private readonly deps: AmbientDeps;
  private frame: AmbientFrame | undefined;
  private readonly place = newPlace();
  private readonly scene: Scene;
  private readonly sprites: GameObjects.Sprite[];
  private readonly state = startAmbient();

  constructor(scene: Scene, random: Random) {
    this.scene = scene;
    this.sprites = this.state.slots.map(() =>
      scene.add.sprite(0, 0, "__DEFAULT").setVisible(false),
    );
    this.deps = {
      drawable: (mover) => this.art(mover).length > 0,
      random,
      stage: { band: LAYOUT.backdrop, projection: PROJECTION },
    };
  }

  // now is the walk's time in seconds and travelled its road distance from the start.
  draw(
    movers: readonly AmbientMover[],
    zone: ZoneId,
    walk: { halted: boolean; now: number; still: boolean; travelled: number },
  ): void {
    const { state } = this;
    if (walk.still) {
      clearAmbient(state);
      this.sprites.forEach((sprite) => sprite.setVisible(false));
      return;
    }
    const frame = this.frame ?? { movers, now: 0, travelled: 0, zone };
    this.frame = frame;
    frame.movers = movers;
    frame.now = walk.now;
    frame.travelled = walk.travelled;
    frame.zone = zone;
    stepAmbient(this.deps, frame, state);
    const { place } = this;
    for (const [i, slot] of state.slots.entries()) {
      const sprite = this.sprites[i];
      const art = slot.mover === null ? NO_ART : this.art(slot.mover);
      const key = art[Math.floor(slot.look * art.length)];
      const shown =
        slot.active &&
        key !== undefined &&
        placeAmbient(this.deps.stage, slot, walk.now, walk.travelled, place);
      sprite?.setVisible(shown);
      if (sprite === undefined || slot.mover === null || key === undefined || !shown) {
        continue;
      }
      const drawn = showAtDepth(sprite, key, place.scale);
      const lift = place.band ? place.lift : place.lift * drawn.depth;
      sprite
        .setPosition(Math.round(place.x), Math.round(place.y - lift))
        .setFlipX(place.flip)
        .setDepth(
          place.band ? DEPTH.bandMover + place.y * BAND_ROW_DEPTH : DEPTH.sprite + place.y + 1,
        );
      if (!place.band) {
        showOnRoad(Math.round(place.y), 1, sprite);
      } else {
        sprite.setAlpha(1);
        if (sprite.isCropped) {
          sprite.setCrop();
        }
      }
      this.animate(sprite, drawn.key, slot.mover.tag, place.moving && !walk.halted);
    }
  }

  // The moving tag while it moves; else its idle tag, or its moving tag held on its frame.
  private animate(sprite: GameObjects.Sprite, key: string, tag: string, moving: boolean): void {
    const idle = moving ? undefined : firstTag(this.scene, key, [IDLE_TAG]);
    if (moving || idle !== undefined) {
      playTag(sprite, key, idle ?? tag);
      return;
    }
    if (sprite.anims.currentAnim?.key !== animationKey(key, tag)) {
      playTag(sprite, key, tag);
    }
    sprite.anims.pause();
  }

  // The mover's own art and its variants that are loaded.
  private art(mover: AmbientMover): readonly string[] {
    const cached = this.arts.get(mover.key);
    if (cached !== undefined) {
      return cached;
    }
    const has = (key: string) => this.scene.textures.exists(key);
    const art = [mover.key, ...(AMBIENT_VARIANTS[mover.key] ?? [])].filter(has);
    this.arts.set(mover.key, art);
    return art;
  }
}
