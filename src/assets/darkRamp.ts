// Each Endesga 32 colour and the colour one step down its ramp, as the art mocks darken.
// Ink is the darkest step and stays ink.
const ONE_STEP_DARKER: ReadonlyMap<number, number> = new Map([
  [0xbe4a2f, 0x733e39],
  [0xd77643, 0xbe4a2f],
  [0xead4aa, 0xe4a672],
  [0xe4a672, 0xb86f50],
  [0xb86f50, 0x733e39],
  [0x733e39, 0x3e2731],
  [0x3e2731, 0x181425],
  [0xa22633, 0x3e2731],
  [0xe43b44, 0xa22633],
  [0xf77622, 0xbe4a2f],
  [0xfeae34, 0xf77622],
  [0xfee761, 0xfeae34],
  [0x63c74d, 0x3e8948],
  [0x3e8948, 0x265c42],
  [0x265c42, 0x193c3e],
  [0x193c3e, 0x181425],
  [0x124e89, 0x262b44],
  [0x0099db, 0x124e89],
  [0x2ce8f5, 0x0099db],
  [0xffffff, 0xc0cbdc],
  [0xc0cbdc, 0x8b9bb4],
  [0x8b9bb4, 0x5a6988],
  [0x5a6988, 0x3a4466],
  [0x3a4466, 0x262b44],
  [0x262b44, 0x181425],
  [0x181425, 0x181425],
  [0xff0044, 0xa22633],
  [0x68386c, 0x3e2731],
  [0xb55088, 0x68386c],
  [0xf6757a, 0xb55088],
  [0xe8b796, 0xc28569],
  [0xc28569, 0xb86f50],
]);

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
