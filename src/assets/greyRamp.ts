import { remapRgb } from "../lib/rgba";

// A grey copy's colours come from a ramp of greys, lightest first.

function brightness(colour: number): number {
  const red = (colour >> 16) & 0xff;
  const green = (colour >> 8) & 0xff;
  const blue = colour & 0xff;
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

// The index of the ramp colour whose brightness is nearest the colour's, the lighter on a tie.
function nearestIndex(ramp: readonly number[], colour: number): number {
  const target = brightness(colour);
  const gap = (i: number) => Math.abs(brightness(ramp[i] ?? colour) - target);
  let best = 0;
  ramp.forEach((_, i) => {
    if (gap(i) < gap(best)) {
      best = i;
    }
  });
  return best;
}

// The ramp grey whose brightness is nearest the colour's, then steps further down the ramp,
// stopping at its darkest; so light stays light and dark dark.
export function greyFor(ramp: readonly number[], steps: number, colour: number): number {
  const index = Math.min(nearestIndex(ramp, colour) + steps, ramp.length - 1);
  return ramp[index] ?? colour;
}

// Remaps RGBA pixel data in place, as greyFor does, leaving alpha alone.
export function remapToGrey(
  ramp: readonly number[],
  steps: number,
  pixels: Uint8ClampedArray,
): void {
  remapRgb((colour) => greyFor(ramp, steps, colour), pixels);
}
