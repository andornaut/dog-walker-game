// Remaps RGBA pixel data in place, each pixel's colour (0xRRGGBB) to what remap gives for it,
// leaving alpha alone. Each distinct colour is remapped once.
export function remapRgb(remap: (color: number) => number, pixels: Uint8ClampedArray): void {
  const cache = new Map<number, number>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const color = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
    let mapped = cache.get(color);
    if (mapped === undefined) {
      mapped = remap(color);
      cache.set(color, mapped);
    }
    pixels[i] = (mapped >> 16) & 0xff;
    pixels[i + 1] = (mapped >> 8) & 0xff;
    pixels[i + 2] = mapped & 0xff;
  }
}
