// Every pixel that shows at all becomes fully opaque color, and every clear pixel stays
// clear, so a locked item shows its shape and nothing else. pixels is RGBA, 4 bytes a pixel.
export function remapToSilhouette(color: number, pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) {
      continue;
    }
    pixels[i] = (color >> 16) & 0xff;
    pixels[i + 1] = (color >> 8) & 0xff;
    pixels[i + 2] = color & 0xff;
    pixels[i + 3] = 0xff;
  }
}
