import type { GameObjects, Scene } from "phaser";

import type { Rect } from "../layout/rect";

export const LABEL_TEXT_STYLE = { color: "#1d1d1d", fontFamily: "monospace", fontSize: "14px" };

export function addFilledRect(scene: Scene, color: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0);
}

export function addCenteredLabel(scene: Scene, text: string, rect: Rect): GameObjects.Text {
  return scene.add
    .text(rect.x + rect.width / 2, rect.y + rect.height / 2, text, LABEL_TEXT_STYLE)
    .setOrigin(0.5);
}
