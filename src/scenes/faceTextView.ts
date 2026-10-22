import type { GameObjects, Scene } from "phaser";

import { ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import {
  type FaceBox,
  type FaceRow,
  type FaceText,
  fittingFaceRows,
  inlineFaceBox,
  type OwnerFace,
} from "../hud/faceText";
import { drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  pixelFontMetrics,
  type PixelTextStyle,
  scalePixelText,
  setPixelText,
} from "../ui/phaser/pixelText";
import type { TextFitStyle } from "../ui/textFit";
import { firstTag, playTag } from "./sprites";

// Walk text with owners' faces inline before their names (hud/faceText.ts), drawn in the body
// font: each row's runs of text, and each face in its 1px ink frame over tan.

type Part = GameObjects.GameObject & GameObjects.Components.Depth & { alpha: number };

// What measure returns, given the width of a run of text at a fit in style's font as Phaser
// lays it out, measured on a probe label.
export function measureRuns<T>(
  scene: Scene,
  style: PixelTextStyle,
  measure: (width: (fit: TextFitStyle, text: string) => number) => T,
): T {
  const probe = addPixelText(scene, 0, 0, "", style).setVisible(false);
  const measured = measure((fit, text) => {
    setPixelText(probe, text);
    probe.setLetterSpacing(fit.letterSpacing);
    scalePixelText(probe, fit.scale, 0, 0);
    return probe.width;
  });
  probe.destroy();
  return measured;
}

// The line's rows in the first of styles that fits room, as fittingFaceRows sets them, measured
// on the font they are drawn in, and the inline face's box at the style's scale.
export function fitFaceRows(
  scene: Scene,
  style: PixelTextStyle,
  fit: { room: number; styles: readonly TextFitStyle[] },
  line: FaceText,
): { box: FaceBox | undefined; rows: FaceRow[]; style: TextFitStyle } {
  const body = pixelFontMetrics(scene, "body");
  const boxAt = (at: TextFitStyle) => inlineFaceBox(body, at.scale);
  const fitted = measureRuns(scene, style, (width) =>
    fittingFaceRows(fit.styles, width, boxAt, fit.room, line),
  );
  return { ...fitted, box: boxAt(fitted.style) };
}

// The rows drawn from x, the first row's capitals' top at capsTop and each further row a line
// of the font lower, at fit, in style's colour, each face in box. Returns the parts drawn.
export function addFaceRows(
  scene: Scene,
  at: { capsTop: number; x: number },
  text: { box: FaceBox | undefined; fit: TextFitStyle; style: PixelTextStyle },
  rows: readonly FaceRow[],
): Part[] {
  const { box, fit, style } = text;
  const pitch = pixelFontMetrics(scene, style.font ?? "body").lineHeight * fit.scale;
  return rows.flatMap((row, i) => {
    const top = at.capsTop + i * pitch;
    const texts = row.texts.map(({ text: run, x }) => {
      const label = addPixelText(scene, 0, 0, run, style).setLetterSpacing(fit.letterSpacing);
      scalePixelText(label, fit.scale, at.x + x, top);
      return label;
    });
    const faces =
      box === undefined
        ? []
        : row.faces.flatMap((face) =>
            addInlineFace(scene, box, { x: at.x + face.x, y: top - box.rise }, face),
          );
    return [...faces, ...texts];
  });
}

// The owner's 20x20 face at 1x, in its mood, else neutral, in a 1px ink frame over tan, the
// frame's top-left at.
function addInlineFace(
  scene: Scene,
  box: FaceBox,
  at: { x: number; y: number },
  face: OwnerFace,
): Part[] {
  const g = scene.add.graphics();
  drawFramedRect(
    g,
    { border: PALETTE.ink, fill: PALETTE.tan },
    { height: box.framed, width: box.framed, x: at.x, y: at.y },
  );
  const key = ownerCardFaceKey(gameData, face.dog);
  if (!scene.textures.exists(key)) {
    return [g];
  }
  const sprite = scene.add.sprite(at.x + 1, at.y + 1, key).setOrigin(0);
  const tag = firstTag(scene, key, [face.mood, "neutral"]);
  if (tag !== undefined) {
    playTag(sprite, key, tag);
  }
  return [g, sprite];
}
