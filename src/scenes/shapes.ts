import type { GameObjects, Scene } from "phaser";

import type { Rect } from "../layout";

export const TEXT_STYLE = { color: "#1d1d1d", fontFamily: "monospace", fontSize: "14px" };

// A filled box placed by its top-left corner, matching Rect.
export function addBox(scene: Scene, color: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0);
}

// A label centred on a box.
export function addLabel(scene: Scene, text: string, rect: Rect): GameObjects.Text {
  return scene.add
    .text(rect.x + rect.width / 2, rect.y + rect.height / 2, text, TEXT_STYLE)
    .setOrigin(0.5);
}
