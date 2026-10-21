import type { GameObjects, Scene } from "phaser";

import { backdropKey } from "../../assets/spriteKeys";
import type { Zone } from "../../data/types";
import { catX, GAG_KEYS, GAG_TAGS, GAG_Y, KITE_AT, ZONE_GAGS } from "../../layout/sceneryGags";
import type { Random } from "../../lib/random";
import { DEPTH, LAYOUT } from "../../scenes/run/stage";
import { playTag } from "../../scenes/sprites";

type Gag = keyof typeof GAG_KEYS;

// The zone's backdrop band over the far end of the road, and its scenery gags, held still.
export class BackdropView {
  private readonly image: GameObjects.Image;
  private gags: GameObjects.Sprite[] = [];
  private readonly scene: Scene;
  private readonly scenery: Random;

  constructor(scene: Scene, scenery: Random) {
    this.scene = scene;
    this.scenery = scenery;
    const { backdrop } = LAYOUT;
    this.image = scene.add.image(backdrop.x, backdrop.y, "__DEFAULT").setOrigin(0);
    this.image.setDepth(DEPTH.backdrop);
  }

  draw(zone: Zone): void {
    const key = backdropKey(zone);
    if (this.image.texture.key !== key) {
      const band = LAYOUT.backdrop;
      this.image
        .setTexture(this.scene.textures.exists(key) ? key : "__DEFAULT")
        .setCrop(0, 0, band.width, band.height);
      this.placeGags(zone);
    }
  }

  // The zone's gags from its row of the table, each held on the first frame of its art: a cat
  // on its perch and the kite in its tree.
  private placeGags(zone: Zone): void {
    this.gags.forEach((gag) => gag.destroy());
    const { backdrop } = LAYOUT;
    const table = ZONE_GAGS[zone.id as keyof typeof ZONE_GAGS];
    const add = (gag: Gag, x: number, y: number) => {
      const sprite = this.scene.add
        .sprite(Math.round(x), backdrop.y + y, GAG_KEYS[gag])
        .setOrigin(0)
        .setDepth(DEPTH.gag);
      playTag(sprite, GAG_KEYS[gag], GAG_TAGS[gag], true);
      return sprite;
    };
    const left = catX(table, this.scenery());
    this.gags = [
      ...(left === null ? [] : [add("cat", left, GAG_Y.cat)]),
      add("kite", KITE_AT.x, KITE_AT.y),
    ];
  }
}
