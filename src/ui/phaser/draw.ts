import type { GameObjects, Scene } from "phaser";

import { insetRect, type Point, type Rect, ringRects } from "../../lib/rect";
import { pixelEllipseSpans, pixelLinePoints, shadowRadiusX } from "../pixelShapes";
import { PALETTE } from "./palette";

export function addFilledRect(scene: Scene, colour: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, colour).setOrigin(0);
}

// The ink layer an overlay dims what is under it with.
const DIM_ALPHA = 0.6;

export function addDim(scene: Scene, rect: Rect): GameObjects.Rectangle {
  return scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, PALETTE.ink, DIM_ALPHA)
    .setOrigin(0);
}

export function fillRect(graphics: GameObjects.Graphics, colour: number, rect: Rect): void {
  graphics.fillStyle(colour).fillRect(rect.x, rect.y, rect.width, rect.height);
}

// A ring of the given thickness just inside rect's edge.
export function drawRing(
  g: GameObjects.Graphics,
  colour: number,
  rect: Rect,
  thickness: number,
): void {
  ringRects(thickness, rect).forEach((band) => fillRect(g, colour, band));
}

// The keyboard's focus ring: a 2px cyan frame outset pixels outside rect.
export function drawFocusRing(graphics: GameObjects.Graphics, outset: number, rect: Rect): void {
  drawRing(graphics, PALETTE.cyan, insetRect(-outset, rect), 2);
}

const SHADOW_RADIUS_Y = 2.5;

// A solid pixel ellipse under a sprite, centred on its x about a pixel above its feet.
export function drawShadow(
  graphics: GameObjects.Graphics,
  colour: number,
  x: number,
  footY: number,
  spriteWidth: number,
): void {
  graphics.fillStyle(colour);
  for (const span of pixelEllipseSpans(
    Math.round(x),
    Math.round(footY) - 1,
    shadowRadiusX(spriteWidth),
    SHADOW_RADIUS_Y,
  )) {
    graphics.fillRect(span.x, span.y, span.width, 1);
  }
}

// The shadow drawShadow draws, made once per colour, drawn sprite width and depth scale as a
// texture: scale flattens it as the sprite shrinks with distance. Radii are kept to half
// pixels, so a sprite scaled continuously reuses a few textures. anchor is the texture pixel
// to place a pixel above the sprite's feet, at its x.
export function shadowTexture(
  scene: Scene,
  colour: number,
  spriteWidth: number,
  scale = 1,
): { anchor: { x: number; y: number }; key: string } {
  const radiusX = Math.round(shadowRadiusX(spriteWidth) * 2) / 2;
  const radiusY = Math.max(1, Math.round(SHADOW_RADIUS_Y * scale * 2) / 2);
  const anchor = { x: Math.ceil(radiusX) + 1, y: Math.ceil(radiusY) + 1 };
  const key = `shadow-${colour.toString(16)}-${radiusX}-${radiusY}`;
  if (!scene.textures.exists(key)) {
    const graphics = scene.make.graphics({}, false);
    graphics.fillStyle(colour);
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
  colour: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  graphics.fillStyle(colour);
  for (const [x, y] of pixelLinePoints(from.x, from.y, to.x, to.y)) {
    graphics.fillRect(x, y, 1, 1);
  }
}

// A picture drawn from rows of text, each "#" a square pixel wide from at, row by row.
export function drawPixelRows(
  graphics: GameObjects.Graphics,
  colour: number,
  rows: readonly string[],
  at: Point,
  pixel: number,
): void {
  graphics.fillStyle(colour);
  rows.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "#") {
        graphics.fillRect(at.x + dx * pixel, at.y + dy * pixel, pixel, pixel);
      }
    });
  });
}

const HEART_ROWS = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

// A 7x6 heart.
export function drawHeart(
  graphics: GameObjects.Graphics,
  x: number,
  y: number,
  colour: number,
): void {
  drawPixelRows(graphics, colour, HEART_ROWS, { x, y }, 1);
}

// A 1px border of 2-on, 2-off dashes, for an empty slot, the last dash on a side cut at its end.
export function drawDashedRect(graphics: GameObjects.Graphics, colour: number, rect: Rect): void {
  graphics.fillStyle(colour);
  const right = rect.x + rect.width - 1;
  const bottom = rect.y + rect.height - 1;
  for (let i = 0; i < rect.width; i += 4) {
    const dash = Math.min(2, rect.width - i);
    graphics.fillRect(rect.x + i, rect.y, dash, 1).fillRect(rect.x + i, bottom, dash, 1);
  }
  for (let i = 0; i < rect.height; i += 4) {
    const dash = Math.min(2, rect.height - i);
    graphics.fillRect(rect.x, rect.y + i, 1, dash).fillRect(right, rect.y + i, 1, dash);
  }
}

// A cream box framed in plum: a panel, bubble or chip drawn in code.
export const CREAM_PANEL_COLOURS = { border: PALETTE.plum, fill: PALETTE.cream };

// A box with a 1px border drawn inside it, not straddling its edge as a Phaser stroke would.
export function drawFramedRect(
  graphics: GameObjects.Graphics,
  colours: { border: number; fill: number },
  rect: Rect,
): void {
  fillRect(graphics, colours.border, rect);
  fillRect(graphics, colours.fill, insetRect(1, rect));
}
