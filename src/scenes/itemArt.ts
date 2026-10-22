import type { GameObjects, Scene } from "phaser";

import type { Rect } from "../lib/rect";
import type { Padlock } from "../ui/interaction";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, pixelFontMetrics } from "../ui/phaser/pixelText";
import { PLATE_LOOKS, type PlateKind } from "../ui/selection";
import { TEXT_SCALE } from "./uiKit";

// The home screen's and the shop's art keys, each with a drawn stand-in below while missing.
export const SHOP_ART = {
  dogSlot: "icon-dog-slot",
  petShop: "ui-pet-shop",
} as const;

// The padlock's art for each shape.
export const PADLOCK_KEYS: Readonly<Record<Padlock, string>> = {
  closed: "icon-lock",
  open: "icon-lock-open",
};

// The padlock over an item's top-left corner, or nothing while the art is missing.
export function addLock(
  scene: Scene,
  parent: GameObjects.Container,
  padlock: Padlock,
  at: { x: number; y: number },
): void {
  const key = PADLOCK_KEYS[padlock];
  if (scene.textures.exists(key)) {
    parent.add(scene.add.image(at.x, at.y, key).setOrigin(0));
  }
}

// How far a plate's edge sits outside its text's capitals on every side.
export const PLATE_PAD = 3;

// A plate's colours: its 1px edge, its face, the face's top (lit) and bottom (shade) rows
// where they differ from it, and its text.
interface PlateColors {
  readonly edge: number;
  readonly face: number;
  readonly lit?: number;
  readonly shade?: number;
  readonly text: number;
}

// The colours of a price's or goal's plate, from PLATE_LOOKS.
export function plateColors(kind: PlateKind): PlateColors {
  const { edge, face, lit, shade, text } = PLATE_LOOKS[kind];
  return {
    edge: PALETTE[edge],
    face: PALETTE[face],
    text: PALETTE[text],
    ...(lit === null ? {} : { lit: PALETTE[lit] }),
    ...(shade === null ? {} : { shade: PALETTE[shade] }),
  };
}

// A price or goal on a small plate: a 1px edge round a face, the text in font-body 2x with
// its caps at capY, the plate reaching PLATE_PAD past the capitals above and below, so it is
// as tall as the font's capitals make it. originX places the plate by its left (0), centre
// (0.5) or right (1).
export function addPlate(
  scene: Scene,
  parent: GameObjects.Container,
  at: { capY: number; originX: number; x: number },
  text: string,
  colors: PlateColors,
): Rect {
  const label = addPixelText(scene, 0, at.capY, text, { color: colors.text, scale: TEXT_SCALE });
  const width = Math.ceil(label.width) + 2 * PLATE_PAD;
  const height = pixelFontMetrics(scene, "body").capHeight * TEXT_SCALE + 2 * PLATE_PAD;
  const left = Math.round(at.x - at.originX * width);
  const top = at.capY - PLATE_PAD;
  label.setX(left + PLATE_PAD);
  const g = scene.add.graphics();
  const face = { height: height - 2, width: width - 2, x: left + 1, y: top + 1 };
  // Square corners cut by a pixel.
  fillRect(g, colors.edge, { height, width: width - 2, x: left + 1, y: top });
  fillRect(g, colors.edge, { height: height - 2, width, x: left, y: top + 1 });
  fillRect(g, colors.face, face);
  // The face's top and bottom rows, lit and shaded where the plate says.
  if (colors.lit !== undefined) {
    fillRect(g, colors.lit, { ...face, height: 1 });
  }
  if (colors.shade !== undefined) {
    fillRect(g, colors.shade, { ...face, height: 1, y: face.y + face.height - 1 });
  }
  parent.add([g, label]);
  return { height, width, x: left, y: top };
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
