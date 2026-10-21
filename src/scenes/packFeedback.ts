import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import {
  coinBurstLayout,
  FEEDBACK,
  hopLabelAnchor,
  hopSplashLayout,
  type LabelAnchor,
} from "../hud/feedback";
import type { Point } from "../layout/rect";
import { amountText } from "../rules/causes";
import type { Cents } from "../rules/units";
import { drawFramedRect } from "./draw";
import { FEEDBACK_ART } from "./feedbackArt";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { playTagOnce } from "./sprites";
import { fadeAway } from "./uiKit";

// font-title at 2x: its capitals start 8 rows into its 24-row line and are 10 rows tall; the
// chip reaches 2px past them.
const TITLE = { capHeight: 10, capTop: 8, line: 24 };
const CHIP_PAD = 2;

interface PackMoment {
  depth: number;
  still: boolean;
}

// An area effect that caught no dog: a splash at the pack's feet with a comic HOP!, which is
// its label. Reduced motion plays the splash without its word and fades "Hop!" over it in
// place, as does a splash whose art is missing.
export function playHopSplash(
  scene: Scene,
  moment: PackMoment & { feetY: number; x: number },
): void {
  const { key, tag, word } = FEEDBACK_ART.hopSplash;
  const layout = hopSplashLayout(moment);
  const played = playFrame(
    scene,
    { key, tag: moment.still ? tag : `${tag}${word}` },
    layout.frame,
    moment,
  );
  if (moment.still || !played) {
    const text = gameData.runText.hopOver;
    floatLabel(scene, moment, layout.label, text, PALETTE.plum, FEEDBACK.hop);
  }
}

// "Hop!" over each dog that hopped over an area effect, by its top opaque row. Reduced motion
// fades the labels in place.
export function playHops(scene: Scene, moment: PackMoment, dogTops: readonly Point[]): void {
  const text = gameData.runText.hopOver;
  for (const top of dogTops) {
    floatLabel(scene, moment, hopLabelAnchor(top), text, PALETTE.plum, FEEDBACK.hop);
  }
}

// A minor bump: coins burst out at the contact point with the tips it dropped, and the walker
// wobbles. Reduced motion drops the wobble and fades the amount in place.
export function playMinorBump(
  scene: Scene,
  moment: PackMoment & { contact: Point },
  bump: { amount: Cents | null; walker: GameObjects.Sprite | undefined },
): void {
  const layout = coinBurstLayout(moment.contact);
  playFrame(scene, FEEDBACK_ART.coinBurst, layout.frame, moment);
  if (bump.amount !== null && bump.amount !== 0) {
    const { labelMs, rise } = FEEDBACK.bump;
    const text = amountText("money", bump.amount);
    floatLabel(scene, moment, layout.label, text, PALETTE.darkRed, { ms: labelMs, rise });
  }
  if (!moment.still && bump.walker !== undefined) {
    wobble(scene, bump.walker);
  }
}

// A one-shot tag placed by its frame's top-left corner, or nothing while the art is missing.
// Returns whether it played.
function playFrame(
  scene: Scene,
  art: { key: string; tag: string },
  at: Point,
  moment: PackMoment,
): boolean {
  if (!scene.anims.exists(animationKey(art.key, art.tag))) {
    return false;
  }
  const sprite = scene.add.sprite(at.x, at.y, art.key).setOrigin(0).setDepth(moment.depth);
  playTagOnce(sprite, art.key, art.tag, () => sprite.destroy());
  return true;
}

// The walker tips one way and the other on its feet, and stands straight again.
function wobble(scene: Scene, walker: GameObjects.Sprite): void {
  const { wobbleDegrees, wobbleMs, wobbles } = FEEDBACK.bump;
  const progress = { t: 0 };
  scene.tweens.add({
    duration: 2 * wobbles * wobbleMs,
    onComplete: () => walker.setAngle(0),
    onUpdate: () => {
      const swing = Math.sin(progress.t * wobbles * 2 * Math.PI);
      walker.setAngle(swing * wobbleDegrees * (1 - progress.t));
    },
    t: 1,
    targets: progress,
  });
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
