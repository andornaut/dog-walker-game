import type { SourceTexture } from "../tools/atlas/atlasLayout";
import { blankImage, type RgbaImage } from "../tools/atlas/atlasPixels";

// A sprite sheet drawn from text, its frames side by side and named by index: "." is a clear
// pixel and any other character an opaque colour of its own.
export function sheetFromRows(
  key: string,
  frames: readonly (readonly string[])[],
): { image: RgbaImage; texture: SourceTexture } {
  const height = frames[0]?.length ?? 0;
  const width = frames[0]?.[0]?.length ?? 0;
  const image = blankImage(width * frames.length, height);
  frames.forEach((rows, frame) => {
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const code = char.charCodeAt(0);
        if (char !== ".") {
          image.data.set([code, 0, 255 - code, 255], (y * image.width + frame * width + x) * 4);
        }
      });
    });
  });
  const sourceFrames = frames.map((_, frame) => ({
    duration: 100,
    from: { height, width, x: frame * width, y: 0 },
    name: String(frame),
  }));
  return { image, texture: { frames: sourceFrames, key, png: `sprites/${key}.png`, tags: [] } };
}
