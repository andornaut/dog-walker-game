import { project } from "../../layout/projection";
import type { WalkItem } from "../../runner/walkItems";
import { playFirstTag, showAtDepth } from "../sprites";
import type { ItemPart } from "./itemViews";
import { DEPTH, PROJECTION, type Shadow, showOnRoad } from "./stage";

// What a frame draws standing items with: the first of tags each sprite has plays, the walk's
// halted or walking tags.
export interface StandFrame {
  readonly shadow: Shadow;
  readonly still: boolean;
  readonly tags: readonly string[];
}

// One sprite of an item standing on the road through the projection at laneX, sized for where
// it stands by showAtDepth: flat on the road under everything, lifted over it with no shadow,
// or on its feet row with a shadow.
export function standPart(
  item: Pick<WalkItem, "height" | "y">,
  part: ItemPart,
  laneX: number,
  { shadow, still, tags }: StandFrame,
): void {
  const distance = PROJECTION.footY - part.footY(item);
  const placed = project(PROJECTION, { distance, x: laneX + part.dx });
  const drawn = showAtDepth(part.sprite, part.key, placed.scale, part.feet);
  const x = Math.round(placed.x);
  const y = Math.round(placed.y);
  part.sprite.setPosition(x, y - Math.round(part.lift * drawn.depth));
  showOnRoad(y, 1, part.sprite);
  playFirstTag(part.sprite, drawn.key, tags, still);
  if (part.lift > 0) {
    part.sprite.setDepth(DEPTH.sprite + placed.y + 1);
  } else if (part.flat) {
    part.sprite.setDepth(DEPTH.decal);
  } else {
    part.sprite.setDepth(DEPTH.sprite + placed.y);
    shadow(part.key, drawn.depth, x, y);
  }
}
