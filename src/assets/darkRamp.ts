import { ONE_STEP_DARKER } from "./housePalette";

function distance(a: number, b: number): number {
  const red = ((a >> 16) & 0xff) - ((b >> 16) & 0xff);
  const green = ((a >> 8) & 0xff) - ((b >> 8) & 0xff);
  const blue = (a & 0xff) - (b & 0xff);
  return red * red + green * green + blue * blue;
}

// The palette colour nearest the colour, so a blended pixel still lands on a ramp.
function nearestPaletteColor(color: number): number {
  let best = color;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ONE_STEP_DARKER.keys()) {
    const d = distance(candidate, color);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

// The colour moved steps down its ramp, after snapping it to the palette.
export function darkerColor(steps: number, color: number): number {
  let result = nearestPaletteColor(color);
  for (let i = 0; i < steps; i += 1) {
    result = ONE_STEP_DARKER.get(result) ?? result;
  }
  return result;
}

// Remaps RGBA pixel data in place, steps down the ramps, leaving alpha alone.
export function remapDarker(steps: number, pixels: Uint8ClampedArray): void {
  const cache = new Map<number, number>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const color = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
    let dark = cache.get(color);
    if (dark === undefined) {
      dark = darkerColor(steps, color);
      cache.set(color, dark);
    }
    pixels[i] = (dark >> 16) & 0xff;
    pixels[i + 1] = (dark >> 8) & 0xff;
    pixels[i + 2] = dark & 0xff;
  }
}
