import type { GameObjects, Scene } from "phaser";

import { COMIC_WORDS, type ComicGlyph, comicWordWidth } from "../layout/comicWords";
import type { Point } from "../layout/rect";

// font-comic: the comic words' lettering, colours baked in, so drawn untinted.
const COMIC_FONT = "font-comic";

// The word's drawn width in font-comic, or undefined while the font is missing or lacks one
// of its characters, when no word is drawn.
export function loadedComicWordWidth(scene: Scene, word: string): number | undefined {
  if (!scene.cache.bitmapFont.exists(COMIC_FONT)) {
    return undefined;
  }
  const font = scene.cache.bitmapFont.get(COMIC_FONT) as {
    data: { chars: Record<number, ComicGlyph | undefined> };
  };
  // Phaser keys a font's glyphs by character code.
  return comicWordWidth((char) => font.data.chars[char.codePointAt(0) ?? 0], word);
}

// Draws the word with its ring's top-left at the point, at a whole scale; undefined while
// font-comic cannot draw it. Glyphs draw left to right, each over the last, so each ring
// lands on the gap before it.
function addComicWord(
  scene: Scene,
  point: Point,
  depth: number,
  scale: number,
  word: string,
): GameObjects.BitmapText | undefined {
  if (loadedComicWordWidth(scene, word) === undefined) {
    return undefined;
  }
  return scene.add
    .bitmapText(point.x, point.y, COMIC_FONT, word)
    .setOrigin(0)
    .setScale(scale)
    .setDepth(depth);
}

// Shows the word over a one-shot effect's sprite at a place on its frame while the effect is
// on one of its first frames, and removes it with the sprite.
export function letterEffect(
  sprite: GameObjects.Sprite,
  place: Point,
  frames: number,
  word: string,
): void {
  const left = sprite.x - sprite.displayOriginX * sprite.scaleX;
  const top = sprite.y - sprite.displayOriginY * sprite.scaleY;
  const text = addComicWord(
    sprite.scene,
    { x: left + place.x * sprite.scaleX, y: top + place.y * sprite.scaleY },
    sprite.depth,
    sprite.scaleX,
    word,
  );
  if (text === undefined) {
    return;
  }
  // Phaser numbers an animation's frames from 1.
  sprite.on("animationupdate", (_: unknown, frame: { index: number }) => {
    text.setVisible(frame.index <= frames);
  });
  sprite.once("destroy", () => text.destroy());
}

// The bark word in its frame centred on the point, stepping through its tops and gone after
// the last; false, with nothing drawn, while font-comic cannot draw it.
export function playBarkWord(scene: Scene, point: Point, depth: number, word: string): boolean {
  const { frame, ms, tops, x } = COMIC_WORDS.bark;
  const left = Math.round(point.x) - frame.width / 2;
  const top = Math.round(point.y) - frame.height / 2;
  const text = addComicWord(scene, { x: left + x, y: top + tops[0] }, depth, 1, word);
  if (text === undefined) {
    return false;
  }
  let at = 0;
  tops.forEach((rows, step) => {
    if (step > 0) {
      scene.time.delayedCall(at, () => text.setY(top + rows));
    }
    at += ms[step] ?? 0;
  });
  scene.time.delayedCall(at, () => text.destroy());
  return true;
}
