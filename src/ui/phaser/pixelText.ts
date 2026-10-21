import type { GameObjects, Scene, Types } from "phaser";

import { wrapWords } from "../../lib/lines";
import {
  glyphAdvance,
  LINE_HEIGHT,
  normalizePixelText,
  pixelFontAtlas,
  plainMarks,
} from "../pixelFont";
import { fittingTextStyle, type TextFitStyle } from "../textFit";

// body: mixed case, for running text, card effects and labels. title: capitals, for
// titles, numbers, money and buttons. Both are white glyphs, tinted to a palette colour.
export type FontRole = "body" | "title";

const FONT_KEYS: Readonly<Record<FontRole, string>> = { body: "font-body", title: "font-title" };

// Drawn from the mocks' 3x5 glyphs when a manifest font is missing.
const FALLBACK_FONT_KEY = "font-pixel-fallback";

export function registerFallbackPixelFont(scene: Scene): void {
  if (scene.cache.bitmapFont.exists(FALLBACK_FONT_KEY)) {
    return;
  }
  const atlas = pixelFontAtlas();
  const texture = scene.textures.createCanvas(FALLBACK_FONT_KEY, atlas.width, atlas.height);
  const context = texture?.getContext();
  if (texture === null || context === undefined) {
    return;
  }
  context.fillStyle = "#ffffff";
  for (const glyph of atlas.glyphs) {
    for (const [x, y] of glyph.pixels) {
      context.fillRect(glyph.x + x, y, 1, 1);
    }
  }
  texture.refresh();

  const chars: Types.GameObjects.BitmapText.BitmapFontData["chars"] = {};
  const glyphData = (x: number, width: number, advance: number) => ({
    centerX: Math.floor(width / 2),
    centerY: Math.floor(atlas.height / 2),
    data: {},
    height: atlas.height,
    kerning: {},
    u0: x / atlas.width,
    u1: (x + width) / atlas.width,
    v0: 1,
    v1: 0,
    width,
    x,
    xAdvance: advance,
    xOffset: 0,
    y: 0,
    yOffset: 0,
  });
  for (const glyph of atlas.glyphs) {
    chars[glyph.char.codePointAt(0) ?? 0] = glyphData(glyph.x, glyph.width, glyph.advance);
  }
  chars[" ".codePointAt(0) ?? 32] = glyphData(0, 0, glyphAdvance(" "));
  scene.cache.bitmapFont.add(FALLBACK_FONT_KEY, {
    data: { chars, font: FALLBACK_FONT_KEY, lineHeight: LINE_HEIGHT, retroFont: false, size: 5 },
    frame: null,
    texture: FALLBACK_FONT_KEY,
  });
}

export interface PixelTextStyle {
  // How centred lines of wrapped text sit against each other.
  align?: "center" | "left" | "right";
  color: number;
  font?: FontRole;
  // Wraps at spaces to stay within this many screen pixels: Phaser measures the wrap at the
  // label's scale.
  maxWidth?: number;
  originX?: number;
  originY?: number;
  // Whole numbers only, so pixels stay square.
  scale?: number;
}

function fontKey(scene: Scene, role: FontRole): string {
  const key = FONT_KEYS[role];
  return scene.cache.bitmapFont.exists(key) ? key : FALLBACK_FONT_KEY;
}

// Whether the role's font has a glyph for every character of text, spaces aside. The fallback
// font stands in for a missing font and draws its own capitals.
export function fontHasGlyphs(scene: Scene, role: FontRole, text: string): boolean {
  const key = fontKey(scene, role);
  if (key === FALLBACK_FONT_KEY) {
    return true;
  }
  const font = scene.cache.bitmapFont.get(key) as { data: { chars: Record<number, unknown> } };
  // Phaser keys a font's glyphs by character code.
  return [...textFor(key, role, text)].every(
    (char) => char === " " || font.data.chars[char.codePointAt(0) ?? 0] !== undefined,
  );
}

// The text in the characters the font has: the title font and the fallback are capitals.
function textFor(key: string, role: FontRole, text: string): string {
  if (key === FALLBACK_FONT_KEY) {
    return normalizePixelText(text);
  }
  return role === "title" ? plainMarks(text).toUpperCase() : plainMarks(text);
}

const ALIGN = { center: 1, left: 0, right: 2 } as const;

