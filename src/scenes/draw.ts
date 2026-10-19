import type { GameObjects, Scene } from "phaser";

import { pixelEllipseSpans, pixelLinePoints, shadowRadiusX } from "../layout/pixelShapes";
import { insetRect, type Rect } from "../layout/rect";
import { PALETTE } from "./palette";

export function addFilledRect(scene: Scene, color: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0);
}

// The ink layer an overlay dims what is under it with.
export const DIM_ALPHA = 0.6;

export function addDim(scene: Scene, rect: Rect): GameObjects.Rectangle {
  return scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, PALETTE.ink, DIM_ALPHA)
    .setOrigin(0);
}

export function fillRect(graphics: GameObjects.Graphics, color: number, rect: Rect): void {
  graphics.fillStyle(color).fillRect(rect.x, rect.y, rect.width, rect.height);
}

// A ring of the given thickness just inside rect's edge.
export function drawRing(
  g: GameObjects.Graphics,
  color: number,
  rect: Rect,
  thickness: number,
): void {
  const { height, width, x, y } = rect;
  fillRect(g, color, { height: thickness, width, x, y });
  fillRect(g, color, { height: thickness, width, x, y: y + height - thickness });
  fillRect(g, color, { height, width: thickness, x, y });
  fillRect(g, color, { height, width: thickness, x: x + width - thickness, y });
}

// The keyboard's focus ring: a 2px cyan frame outset pixels outside rect.
export function drawFocusRing(graphics: GameObjects.Graphics, outset: number, rect: Rect): void {
  drawRing(graphics, PALETTE.cyan, insetRect(-outset, rect), 2);
}

// A solid pixel ellipse under a sprite, centred on its x about a pixel above its feet.
export function drawShadow(
  graphics: GameObjects.Graphics,
  color: number,
  x: number,
  footY: number,
  spriteWidth: number,
): void {
  graphics.fillStyle(color);
  for (const span of pixelEllipseSpans(
    Math.round(x),
    Math.round(footY) - 1,
    shadowRadiusX(spriteWidth),
    2.5,
  )) {
    graphics.fillRect(span.x, span.y, span.width, 1);
  }
}

const SHADOW_RADIUS_Y = 2.5;

// The shadow drawShadow draws, made once per colour, drawn sprite width and depth scale as a
// texture: scale flattens it as the sprite shrinks with distance. Radii are kept to half
// pixels, so a sprite scaled continuously reuses a few textures. anchor is the texture pixel
// to place a pixel above the sprite's feet, at its x.
export function shadowTexture(
  scene: Scene,
  color: number,
  spriteWidth: number,
  scale = 1,
): { anchor: { x: number; y: number }; key: string } {
  const radiusX = Math.round(shadowRadiusX(spriteWidth) * 2) / 2;
  const radiusY = Math.max(1, Math.round(SHADOW_RADIUS_Y * scale * 2) / 2);
  const anchor = { x: Math.ceil(radiusX) + 1, y: Math.ceil(radiusY) + 1 };
  const key = `shadow-${color.toString(16)}-${radiusX}-${radiusY}`;
  if (!scene.textures.exists(key)) {
    const graphics = scene.make.graphics({}, false);
    graphics.fillStyle(color);
    for (const span of pixelEllipseSpans(anchor.x, anchor.y, radiusX, radiusY)) {
      graphics.fillRect(span.x, span.y, span.width, 1);
    }
    graphics.generateTexture(key, 2 * anchor.x + 1, 2 * anchor.y + 1);
    graphics.destroy();
  }
  return { anchor, key };
}

// A 1px line with no smoothing, so it stays on the palette.
export function drawPixelLine(
  graphics: GameObjects.Graphics,
  color: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  graphics.fillStyle(color);
  for (const [x, y] of pixelLinePoints(from.x, from.y, to.x, to.y)) {
    graphics.fillRect(x, y, 1, 1);
  }
}

const HEART_ROWS = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."];

// A 7x6 heart.
export function drawHeart(
  graphics: GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
): void {
  graphics.fillStyle(color);
  HEART_ROWS.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "1") {
        graphics.fillRect(x + dx, y + dy, 1, 1);
      }
    });
  });
}

// A 1px border of 2-on, 2-off dashes, for an empty slot.
export function drawDashedRect(graphics: GameObjects.Graphics, color: number, rect: Rect): void {
  graphics.fillStyle(color);
  const right = rect.x + rect.width - 1;
  const bottom = rect.y + rect.height - 1;
  for (let i = 0; i < rect.width; i += 4) {
    graphics.fillRect(rect.x + i, rect.y, 2, 1).fillRect(rect.x + i, bottom, 2, 1);
  }
  for (let i = 0; i < rect.height; i += 4) {
    graphics.fillRect(rect.x, rect.y + i, 1, 2).fillRect(right, rect.y + i, 1, 2);
  }
}

// A box with a 1px border drawn inside it, not straddling its edge as a Phaser stroke would.
export function drawFramedRect(
  graphics: GameObjects.Graphics,
  colors: { border: number; fill: number },
  rect: Rect,
): void {
  fillRect(graphics, colors.border, rect);
  fillRect(graphics, colors.fill, insetRect(1, rect));
}
