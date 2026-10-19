import type { ZoneId } from "../data/types";

// What lies beside the projected road, as art/tools/backdrops.py paints it below the
// backdrops' streets, so the verge under the band continues the band's bottom row. across is
// how far from the road's centre line a pixel is, in road pixels (the road is across < ROAD_HALF);
// x is the same measure signed, negative on the left. z is a road distance from the start of
// the walk, so seams, dots, tufts, leaves and rough patches scroll with the road; mown stripes
// run along the street and stay put. span is how much road a screen row covers, and scale the
// row's ground scale.

// Endesga 32 colours.
const GREEN = 0x63c74d;
const DARK_GREEN = 0x3e8948;
const FOREST = 0x265c42;
const GREY = 0x8b9bb4;
const SLATE = 0x5a6988;
const LIGHT_GREY = 0xc0cbdc;
const OCHRE = 0xd77643;
const RUST = 0xbe4a2f;
const DARK_BROWN = 0x733e39;
const BROWN = 0xb86f50;
const TAN = 0xe4a672;
const CREAM = 0xead4aa;
const WHITE = 0xffffff;
const RED = 0xe43b44;
const YELLOW = 0xfee761;
const ORANGE = 0xf77622;

// Verge distances count out from the road's edge, so they move with the road's width.
const ROAD_HALF = 140;
const CURB = ROAD_HALF + 4;
const WALK = ROAD_HALF + 48;
const SEAM_EVERY = 32;
// A row covering more road than SEAM_MAX_SPAN draws no seams, as they would run together.
const SEAM_MAX_SPAN = 16;
// Mown stripe widths across the front lawns, outward from the sidewalk, alternating light and
// dark, out to MOWN_REACH past the sidewalk. A dark stripe narrower than MOWN_MIN_PX on screen
// is left light, so stripes end before they shimmer.
const MOWN = [44, 62, 36, 70, 50, 58, 40, 66] as const;
const MOWN_REACH = 300;
const MOWN_MIN_PX = 4;
// The ground scale on the backdrop's bottom row, where the art's mark rates are set.
const BAND_SCALE = 0.5;

// Dots of other colours scattered over a band of the verge: share is the part of the band's
// pixels they cover, which its colours split equally.
export interface VergeDots {
  readonly colors: readonly number[];
  readonly share: number;
}

// A band of one colour, with its dots, running out to its to, across.
export interface VergeStrip {
  readonly color: number;
  readonly dots: readonly VergeDots[];
  readonly to: number;
}

// Outward from the road: the curb, the strips, the sidewalk or paving, then the lawn.
export interface Verge {
  // A curb that would match the road's grey is darker, so the road's edge still reads.
  readonly curbColor: number;
  // Where the curb ends and the sidewalk or paving ends, across; the lawn lies beyond.
  readonly curbTo: number;
  // Fallen leaves on the sidewalks and lawns.
  readonly leaves: boolean;
  // Mown stripes on the front lawns, or an unmown lawn with rough patches.
  readonly lawn: "mown" | "rough" | "none";
  // The line across the sidewalk or paving, every seamEvery along the road.
  readonly seamColor: number;
  readonly seamEvery: number;
  // The bands between the curb and the sidewalk or paving, outward.
  readonly strips: readonly VergeStrip[];
  readonly walkColor: number;
  readonly walkDots: readonly VergeDots[];
  readonly walkTo: number;
}

// A grey sidewalk with grey seams, straight off the curb.
const SIDEWALK = {
  seamColor: GREY,
  seamEvery: SEAM_EVERY,
  strips: [],
  walkColor: LIGHT_GREY,
  walkDots: [],
} as const;

export const VERGES: Readonly<Record<ZoneId, Verge>> = {
  homeStretch: {
    ...SIDEWALK,
    curbColor: GREY,
    curbTo: CURB,
    lawn: "mown",
    leaves: true,
    walkTo: WALK,
  },
  park: {
    ...SIDEWALK,
    curbColor: GREY,
    curbTo: ROAD_HALF,
    lawn: "rough",
    leaves: false,
    walkTo: ROAD_HALF,
  },
  // A riverside path: paving straight off the road, no curb, then rough lawn.
  pawsPromenade: {
    ...SIDEWALK,
    curbColor: GREY,
    curbTo: ROAD_HALF,
    lawn: "rough",
    leaves: false,
    walkTo: WALK,
  },
  // A white curb, a planter of greens and flowers edged in brown, a tan edging, then cream
  // paving with tan seams and specks out to the screen's edges.
  shops: {
    curbColor: WHITE,
    curbTo: CURB,
    lawn: "none",
    leaves: false,
    seamColor: TAN,
    seamEvery: SEAM_EVERY,
    strips: [
      { color: BROWN, dots: [], to: ROAD_HALF + 6 },
      {
        color: GREEN,
        dots: [
          { colors: [DARK_GREEN], share: 0.35 },
          { colors: [RED, YELLOW, WHITE, ORANGE], share: 0.1 },
        ],
        to: ROAD_HALF + 18,
      },
      { color: BROWN, dots: [], to: ROAD_HALF + 20 },
      { color: TAN, dots: [], to: ROAD_HALF + 22 },
    ],
    walkColor: CREAM,
    walkDots: [{ colors: [TAN], share: 0.02 }],
    walkTo: Number.POSITIVE_INFINITY,
  },
  snoozeCrescent: {
    ...SIDEWALK,
    curbColor: SLATE,
    curbTo: CURB,
    lawn: "mown",
    leaves: false,
    walkTo: WALK,
  },
  street: {
    ...SIDEWALK,
    curbColor: GREY,
    curbTo: CURB,
    lawn: "mown",
    leaves: false,
    walkTo: WALK,
  },
};

