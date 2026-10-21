import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { chipLeft, FEEDBACK, heartPopFrame, type LabelAnchor } from "../hud/feedback";
import { COMIC_WORDS } from "../layout/comicWords";
import type { Point } from "../lib/rect";
import { drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, pixelFontMetrics } from "../ui/phaser/pixelText";
import { letterEffect } from "./comicWord";
import { playTagOnce } from "./sprites";
import { fadeAway } from "./uiKit";

// A sidestep puff, 48x48, laid on the dog's frame and lettered with the dodge word.
const DODGE_ART = { key: "fx-dodge", tag: "play" } as const;

// The label is font-title at 2x; its chip reaches 2px past the capitals.
const TITLE_SCALE = 2;
const CHIP_PAD = 2;

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

// font-title at 2x on a cream chip, centred on the anchor (moved in to stay on screen) with its
// line's bottom there, held fully opaque for holdMs, then rising and fading out over the rest
// of ms; with reduced motion it fades in place.
function floatLabel(
  scene: Scene,
  moment: PackMoment,
  anchor: LabelAnchor,
  text: string,
  color: number,
  timing: { holdMs: number; ms: number; rise: number },
): void {
  const label = addPixelText(scene, 0, 0, text, { color, font: "title", scale: TITLE_SCALE });
  const title = pixelFontMetrics(scene, "title");
  const width = Math.ceil(label.width) + 2 * CHIP_PAD;
  // A glyph inked above the capitals, such as ♥, grows the chip up to hold it.
  const tops = label.getTextBounds(true).characters.flatMap((char) => (char.h > 0 ? [char.y] : []));
  const above = Math.max(0, title.capTop - Math.min(title.capTop, ...tops)) * TITLE_SCALE;
  label.setPosition(CHIP_PAD, CHIP_PAD + above + label.y);
  const box = scene.add.graphics();
  drawFramedRect(
    box,
    { border: PALETTE.plum, fill: PALETTE.cream },
    { height: title.capHeight * TITLE_SCALE + above + 2 * CHIP_PAD, width, x: 0, y: 0 },
  );
  const capTop = anchor.lineBottom - (title.lineHeight - title.capTop) * TITLE_SCALE;
  const x = chipLeft(SCREEN_CONFIG.width, anchor.centreX, width);
  const y = capTop - CHIP_PAD - above;
  const chip = scene.add.container(x, y, [box, label]).setDepth(moment.depth);
  fadeAway(scene, [chip], {
    delayMs: timing.holdMs,
    ms: timing.ms - timing.holdMs,
    rise: moment.still ? 0 : timing.rise,
  });
}
