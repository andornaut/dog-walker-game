// The palette's grey ramp, lightest first. A disabled card is redrawn in these greys.
export const GREY_RAMP = [0xffffff, 0xc0cbdc, 0x8b9bb4, 0x5a6988, 0x3a4466, 0x262b44, 0x181425];

function brightness(color: number): number {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

// The grey whose brightness is nearest the colour's, so light stays light and dark dark.
export function greyFor(color: number): number {
  const target = brightness(color);
  let best = GREY_RAMP[0] ?? color;
  for (const grey of GREY_RAMP) {
    if (Math.abs(brightness(grey) - target) < Math.abs(brightness(best) - target)) {
      best = grey;
    }
  }
  return best;
}

// Remaps RGBA pixel data in place, leaving alpha alone.
export function remapToGrey(pixels: Uint8ClampedArray): void {
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const color = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
    const grey = greyFor(color);
    pixels[i] = (grey >> 16) & 0xff;
    pixels[i + 1] = (grey >> 8) & 0xff;
    pixels[i + 2] = grey & 0xff;
  }
}