// Where the sidewalk or paving starts, across: past the curb and the strips.
export function walkFrom(verge: Verge): number {
  return verge.strips.at(-1)?.to ?? verge.curbTo;
}

// A band of the verge that carries dots, from and to across.
export interface DottedBand {
  readonly dots: readonly VergeDots[];
  readonly from: number;
  readonly to: number;
}

// The verge's strips and its sidewalk or paving that carry dots, outward.
export function dottedBands(verge: Verge): DottedBand[] {
  const strips = verge.strips.map((strip, i) => ({
    dots: strip.dots,
    from: verge.strips[i - 1]?.to ?? verge.curbTo,
    to: strip.to,
  }));
  const walk = { dots: verge.walkDots, from: walkFrom(verge), to: verge.walkTo };
  return [...strips, walk].filter((band) => band.dots.length > 0 && band.to > band.from);
}

// The dot colour a noise value in [0, 1) picks, or null for none: each dot takes its share of
// the range in turn, its colours equal parts of that share.
export function dotColor(dots: readonly VergeDots[], value: number): number | null {
  let rest = value;
  for (const { colors, share } of dots) {
    if (rest < share) {
      return colors[Math.floor((rest / share) * colors.length)] ?? null;
    }
    rest -= share;
  }
  return null;
}

// Whether a line every period along the road falls on this row: exactly one row shows each
// line, however much road the row covers, so a line never blinks as the road scrolls.
export function crossesLine(period: number, z: number, span: number): boolean {
  return Math.floor(z / period) !== Math.floor((z - Math.max(span, 1)) / period);
}

// Whether this row of the verge's sidewalk or paving is a seam.
export function seamRow(verge: Verge, z: number, span: number): boolean {
  return span < SEAM_MAX_SPAN && crossesLine(verge.seamEvery, z, span);
}

// Whether the front lawn at across falls in a dark mown stripe, on a row of this scale; the
// stripes start at the sidewalk's outer edge, walkTo.
export function mownAt(walkTo: number, across: number, scale: number): boolean {
  let rest = across - walkTo;
  if (rest < 0 || rest >= MOWN_REACH) {
    return false;
  }
  let i = 0;
  let width: number = MOWN[0];
  while (rest >= width) {
    rest -= width;
    i += 1;
    width = MOWN[i % MOWN.length] ?? width;
  }
  return i % 2 === 1 && width * scale >= MOWN_MIN_PX;
}

// The verge's colour at across on a row of this scale, before seams, dots, patches and marks.
export function vergeBase(verge: Verge, across: number, scale: number): number {
  if (across < verge.curbTo) {
    return verge.curbColor;
  }
  for (const strip of verge.strips) {
    if (across < strip.to) {
      return strip.color;
    }
  }
  if (across < verge.walkTo) {
    return verge.walkColor;
  }
  return verge.lawn === "mown" && mownAt(verge.walkTo, across, scale) ? DARK_GREEN : GREEN;
}

// The next darker green, for a tuft or a rough patch on the lawn.
export function darkerGreen(rgb: number): number {
  return rgb === GREEN ? DARK_GREEN : FOREST;
}

export function isLawn(verge: Verge, across: number): boolean {
  return verge.lawn !== "none" && across >= verge.walkTo;
}

// A fixed pseudo-random value in [0, 1) for two integers, mixed so picks fall irregularly.
export function noise(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 65536;
}

// A mark on the verge, 2 rows tall: a tuft of grass on the lawn or a fallen leaf on the
// sidewalk or lawn. x is across, signed; keep decides, against markShows, whether it shows on
// a row, so marks thin out with distance.
export interface VergeMark {
  readonly keep: number;
  readonly kind: "leaf" | "tuft";
  readonly shape: number;
  readonly x: number;
}

