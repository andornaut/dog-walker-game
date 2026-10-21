import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import { FEEDBACK, type LabelAnchor } from "../hud/feedback";
import type { Point } from "../layout/rect";
import { drawFramedRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { playEffect, playTagOnce } from "./sprites";
import { fadeAway } from "./uiKit";

// A sidestep puff lettered "DODGE!", 56x56, laid on the dog's frame.
const DODGE_ART = { key: "fx-dodge", tag: "play" } as const;
// A plain hit's impact over the dog.
const BUMP_ART = { key: "fx-bump", tag: "play" } as const;

// font-title at 2x: its capitals start 8 rows into its 24-row line and are 10 rows tall; the
// chip reaches 2px past them.
const TITLE = { capHeight: 10, capTop: 8, line: 24 };
const CHIP_PAD = 2;

interface PackMoment {
  depth: number;
  still: boolean;
}

// A small dog's dodge: fx-dodge's play tag laid on the dog's frame at its top-left, or, with
// reduced motion or while that art is missing, the dodge label rising over the dog.
export function playDodge(scene: Scene, moment: PackMoment, dog: GameObjects.Sprite): void {
  const art = !moment.still && scene.anims.exists(animationKey(DODGE_ART.key, DODGE_ART.tag));
  if (art) {
    const { x, y } = dog.getTopLeft();
    const sprite = scene.add.sprite(x, y, DODGE_ART.key).setOrigin(0).setDepth(moment.depth);
    playTagOnce(sprite, DODGE_ART.key, DODGE_ART.tag, () => sprite.destroy());
    return;
  }
  const top = dog.getTopCenter();
  const anchor = { centreX: top.x, lineBottom: top.y - 2 };
  floatLabel(scene, moment, anchor, gameData.runText.dodge, PALETTE.plum, FEEDBACK.dodge);
}

// A plain hit's fx-bump over the dog it landed on.
export function playBump(scene: Scene, moment: PackMoment, dogTop: Point): void {
  playEffect(scene, BUMP_ART.key, BUMP_ART.tag, dogTop, moment.depth);
}

// font-title at 2x on a cream chip, centred on the anchor with its line's bottom there, rising
// and fading out; with reduced motion it fades in place.
function floatLabel(
  scene: Scene,
  moment: PackMoment,
  anchor: LabelAnchor,
  text: string,
  color: number,
  timing: { ms: number; rise: number },
): void {
  const label = addPixelText(scene, 0, 0, text, { color, font: "title", scale: 2 });
  const width = Math.ceil(label.width) + 2 * CHIP_PAD;
  label.setPosition(CHIP_PAD, CHIP_PAD + label.y);
  const box = scene.add.graphics();
  drawFramedRect(
    box,
    { border: PALETTE.plum, fill: PALETTE.cream },
    { height: TITLE.capHeight + 2 * CHIP_PAD, width, x: 0, y: 0 },
  );
  const capTop = anchor.lineBottom - TITLE.line + TITLE.capTop;
  const x = Math.round(anchor.centreX - width / 2);
  const y = capTop - CHIP_PAD;
  const chip = scene.add.container(x, y, [box, label]).setDepth(moment.depth);
  fadeAway(scene, [chip], { ms: timing.ms, rise: moment.still ? 0 : timing.rise });
}
