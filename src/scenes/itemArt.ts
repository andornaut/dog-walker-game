import type { GameObjects, Scene } from "phaser";

import type { ItemTile } from "../home/interaction";
import type { Rect } from "../layout/rect";
import { fillRect } from "./draw";
import { disabledTextureKey, silhouetteTextureKey } from "./greyTextures";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { TEXT_SCALE } from "./uiKit";

// The home screen's and the shop's art keys, each with a drawn stand-in below while missing.
export const SHOP_ART = {
  dogSlot: "icon-dog-slot",
  lock: "icon-lock",
  petShop: "ui-pet-shop",
} as const;

// A picture's texture on an item tile: a locked item's is its flat navy silhouette, a
// pack-full one's its grey copy a ramp step darker.
export function itemArtKey(scene: Scene, tile: ItemTile, key: string): string {
  switch (tile.kind) {
    case "goal":
    case "locked":
      return silhouetteTextureKey(scene, key);
    case "packFull":
      return disabledTextureKey(scene, key);
    default:
      return key;
  }
}

// The padlock over a locked item's top-left corner, or nothing while the art is missing.
export function addLock(scene: Scene, parent: GameObjects.Container, x: number, y: number): void {
  if (scene.textures.exists(SHOP_ART.lock)) {
    parent.add(scene.add.image(x, y, SHOP_ART.lock).setOrigin(0));
  }
}

// A price or goal on a small plate: a 1px edge round a face, the text in font-body 2x with
// its caps at capY. originX places the plate by its left (0), centre (0.5) or right (1).
export function addPlate(
  scene: Scene,
  parent: GameObjects.Container,
  at: { capY: number; originX: number; x: number },
  text: string,
  colors: { readonly edge: number; readonly face: number; readonly text: number },
): Rect {
  const label = addPixelText(scene, 0, at.capY, text, { color: colors.text, scale: TEXT_SCALE });
  const width = Math.ceil(label.width) + 6;
  const left = Math.round(at.x - at.originX * width);
  label.setX(left + 3);
  const g = scene.add.graphics();
  fillRect(g, colors.edge, { height: 16, width: width - 2, x: left + 1, y: at.capY - 3 });
  fillRect(g, colors.edge, { height: 14, width, x: left, y: at.capY - 2 });
  fillRect(g, colors.face, { height: 14, width: width - 2, x: left + 1, y: at.capY - 2 });
  parent.add([g, label]);
  return { height: 16, width, x: left, y: at.capY - 3 };
}

// A locked item's plate: its price in dark red, or green when the bank covers it; a goal in
// plum.
export function lockedPlateColors(tile: ItemTile): { edge: number; face: number; text: number } {
  const text =
    tile.kind === "locked" ? (tile.affordable ? PALETTE.forest : PALETTE.darkRed) : PALETTE.plum;
  return { edge: PALETTE.ink, face: PALETTE.cream, text };
}

// The pet shop building drawn in code while ui-pet-shop is missing: green walls, a striped
// awning, a window and a door, under a board with the shop's name.
export function drawPetShopFallback(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  name: string,
): void {
  const { height, width, x, y } = rect;
  const g = scene.add.graphics();
  fillRect(g, PALETTE.ink, { height: height - 18, width: width - 8, x: x + 4, y: y + 18 });
  fillRect(g, PALETTE.darkGreen, { height: height - 20, width: width - 10, x: x + 5, y: y + 19 });
  for (let stripe = 0; stripe < width - 6; stripe += 12) {
    fillRect(g, PALETTE.red, { height: 12, width: 6, x: x + 3 + stripe, y: y + 24 });
    fillRect(g, PALETTE.white, { height: 12, width: 6, x: x + 9 + stripe, y: y + 24 });
  }
  fillRect(g, PALETTE.cyan, { height: 46, width: 56, x: x + 10, y: y + 44 });
  fillRect(g, PALETTE.navy, { height: height - 48, width: 30, x: x + 76, y: y + 44 });
  // The board is Start walk's green, as every tappable entry point is.
  fillRect(g, PALETTE.ink, { height: 18, width: 74, x: x + 23, y });
  fillRect(g, PALETTE.green, { height: 16, width: 72, x: x + 24, y: y + 1 });
  parent.add(g);
  parent.add(
    addPixelText(scene, x + width / 2, y + 5, name, {
      color: PALETTE.ink,
      font: "title",
      originX: 0.5,
    }),
  );
}

// The dog slot icon drawn in code while icon-dog-slot is missing: a doghouse with a plus.
export function drawDogSlotFallback(
  scene: Scene,
  parent: GameObjects.Container,
  at: { x: number; y: number },
): void {
  const { x, y } = at;
  const g = scene.add.graphics();
  for (let row = 0; row < 10; row += 1) {
    fillRect(g, PALETTE.red, { height: 1, width: 4 + row * 2, x: x + 14 - row, y: y + 5 + row });
  }
  fillRect(g, PALETTE.tan, { height: 13, width: 20, x: x + 6, y: y + 15 });
  fillRect(g, PALETTE.plum, { height: 8, width: 6, x: x + 13, y: y + 20 });
  fillRect(g, PALETTE.green, { height: 9, width: 9, x: x + 22, y: y + 1 });
  fillRect(g, PALETTE.white, { height: 5, width: 1, x: x + 26, y: y + 3 });
  fillRect(g, PALETTE.white, { height: 1, width: 5, x: x + 24, y: y + 5 });
  parent.add(g);
}
