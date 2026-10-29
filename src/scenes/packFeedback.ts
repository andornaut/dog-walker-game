import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { chipLeft, FEEDBACK, heartPopFrame, type LabelAnchor } from "../hud/feedback";
import { changeChipAt } from "../hud/hudLanes";
import { COMIC_WORDS } from "../layout/comicWords";
import type { Point } from "../lib/rect";
import { CREAM_PANEL_COLOURS, drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, inkSpan, pixelFontMetrics, placePixelText } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";
import { letterEffect } from "./comicWord";
import { playTagOnce } from "./sprites";
import { fadeAway } from "./uiKit";

// A sidestep puff, 48x48, laid on the dog's frame and lettered with the dodge word.
const DODGE_ART = { key: "fx-dodge", tag: "play" } as const;

interface PackMoment {
  depth: number;
  still: boolean;
}

// A dog's dodge: fx-dodge's play tag laid on the dog's frame at its top-left with the
// dodge word over its first frames, or, with reduced motion or while that art is missing, the
// dodge label rising over the dog.
export function playDodge(scene: Scene, moment: PackMoment, dog: GameObjects.Sprite): void {
  const art = !moment.still && scene.anims.exists(animationKey(DODGE_ART.key, DODGE_ART.tag));
  if (art) {
    const { x, y } = dog.getTopLeft();
    const sprite = scene.add.sprite(x, y, DODGE_ART.key).setOrigin(0).setDepth(moment.depth);
    playTagOnce(sprite, DODGE_ART.key, DODGE_ART.tag, () => sprite.destroy());
    const { frames, ...place } = COMIC_WORDS.dodge;
    letterEffect(sprite, place, frames, gameData.runText.comicWords.dodge);
    return;
  }
  const top = dog.getTopCenter();
  const anchor = { centreX: top.x, lineBottom: top.y - 2 };
  floatLabel(scene, moment, anchor, gameData.runText.dodge, PALETTE.plum, FEEDBACK.dodge);
}

// A loss the walker's perk forgave: the forgiven label rising over the dog, from its top
// opaque row, or from over the heart pop when part of the loss still costs a heart.
export function playForgiven(
  scene: Scene,
  moment: PackMoment,
  dog: { readonly popped: boolean; readonly top: Point },
): void {
  const { popped, top } = dog;
  const lineBottom = (popped ? heartPopFrame(top).y : top.y) - 2;
  const anchor = { centreX: top.x, lineBottom };
  const { forgiven } = FEEDBACK;
  floatLabel(scene, moment, anchor, gameData.runText.forgiven, PALETTE.forest, forgiven);
}

// Body text at 2x on a cream chip, as a change label's (CHANGE_CHIP), centred on the anchor
// (moved in to stay on screen) with its bottom on the anchor's line bottom; held fully opaque
// for holdMs, then rising and fading out over the rest of ms; with reduced motion it fades in
// place.
export function floatLabel(
  scene: Scene,
  moment: PackMoment,
  anchor: LabelAnchor,
  text: string,
  colour: number,
  timing: { holdMs: number; ms: number; rise: number },
): void {
  const body = pixelFontMetrics(scene, "body");
  const label = addPixelText(scene, 0, 0, text, { colour, scale: TEXT_SCALE });
  const ink = inkSpan(label);
  const shown = { lines: 1, scale: TEXT_SCALE, width: ink.right - ink.left };
  const { height, width } = changeChipAt(body, { x: 0, y: 0 }, shown).chip;
  const x = chipLeft(SCREEN_CONFIG.width, anchor.centreX, width);
  const placed = changeChipAt(body, { x, y: anchor.lineBottom - height }, shown);
  placePixelText(label, placed.text.x - ink.left, placed.text.y);
  const box = scene.add.graphics();
  drawFramedRect(box, CREAM_PANEL_COLOURS, placed.chip);
  const parts = [box.setDepth(moment.depth), label.setDepth(moment.depth)];
  fadeAway(scene, parts, {
    delayMs: timing.holdMs,
    ms: timing.ms - timing.holdMs,
    rise: moment.still ? 0 : timing.rise,
  });
}
