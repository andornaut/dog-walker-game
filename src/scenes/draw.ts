import type { GameObjects, Scene } from "phaser";

import { pixelEllipseSpans, pixelLinePoints, shadowRadiusX } from "../layout/pixelShapes";
import type { Rect } from "../layout/rect";

export function addFilledRect(scene: Scene, color: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, color).setOrigin(0);
}

export function fillRect(graphics: GameObjects.Graphics, color: number, rect: Rect): void {
  graphics.fillStyle(color).fillRect(rect.x, rect.y, rect.width, rect.height);
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

// A 7x6 heart, with an optional highlight pixel.
export function drawHeart(
  graphics: GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  highlight?: number,
): void {
  graphics.fillStyle(color);
  HEART_ROWS.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "1") {
        graphics.fillRect(x + dx, y + dy, 1, 1);
      }
    });
  });
  if (highlight !== undefined) {
    graphics.fillStyle(highlight).fillRect(x + 1, y + 1, 1, 1);
  }
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
  fillRect(graphics, colors.fill, {
    height: rect.height - 2,
    width: rect.width - 2,
    x: rect.x + 1,
    y: rect.y + 1,
  });
}
