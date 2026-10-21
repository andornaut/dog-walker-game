import type { GameObjects, Scene } from "phaser";

import { gameData } from "../../data";
import { bobOffset, itemCue } from "../../rules/itemCues";
import type { WalkItem } from "../../runner/walk";
import { addDisplayText } from "../displayText";
import { PALETTE } from "../palette";
import { JUNCTURE_Y } from "./stage";

// Screen pixels between a sprite's top and the bottom of the "!" mark, at 1x.
const MARK_GAP = 1;
// Rows under the capitals in the display font's line, at 1x.
const MARK_DESCENT = 2;

// A "!" in the display font over a sprite that opens a card. It follows the sprite's top centre
// and scales with it, and ignores reduced motion.
export class CardMark {
  private readonly label: GameObjects.BitmapText;

  constructor(scene: Scene) {
    this.label = addDisplayText(scene, 0, 0, "!", {
      color: PALETTE.yellow,
      font: "title",
      originX: 0.5,
      originY: 1,
    });
  }

  destroy(): void {
    this.label.destroy();
  }

  place(sprite: GameObjects.Sprite): void {
    const scale = sprite.scaleX;
    const top = sprite.getTopCenter();
    this.label
      .setVisible(sprite.visible && top.y >= JUNCTURE_Y)
      .setScale(scale)
      .setPosition(Math.round(top.x), Math.round(top.y - MARK_GAP * scale + MARK_DESCENT * scale))
      .setDepth(sprite.depth + 1);
  }
}

// The walk screen's reading aids for road items, from the item's data: a "!" over those that
// open a card, and a bob for the grab-worthy finds. View-only.
export class ItemCueViews {
  private readonly marks = new Map<number, CardMark>();
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // Call after the item's sprites are placed. The first sprite not lying flat carries the mark.
  apply(
    item: WalkItem,
    parts: readonly { flat: boolean; sprite: GameObjects.Sprite }[],
    still: boolean,
  ): void {
    const cue = itemCue(gameData, item.kind);
    const body = parts.find(({ flat }) => !flat) ?? parts[0];
    if (cue.bob) {
      const offset = bobOffset(still, this.scene.time.now);
      parts.forEach(({ sprite }) => sprite.setY(sprite.y + offset));
    }
    if (!cue.mark || body === undefined) {
      return;
    }
    const mark = this.marks.get(item.id) ?? new CardMark(this.scene);
    this.marks.set(item.id, mark);
    mark.place(body.sprite);
  }

  prune(seen: ReadonlySet<number>): void {
    for (const [id, mark] of this.marks) {
      if (!seen.has(id)) {
        mark.destroy();
        this.marks.delete(id);
      }
    }
  }
}