// Marks per road pixel of verge, and the share of a screen row's pixels that start one: tufts
// as on the backdrop's bottom row, thicker toward the walker; leaves sparser.
const MARK_FIELD = { from: ROAD_HALF + 6, to: 300 } as const;
const MARK_DENSITY = { leaf: 0.016, tuft: 0.08 } as const;
const MARK_RATE = { leaf: { max: 0.012, rate: 0.004 }, tuft: { max: 0.06, rate: 0.03 } } as const;

// The marks starting on road row k, each kind in order of keep: the same every time for the
// same row.
export interface RowMarks {
  readonly leaf: readonly VergeMark[];
  readonly tuft: readonly VergeMark[];
}

export function marksOnRow(k: number): RowMarks {
  const width = 2 * (MARK_FIELD.to - MARK_FIELD.from);
  const make = (kind: VergeMark["kind"], salt: number) => {
    const count = Math.floor(MARK_DENSITY[kind] * width + noise(k, salt));
    return Array.from({ length: count }, (_, i): VergeMark => {
      const across =
        MARK_FIELD.from + noise(k, salt + 2 * i + 1) * (MARK_FIELD.to - MARK_FIELD.from);
      return {
        keep: noise(k + salt, i),
        kind,
        shape: Math.floor(noise(i + salt, k) * LEAF_SHAPES.length),
        x: (noise(i, k + salt) < 0.5 ? -1 : 1) * across,
      };
    }).sort((first, second) => first.keep - second.keep);
  };
  return { leaf: make("leaf", 59), tuft: make("tuft", 17) };
}

// The keep below which a mark of this kind shows on a row of this scale and span: each kind
// then starts on about its rate of the row's pixels, from the marks the row's road holds.
export function markLimit(kind: VergeMark["kind"], scale: number, span: number): number {
  const { max, rate } = MARK_RATE[kind];
  const wanted = Math.min(max, rate * (scale / BAND_SCALE) ** 2);
  return (wanted * scale) / (MARK_DENSITY[kind] * span);
}

// The least across a mark of this kind may lie at on the verge, or Infinity where it has none.
export function markFrom(verge: Verge, kind: VergeMark["kind"]): number {
  if (kind === "tuft") {
    return verge.lawn === "none" ? Number.POSITIVE_INFINITY : verge.walkTo;
  }
  return verge.leaves ? MARK_FIELD.from : Number.POSITIVE_INFINITY;
}

// Whether a mark of this kind may lie at across: a tuft on the lawn, a leaf on the sidewalk
// or lawn of a verge that has leaves.
export function markFits(verge: Verge, kind: VergeMark["kind"], across: number): boolean {
  if (kind === "tuft") {
    return isLawn(verge, across);
  }
  return verge.leaves && across >= MARK_FIELD.from;
}

// A leaf's two rows, a lit half (f) and a shaded half (v), as the backdrops draw them.
const LEAF_SHAPES = [
  ["ff.", ".fv"],
  [".ff", "fv."],
  [".f", "fv"],
] as const;
const LEAF_TONES = [
  [OCHRE, RUST],
  [RUST, DARK_BROWN],
  [OCHRE, DARK_BROWN],
] as const;

// Each leaf shape's pixels on its 2 rows: offsets from its column and their colours.
export const LEAF_PIXELS: readonly (readonly (readonly { color: number; dx: number }[])[])[] =
  LEAF_SHAPES.map((rows, shape) => {
    const [lit, shaded] = LEAF_TONES[shape % LEAF_TONES.length] ?? LEAF_TONES[0];
    return rows.map((cells) =>
      [...cells].flatMap((cell, dx) =>
        cell === "." ? [] : [{ color: cell === "f" ? lit : shaded, dx }],
      ),
    );
  });

// An unmown lawn's rough patches: ellipses x across (signed), z along, rx and rz their radii.
export interface RoughPatch {
  readonly rx: number;
  readonly rz: number;
  readonly x: number;
  readonly z: number;
}

// Patches are placed by blocks of road this long, and reach at most ROUGH_PATCH_REACH along
// it from their middles.
export const ROUGH_PATCH_BLOCK = 512;
export const ROUGH_PATCH_REACH = 150;
const PATCHES_PER_BLOCK = 10;

// The rough patches whose middles fall in road block b: 30 to 90 across and 50 to 150 along,
// 170 to 900 from the centre line on either side, as the backdrops place them.
export function roughPatches(block: number): RoughPatch[] {
  return Array.from({ length: PATCHES_PER_BLOCK }, (_, i) => {
    const side = noise(block, 3 * i) < 0.5 ? -1 : 1;
    return {
      rx: 30 + 60 * noise(i, block + 7),
      rz: 50 + (ROUGH_PATCH_REACH - 50) * noise(block + 11, i),
      x: side * (ROAD_HALF + 30 + 730 * noise(block, 3 * i + 1)),
      z: (block + noise(block, 3 * i + 2)) * ROUGH_PATCH_BLOCK,
    };
  });
}