// How far below a line's top each font's capitals start, so y is the top of the capitals
// as in the mocks, whichever font draws it.
const CAP_TOP: Readonly<Record<FontRole, number>> = { body: 2, title: 4 };

// Text placed by its origin, at a whole-pixel position. With originY 0, y is the top of
// the capitals.
export function addPixelText(
  scene: Scene,
  x: number,
  y: number,
  text: string,
  style: PixelTextStyle,
): GameObjects.BitmapText {
  const role = style.font ?? "body";
  const key = fontKey(scene, role);
  const scale = style.scale ?? 1;
  const capTop = key === FALLBACK_FONT_KEY || (style.originY ?? 0) !== 0 ? 0 : CAP_TOP[role];
  const label = scene.add
    .bitmapText(Math.round(x), Math.round(y - capTop * scale), key, textFor(key, role, text))
    .setScale(scale)
    .setOrigin(style.originX ?? 0, style.originY ?? 0)
    .setTint(style.color);
  label.setData({ capTop: capTop * scale, fontRole: role });
  if (style.maxWidth !== undefined) {
    label.setMaxWidth(style.maxWidth);
  }
  if (style.align !== undefined) {
    label.align = ALIGN[style.align];
  }
  return label;
}

// Text broken at spaces into lines no wider than maxWidth screen pixels at the style's font and
// scale, measured on the font itself. A word wider than maxWidth gets a line of its own.
export function wrapPixelText(
  scene: Scene,
  style: PixelTextStyle,
  maxWidth: number,
  text: string,
): string[] {
  const probe = addPixelText(scene, 0, 0, "", style).setVisible(false);
  const width = (line: string) => {
    setPixelText(probe, line);
    return probe.width;
  };
  const lines = wrapWords(width, maxWidth, text);
  probe.destroy();
  return lines;
}

// Moves a label made by addPixelText, keeping y the top of its capitals.
export function placePixelText(label: GameObjects.BitmapText, x: number, y: number): void {
  const capTop = (label.getData("capTop") as number | undefined) ?? 0;
  label.setPosition(Math.round(x), Math.round(y - capTop));
}

// Rescales a label made by addPixelText or addDisplayText, keeping (x, y) its origin's x and
// the top of its capitals.
export function scalePixelText(
  label: GameObjects.BitmapText,
  scale: number,
  x: number,
  y: number,
): void {
  // The capitals' top at 1x, as the label's maker set it for its font and origin.
  const capTop = ((label.getData("capTop") as number | undefined) ?? 0) / label.scaleY;
  label.setScale(scale).setData("capTop", capTop * scale);
  placePixelText(label, x, y);
}

// The columns a label's glyphs ink, from its left edge, in screen pixels: the first glyph's
// left side bearing and the last glyph's right one left out.
export function inkSpan(label: GameObjects.BitmapText): { left: number; right: number } {
  const inked = label.getTextBounds(true).characters.filter((char) => char.w > 0);
  if (inked.length === 0) {
    return { left: 0, right: 0 };
  }
  const left = Math.min(...inked.map((char) => char.x));
  const right = Math.max(...inked.map((char) => char.x + char.w));
  return { left: left * label.scaleX, right: right * label.scaleX };
}

// Sets the label in the first of styles whose ink is no wider than room, else the last,
// keeping (x, y) its origin's x and the top of its capitals, and returns that style.
export function fitPixelText(
  label: GameObjects.BitmapText,
  fit: { room: number; styles: readonly TextFitStyle[] },
  x: number,
  y: number,
): TextFitStyle {
  const apply = (style: TextFitStyle) => {
    label.setLetterSpacing(style.letterSpacing);
    scalePixelText(label, style.scale, x, y);
    return label;
  };
  const inkWidth = (style: TextFitStyle) => {
    const ink = inkSpan(apply(style));
    return ink.right - ink.left;
  };
  const style = fittingTextStyle(fit.styles, inkWidth, fit.room);
  apply(style);
  return style;
}

// Sets new text, in the characters the label's font has, only when it changed.
export function setPixelText(label: GameObjects.BitmapText, text: string): void {
  const role = (label.getData("fontRole") as FontRole | undefined) ?? "body";
  const next = textFor(label.font, role, text);
  if (label.text !== next) {
    label.setText(next);
  }
}
