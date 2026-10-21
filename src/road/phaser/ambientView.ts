import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../../assets/asepriteAnimations";
import { AMBIENT_FALLBACKS, IDLE_TAG } from "../../assets/spriteKeys";
import type { AmbientMover, ZoneId } from "../../data/types";
import type { Random } from "../../lib/random";
import { clipToRoad, DEPTH, LAYOUT, PROJECTION } from "../../scenes/run/stage";
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

// Band movers lie over the backdrop and under the gags, nearer rows in front; the rows add at
// most this much to their depth, so they stay under the gags.
const BAND_ROW_DEPTH = 1 / 10000;

// The ambient movers' sprites, one per slot, made once and reused. With reduced motion none
// is shown. A mover on the cross street is drawn at the road's far scale over the backdrop;
// one beside the road stands through the projection like the road's sprites, cut off at the
// juncture.
export class AmbientView {
  private readonly arts = new Map<string, string | null>();
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
      drawable: (mover) => this.artKey(mover) !== null,
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
      const key = slot.mover === null ? null : this.artKey(slot.mover);
      const shown =
        slot.active &&
        key !== null &&
        placeAmbient(this.deps.stage, slot, walk.now, walk.travelled, place);
      sprite?.setVisible(shown);
      if (sprite === undefined || slot.mover === null || key === null || !shown) {
        continue;
      }
      const drawn = showAtDepth(sprite, key, place.scale);
      const lift = place.band ? place.lift : place.lift * drawn.depth;
      sprite
        .setPosition(Math.round(place.x), Math.round(place.y - lift))
        .setFlipX(place.flip)
        .setDepth(
          place.band ? DEPTH.gag - 0.5 + place.y * BAND_ROW_DEPTH : DEPTH.sprite + place.y + 1,
        );
      if (!place.band) {
        clipToRoad(sprite);
      } else if (sprite.isCropped) {
        sprite.setCrop();
      }
      const tag = key === slot.mover.key ? slot.mover.tag : AMBIENT_FALLBACKS[slot.mover.key]?.tag;
      if (tag !== undefined) {
        this.animate(sprite, drawn.key, tag, place.moving && !walk.halted);
      }
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

  // The mover's own art key, else its fallback's, else null when neither is loaded.
  private artKey(mover: AmbientMover): string | null {
    const cached = this.arts.get(mover.key);
    if (cached !== undefined) {
      return cached;
    }
    const has = (key: string) => this.scene.textures.exists(key);
    const fallback = AMBIENT_FALLBACKS[mover.key]?.key;
    const key = has(mover.key)
      ? mover.key
      : fallback !== undefined && has(fallback)
        ? fallback
        : null;
    this.arts.set(mover.key, key);
    return key;
  }
}
