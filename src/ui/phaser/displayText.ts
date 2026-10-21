import type { GameObjects, Scene } from "phaser";

import { plainMarks } from "../pixelFont";
import { addPixelText, type PixelTextStyle } from "./pixelText";

// The sign logo's lettering: capitals with the outline and shadow baked in, so it is never
// tinted. yellow is for dark panels; cream is for where yellow clashes.
export type DisplayVariant = "cream" | "yellow";

const DISPLAY_FONT_KEYS: Readonly<Record<DisplayVariant, string>> = {
  cream: "font-display-cream",
  yellow: "font-display",
};

// The capitals start this many rows into a line, 10 rows tall: font-title's at scale 2.
const CAP_TOP = 3;

interface FontData {
  chars: Readonly<Record<number, unknown>>;
}

// The variant's font key when it is loaded and has every character of the text.
function displayFontKey(scene: Scene, variant: DisplayVariant, text: string): string | undefined {
  const key = DISPLAY_FONT_KEYS[variant];
  if (!scene.cache.bitmapFont.exists(key)) {
    return undefined;
  }
  const { chars } = (scene.cache.bitmapFont.get(key) as { data: FontData }).data;
  // Phaser keys a font's glyphs by character code.
  return [...text].every((char) => char === " " || chars[char.codePointAt(0) ?? 0] !== undefined)
    ? key
    : undefined;
}

// Whether addDisplayText draws this text in the variant's font rather than falling back.
export function hasDisplayFont(
  scene: Scene,
  text: string,
  variant: DisplayVariant = "yellow",
): boolean {
  return displayFontKey(scene, variant, plainMarks(text).toUpperCase()) !== undefined;
}

export interface DisplayTextStyle extends PixelTextStyle {
  variant?: DisplayVariant;
}

// Upper-cased text in the display font at scale 1, placed as addPixelText places it (y is the
// top of the capitals with originY 0). Falls back to addPixelText with the same style while the
// font is missing or lacks one of the text's characters.
export function addDisplayText(
  scene: Scene,
  x: number,
  y: number,
  text: string,
  style: DisplayTextStyle,
): GameObjects.BitmapText {
  const label = plainMarks(text).toUpperCase();
  const key = displayFontKey(scene, style.variant ?? "yellow", label);
  if (key === undefined) {
    return addPixelText(scene, x, y, text, style);
  }
  const capTop = (style.originY ?? 0) === 0 ? CAP_TOP : 0;
  const display = scene.add
    .bitmapText(Math.round(x), Math.round(y - capTop), key, label)
    .setOrigin(style.originX ?? 0, style.originY ?? 0);
  // So placePixelText and setPixelText keep the capitals' top and upper-case new text.
  display.setData({ capTop, fontRole: "title" });
  return display;
}
