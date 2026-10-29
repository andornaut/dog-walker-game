import { remapRgb } from "@andornaut/game-kit/rgba";

import { ONE_STEP_DARKER } from "./housePalette";

function distance(a: number, b: number): number {
  const red = ((a >> 16) & 0xff) - ((b >> 16) & 0xff);
  const green = ((a >> 8) & 0xff) - ((b >> 8) & 0xff);
  const blue = (a & 0xff) - (b & 0xff);
  return red * red + green * green + blue * blue;
}

// The palette colour nearest the colour, so a blended pixel still lands on a ramp.
function nearestPaletteColour(colour: number): number {
  let best = colour;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ONE_STEP_DARKER.keys()) {
    const d = distance(candidate, colour);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

// The colour moved steps down its ramp, after snapping it to the palette.
export function darkerColour(steps: number, colour: number): number {
  let result = nearestPaletteColour(colour);
  for (let i = 0; i < steps; i += 1) {
    result = ONE_STEP_DARKER.get(result) ?? result;
  }
  return result;
}

// Remaps RGBA pixel data in place, steps down the ramps, leaving alpha alone.
export function remapDarker(steps: number, pixels: Uint8ClampedArray): void {
  remapRgb((colour) => darkerColour(steps, colour), pixels);
}
