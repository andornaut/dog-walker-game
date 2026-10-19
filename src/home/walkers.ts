import type { WalkerId } from "../data/types";
import type { SaveDocument } from "../save/schema";
import { PLAIN_ITEM, type TileState, tileState } from "./interaction";

// A walker's tile on the home screen: the walker in use is selected, another unlocked one
// can be picked, and a locked one cannot until a walk finishes its zone.
export function walkerTileState(
  save: Pick<SaveDocument, "owned" | "walker">,
  walker: WalkerId,
): TileState {
  return tileState({
    ...PLAIN_ITEM,
    available: save.owned.walkers.includes(walker),
    picked: save.walker === walker,
  });
}
