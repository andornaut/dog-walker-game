import type { GameObjects, Scene } from "phaser";

import type { Rect } from "../layout/rect";

export const LABEL_TEXT_STYLE = { color: "#1d1d1d", fontFamily: "monospace", fontSize: "14px" };

// Stands in for the pixel font until a BMFont is chosen. The mock's 3x5 glyphs advance 4px
// per character at 1x and 8px at 2x; a monospace face at these sizes comes closest.
export const PIXEL_FONT = { fontFamily: "monospace", fontSizeByScale: { 1: 7, 2: 13 } } as const;
export type PixelTextScale = keyof typeof PIXEL_FONT.fontSizeByScale;

export function addPixelText(
  scene: Scene,
  scale: PixelTextScale,
  color: string,
  position: { x: number; y: number },
  text: string,
): GameObjects.Text {
  return scene.add.text(position.x, position.y, text, {
    color,
    fontFamily: PIXEL_FONT.fontFamily,
    fontSize: `${PIXEL_FONT.fontSizeByScale[scale]}px`,
  });
}

export function addFilledRect(scene: Scene, color: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0);
}

export function addCenteredLabel(scene: Scene, text: string, rect: Rect): GameObjects.Text {
  return scene.add
    .text(rect.x + rect.width / 2, rect.y + rect.height / 2, text, LABEL_TEXT_STYLE)
    .setOrigin(0.5);
}
