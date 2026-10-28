import type { GameObjects } from "phaser";

import { gameData } from "../../data";
import { bobOffset, itemBobs } from "../../rules/itemCues";
import type { WalkItem } from "../../runner/walkItems";

// The walk screen's reading aid for road items: the grab-worthy ones bob, from the item's
// data. View-only. Call after the item's sprites are placed, with the scene's time.
export function applyItemCue(
  item: WalkItem,
  parts: readonly { sprite: GameObjects.Sprite }[],
  still: boolean,
  timeMs: number,
): void {
  if (itemBobs(gameData, item.kind)) {
    const offset = bobOffset(still, timeMs);
    parts.forEach(({ sprite }) => sprite.setY(sprite.y + offset));
  }
}
