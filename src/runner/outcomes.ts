import { approachOutcomes } from "./approach";
import type { MoverPath } from "./movers";
import { shyOutcomes } from "./shy";

// Every path a mover may yet take: its own, or, for a stalker or shy hopper with moves still to
// choose, every way it may choose them, since each choice waits on where the pack is then.
export function moverOutcomes(path: MoverPath): MoverPath[] {
  if (path.motion === "approach") {
    return approachOutcomes(path);
  }
  return path.motion === "shy" ? shyOutcomes(path) : [path];
}
