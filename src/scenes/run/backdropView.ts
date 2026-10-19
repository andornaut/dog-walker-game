import type { GameObjects, Scene } from "phaser";

import { backdropKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { Zone } from "../../data/types";
import {
  ballAt,
  catReacts,
  catX,
  GAG_KEYS,
  GAG_SIZES,
  GAG_Y,
  ZONE_GAGS,
} from "../../layout/sceneryGags";
import type { Random } from "../../runner/random";
import { type Walk, walkScrollSpeed } from "../../runner/walk";
import { playTag } from "../sprites";
import { DEPTH, LAYOUT } from "./stage";

interface Gags {
  ball: GameObjects.Sprite;
  cat: { sprite: GameObjects.Sprite; x: number } | null;
  sprinklers: GameObjects.Sprite[];
}

// The zone's backdrop band over the far end of the road, and its scenery gags.
export class BackdropView {
  private readonly image: GameObjects.Image;
  private gags: Gags | undefined;
  private readonly scene: Scene;
  private readonly scenery: Random;

  constructor(scene: Scene, scenery: Random) {
    this.scene = scene;
    this.scenery = scenery;
    const { backdrop } = LAYOUT;
    this.image = scene.add.image(backdrop.x, backdrop.y, "__DEFAULT").setOrigin(0);
    this.image.setDepth(DEPTH.backdrop);
  }

  draw(walk: Walk, zone: Zone, packX: number, still: boolean): void {
    const key = backdropKey(zone);
    if (this.image.texture.key !== key) {
      const band = LAYOUT.backdrop;
      this.image
        .setTexture(this.scene.textures.exists(key) ? key : "__DEFAULT")
        .setCrop(0, 0, band.width, band.height);
      this.placeGags(zone);
    }
    const gags = this.gags;
    if (gags === undefined) {
      return;
    }
    const { backdrop } = LAYOUT;
    if (gags.cat !== null) {
      const reacting = !still && catReacts(gags.cat.x, packX);
      playTag(gags.cat.sprite, GAG_KEYS.cat, reacting ? "react" : "idle", still);
    }
    gags.sprinklers.forEach((sprite) => playTag(sprite, GAG_KEYS.sprinkler, "spray", still));
    const ball = ballAt(walk.run.zoneDistance / walkScrollSpeed(gameData, walk.run), still);
    gags.ball.setVisible(ball !== null);
    if (ball !== null) {
      gags.ball.setPosition(ball.x, backdrop.y + ball.y);
      playTag(gags.ball, GAG_KEYS.ball, "roll", still);
    }
  }

  // The zone's gags from its row of the table: a cat on its perch, its sprinklers and the
  // ball.
  private placeGags(zone: Zone): void {
    const gags = this.gags;
    gags?.cat?.sprite.destroy();
    gags?.sprinklers.forEach((sprite) => sprite.destroy());
    gags?.ball.destroy();
    const { backdrop } = LAYOUT;
    const table = ZONE_GAGS[zone.id as keyof typeof ZONE_GAGS];
    const add = (key: string, x: number, y: number) =>
      this.scene.add
        .sprite(Math.round(x), backdrop.y + y, key)
        .setOrigin(0)
        .setDepth(DEPTH.gag);
    const left = catX(table, this.scenery());
    this.gags = {
      ball: add(GAG_KEYS.ball, 0, 0),
      cat: left === null ? null : { sprite: add(GAG_KEYS.cat, left, GAG_Y.cat), x: left },
      sprinklers: table.sprinklers.map((x) =>
        add(GAG_KEYS.sprinkler, x - GAG_SIZES.sprinkler.width / 2, GAG_Y.sprinkler),
      ),
    };
  }
}
