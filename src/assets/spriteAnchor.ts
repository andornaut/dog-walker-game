import type { PixelBounds } from "@andornaut/game-kit/opaqueBounds";

import type { SpriteAnchor } from "./manifest";

// Where a ground sprite stands, from the opaque bounds of its frame 0: feetY is its last
// opaque row, which the sprite's origin puts on the feet line, and opaqueWidth how wide its
// drawn pixels are. A blank frame stands on its bottom row. The art manifest's anchors and
// the boot-time measure of a sprite without one both come from here.
export function spriteAnchor(
  bounds: PixelBounds | undefined,
  width: number,
  height: number,
): SpriteAnchor {
  return bounds === undefined
    ? { feetY: height - 1, opaqueWidth: width }
    : { feetY: bounds.bottom - 1, opaqueWidth: bounds.right - bounds.left };
}
