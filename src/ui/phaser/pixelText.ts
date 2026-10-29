import { wrapWords } from "@andornaut/game-kit/lines";
import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Types } from "phaser";

import { type FontMetrics, fontMetrics, leftBearing } from "../fontMetrics";
import { inkWithPills, type LaidChar, laidPills, pillGlyphAdvances, pillRows } from "../namePills";
import {
  GLYPH_HEIGHT,
  glyphAdvance,
  LINE_HEIGHT,
  normalizePixelText,
  pixelFontAtlas,
  plainMarks,
} from "../pixelFont";
import { type FittedText, fittingText, type TextFitStyle } from "../textFit";

// body: mixed case, for running text, card effects and labels. title: capitals, for
// titles, numbers, money and buttons. Both are white glyphs, tinted to a palette colour.
export type FontRole = "body" | "title";

const FONT_KEYS: Readonly<Record<FontRole, string>> = { body: "font-body", title: "font-title" };

// Drawn from the 3x5 fallback glyphs when a manifest font is missing.
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
  align?: "centre" | "left" | "right";
  colour: number;
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

// Whether the loaded bitmap font at key has a glyph for every character of text, spaces aside.
export function bitmapFontHasChars(scene: Scene, key: string, text: string): boolean {
  const font = scene.cache.bitmapFont.get(key) as { data: { chars: Record<number, unknown> } };
  // Phaser keys a font's glyphs by character code.
  return [...text].every(
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

const ALIGN = { centre: 1, left: 0, right: 2 } as const;

// The fallback font's capitals fill its glyphs, from the line's top.
const FALLBACK_METRICS: FontMetrics = {
  capHeight: GLYPH_HEIGHT,
  capTop: 0,
  inkBottom: GLYPH_HEIGHT,
  letterTop: 0,
  lineHeight: LINE_HEIGHT,
};

const METRICS = new WeakMap<object, FontMetrics>();

// The rows of the font that draws role, read from the font as loaded: where its capitals start
// and end, its lowest ink and its line height, in font pixels.
export function pixelFontMetrics(scene: Scene, role: FontRole): FontMetrics {
  const key = fontKey(scene, role);
  if (key === FALLBACK_FONT_KEY) {
    return FALLBACK_METRICS;
  }
  const { data } = scene.cache.bitmapFont.get(key) as {
    data: Types.GameObjects.BitmapText.BitmapFontData;
  };
  return getOrInsertComputed(
    data,
    () => {
      // Phaser keys a font's glyphs by character code.
      const glyphs = new Map(
        Object.entries(data.chars).map(([code, glyph]) => [
          String.fromCodePoint(Number(code)),
          { height: glyph.height, yOffset: glyph.yOffset },
        ]),
      );
      return fontMetrics({ glyphs, lineHeight: data.lineHeight });
    },
    METRICS,
  );
}

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
  // So y is the top of the capitals, whichever font draws it.
  const capTop = (style.originY ?? 0) !== 0 ? 0 : pixelFontMetrics(scene, role).capTop;
  const shown = textFor(key, role, text);
  const shift = titleInkShift(scene, key, style.originX ?? 0, shown) * scale;
  const label = scene.add
    .bitmapText(Math.round(x) - shift, Math.round(y - capTop * scale), key, shown)
    .setScale(scale)
    .setOrigin(style.originX ?? 0, style.originY ?? 0)
    .setTint(style.colour);
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
  return withProbe(scene, style, (probe) => {
    const width = (line: string) => {
      setPixelText(probe, line);
      return probe.width;
    };
    return wrapWords(width, maxWidth, text);
  });
}

// What measure reads off a hidden label in style, made for it and destroyed after: text is
// measured on the font it is drawn in.
export function withProbe<T>(
  scene: Scene,
  style: PixelTextStyle,
  measure: (probe: GameObjects.BitmapText) => T,
): T {
  const probe = addPixelText(scene, 0, 0, "", style).setVisible(false);
  const measured = measure(probe);
  probe.destroy();
  return measured;
}

// Moves a label made by addPixelText, keeping y the top of its capitals and, for a left-aligned
// title label, x the first column of its ink.
export function placePixelText(label: GameObjects.BitmapText, x: number, y: number): void {
  const capTop = (label.getData("capTop") as number | undefined) ?? 0;
  label.setPosition(Math.round(x) - labelInkShift(label), Math.round(y - capTop));
}

// font-title's glyphs start a column into their advance, where font-body's start at the pen. A
// left-aligned title label sits left by its first glyph's left side bearing, in font pixels, so
// its ink starts at x, in line with body text in the same column. Centred and right-aligned
// labels keep their place: both fonts end a glyph one column short of its advance.
function titleInkShift(scene: Scene, key: string, originX: number, text: string): number {
  if (key !== FONT_KEYS.title || originX !== 0) {
    return 0;
  }
  const { data } = scene.cache.bitmapFont.get(key) as {
    data: Types.GameObjects.BitmapText.BitmapFontData;
  };
  return glyphLeftBearing(data, text);
}

function glyphLeftBearing(data: Types.GameObjects.BitmapText.BitmapFontData, text: string): number {
  // Phaser keys a font's glyphs by character code.
  return leftBearing((char) => data.chars[char.codePointAt(0) ?? 0], text);
}

// The screen pixels titleInkShift sets a label made by addPixelText left of its x.
function labelInkShift(label: GameObjects.BitmapText): number {
  if (label.font !== FONT_KEYS.title || label.originX !== 0) {
    return 0;
  }
  return glyphLeftBearing(label.fontData, label.text) * label.scaleX;
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

// The columns a label's glyphs and pills ink, from its left edge, in screen pixels: the first
// glyph's left side bearing and the last glyph's right one left out.
export function inkSpan(label: GameObjects.BitmapText): { left: number; right: number } {
  const ink = inkWithPills(1, label.getTextBounds(true).characters.map(laidChar));
  return ink === null
    ? { left: 0, right: 0 }
    : { left: ink.left * label.scaleX, right: ink.right * label.scaleX };
}

// A character Phaser laid out, as ui/namePills.ts reads it.
function laidChar(char: Types.GameObjects.BitmapText.BitmapTextCharacter): LaidChar {
  return {
    char: char.char,
    ink: char.w > 0 ? { left: char.x, right: char.x + char.w } : null,
    line: char.line,
  };
}

// Sets the label's text in fit's style (fittingText), wrapped within fit's room where the style
// takes more than one line, keeping (x, y) its origin's x and the top of its first line's
// capitals. Returns the style and the lines.
export function fitPixelText(
  label: GameObjects.BitmapText,
  fit: { room: number; style: TextFitStyle },
  x: number,
  y: number,
): FittedText {
  const fitted = fittingText(fit.style, labelInkWidth(label), fit.room, label.text);
  setFittedText(label, fitted, x, y);
  return fitted;
}

// A line's ink width in label's font at a style, measured by setting it on label; set the
// label's text afterwards with setFittedText.
export function labelInkWidth(
  label: GameObjects.BitmapText,
): (style: TextFitStyle, line: string) => number {
  return (style, line) => {
    setPixelText(label, line);
    scalePixelText(label, style.scale, label.x, label.y);
    const ink = inkSpan(label);
    return ink.right - ink.left;
  };
}

// Sets text fitted as fittingText gives it on label, keeping (x, y) its origin's x and the top
// of its first line's capitals.
export function setFittedText(
  label: GameObjects.BitmapText,
  fitted: FittedText,
  x: number,
  y: number,
): void {
  setPixelText(label, fitted.lines.join("\n"));
  scalePixelText(label, fitted.style.scale, x, y);
}

// Sets new text, in the characters the label's font has, only when it changed.
export function setPixelText(label: GameObjects.BitmapText, text: string): void {
  const role = (label.getData("fontRole") as FontRole | undefined) ?? "body";
  const next = textFor(label.font, role, text);
  if (label.text !== next) {
    // So a left-aligned title label's ink keeps starting at the same x.
    const before = labelInkShift(label);
    label.setText(next);
    const after = labelInkShift(label);
    if (after !== before) {
      label.setX(label.x + before - after);
    }
  }
}

// Each pill in a label's text (ui/namePills.ts): its kind, the rect it covers in the label's
// parent's coordinates, and the indices Phaser tints its name's characters by.
export function labelPills(
  label: GameObjects.BitmapText,
): { index: number; name: number[]; rect: Rect }[] {
  // Read first: it also updates the label's display origin.
  const { characters } = label.getTextBounds(false);
  const rows = pillRows(1);
  const left = label.x - label.displayOriginX * label.scaleX;
  const top = label.y - label.displayOriginY * label.scaleY;
  return laidPills(1, characters.map(laidChar)).map((pill) => {
    const lineTop = characters[pill.name[0] ?? 0]?.t ?? 0;
    return {
      index: pill.index,
      // Phaser tints a character by its index among the characters it draws (i).
      name: pill.name.map((at) => characters[at]?.i ?? 0),
      rect: {
        height: rows.height * label.scaleY,
        width: (pill.right - pill.left) * label.scaleX,
        x: left + pill.left * label.scaleX,
        y: top + (lineTop + rows.top) * label.scaleY,
      },
    };
  });
}

// Gives each loaded pixel font a blank glyph for each pill character (ui/namePills.ts), copied
// from its space with the pill's advance, so measuring, fitting and wrapping make room for pills.
export function addPillGlyphs(scene: Scene): void {
  for (const key of [...Object.values(FONT_KEYS), FALLBACK_FONT_KEY]) {
    if (!scene.cache.bitmapFont.exists(key)) {
      continue;
    }
    // Phaser keys a font's glyphs by character code, each with its advance.
    type Glyph = Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };
    const { data } = scene.cache.bitmapFont.get(key) as { data: { chars: Record<number, Glyph> } };
    const space = data.chars[" ".codePointAt(0) ?? 32];
    if (space === undefined) {
      continue;
    }
    for (const [char, advance] of pillGlyphAdvances(space.xAdvance)) {
      data.chars[char.codePointAt(0) ?? 0] = { ...space, kerning: {}, xAdvance: advance };
    }
  }
}
