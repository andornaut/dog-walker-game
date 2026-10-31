import { animationKey } from "@andornaut/game-kit/art/aseprite";

import { moverBodyTag } from "../../assets/spriteKeys";
import { animationPhaseAt } from "../../layout/animationPhase";
import { project } from "../../layout/projection";
import { facesLeft, type MoverOnRoad } from "../../runner/movers";
import { signatureComponentProgress, signaturePlace } from "../../runner/signaturePaths";
import type { WalkItem } from "../../runner/walkItems";
import { playTag, showAtDepth, spriteMetrics } from "../sprites";
import type { ItemView } from "./itemViews";
import { DEPTH, laneX, PROJECTION, showOnRoad } from "./stage";
import type { StandFrame } from "./standPart";

// A true trail draws each component on its own delayed path position, baseline and phase.
// Cue sprites remain in the standard slots after the leader and are drawn by moverView.
export function drawSignatureTrail(
  view: ItemView,
  halted: boolean,
  frame: StandFrame,
  item: Pick<WalkItem, "height" | "y"> & { readonly mover: MoverOnRoad },
): boolean {
  const { path, since } = item.mover;
  if (path.motion !== "signature" || path.route.profile.kind !== "delayedTrail") {
    return false;
  }
  const { route } = path;
  const profile = route.profile;
  if (profile.kind !== "delayedTrail") {
    return false;
  }
  const leader = signaturePlace(route, since);
  const baselineOffset = profile.anchor.y - spriteMetrics(profile.spriteKey).feetY;
  route.componentDelays.forEach((_, component) => {
    const part = view.parts[component === 0 ? 0 : component + 3];
    if (part === undefined) {
      return;
    }
    const { sprite } = part;
    const point = signaturePlace(route, since, component);
    const feetY = item.y + item.height + point.y - leader.y;
    const placed = project(PROJECTION, { distance: PROJECTION.footY - feetY, x: laneX(point.x) });
    const drawn = showAtDepth(sprite, part.key, placed.scale, "anchor");
    const metrics = spriteMetrics(drawn.key);
    sprite.setOrigin(
      profile.anchor.x / profile.frame.width,
      (metrics.feetY + baselineOffset) / metrics.frameHeight,
    );
    const has = (tag: string) => sprite.scene.anims.exists(animationKey(drawn.key, tag));
    const moving = !halted && since >= route.entryEnd;
    const progress = signatureComponentProgress(route, since, component);
    const tag = moverBodyTag(has, path.movement, moving);
    if (tag !== undefined) {
      playTag(sprite, drawn.key, tag, true);
      const animation = sprite.anims.currentAnim;
      if (animation !== null) {
        const phase = frame.still ? 0 : (progress / route.scrollSpeed) * 1000;
        const index = animationPhaseAt(
          animation.frames.map(({ duration }) => (duration > 0 ? duration : animation.msPerFrame)),
          phase,
        );
        const shown = animation.frames[index];
        if (shown !== undefined) {
          sprite.anims.setCurrentFrame(shown);
        }
      }
    }
    const x = Math.round(placed.x);
    const y = Math.round(placed.y);
    sprite
      .setVisible(true)
      .setPosition(x, y)
      .setDepth(DEPTH.sprite + placed.y)
      .setFlipX(facesLeft(path, route.entryEnd + progress));
    showOnRoad(y, 1, sprite);
    frame.shadow(part.key, drawn.depth, x, y);
  });
  return true;
}
