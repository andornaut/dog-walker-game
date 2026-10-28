import * as v from "valibot";

import vergeTable from "../../shared/verges.json";
import { paletteColour } from "../assets/housePalette";
import { parseOrThrow } from "../assets/jsonSchema";
import { SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { lightKeySchema, lightZonesSchema, zonesOf } from "./lights";

// What lies beside the projected road, as art/tools/backdrops.py paints it below the
// backdrops' streets, so the verge under the band continues the band's bottom row. across is
// how far from the road's centre line a pixel is, in road pixels (the road is across <
// ROAD_HALF); x is the same measure signed, negative on the left. z is a road distance from
// the start of the walk, so seams, dots, tufts, leaves and rough patches scroll with the
// road; mown stripes run along the street and stay put. span is how much road a screen row
// covers, and scale the row's ground scale.

// Endesga 32 colours of the fallen leaves.
const OCHRE = 0xd77643;
const RUST = 0xbe4a2f;
const DARK_BROWN = 0x733e39;

const ROAD_HALF = SCREEN_CONFIG.roadWidth / 2;
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
interface VergeDots {
  readonly colours: readonly number[];
  readonly share: number;
}

// A band of one colour, with its dots, running out to its to, across.
interface VergeStrip {
  readonly colour: number;
  readonly dots: readonly VergeDots[];
  readonly to: number;
}

// The sides of the road, as a pool's offset names them.
export type VergeSide = "left" | "right";

// Lights repeating along the verge, each the light def keyed light, centred across from the
// road's centre line. Each side's lights stand every road px along its zone's road, counted
// from the zone's start strip as roadside props are, the first offset along; zones is the zones
// they show in, or null for every zone.
export interface VergePool {
  readonly across: number;
  readonly every: number;
  readonly light: string;
  readonly offset: Readonly<Record<VergeSide, number>>;
  readonly zones: readonly ZoneId[] | null;
}

// Outward from the road: the curb, the strips, the sidewalk or paving, then the lawn.
export interface Verge {
  // A curb that would match the road's grey is darker, so the road's edge still reads.
  readonly curbColour: number;
  // Where the curb ends and the sidewalk or paving ends, across; the lawn lies beyond.
  readonly curbTo: number;
  // Fallen leaves on the sidewalks and lawns.
  readonly leaves: boolean;
  // Mown stripes on the front lawns, or an unmown lawn with rough patches. A verge with no lawn
  // is paved out to the screen's edges: its walkTo is Infinity.
  readonly lawn: "mown" | "rough" | "none";
  // The lawn's base, its mown stripes or rough patches, and its tufts; null with no lawn.
  readonly lawnColours: LawnColours | null;
  // The lights on the curb, strips and sidewalk or paving; none for most verges.
  readonly pools: readonly VergePool[];
  // The line across the sidewalk or paving, every seamEvery along the road.
  readonly seamColour: number;
  readonly seamEvery: number;
  // The bands between the curb and the sidewalk or paving, outward.
  readonly strips: readonly VergeStrip[];
  readonly walkColour: number;
  readonly walkDots: readonly VergeDots[];
  readonly walkTo: number;
}

// A tuft draws its own colour over the lawn's base or its marks, rather than darkening them.
type LawnColours = readonly [base: number, marks: number, tufts: number];

// A verge as art writes it in shared/verges.json (art/tools/backdrops.py verges --write): the
// same fields with colours by palette name, a null walkTo for paving out to the screen's edges,
// lawnColours null with no lawn, and pools left out with none.
interface VergeDotsEntry {
  readonly colours: readonly string[];
  readonly share: number;
}

interface VergeEntry {
  readonly curbColour: string;
  readonly curbTo: number;
  readonly lawn: string;
  readonly lawnColours: readonly string[] | null;
  readonly leaves: boolean;
  readonly pools?: readonly unknown[];
  readonly seamColour: string;
  readonly seamEvery: number;
  readonly strips: readonly {
    readonly colour: string;
    readonly dots: readonly VergeDotsEntry[];
    readonly to: number;
  }[];
  readonly walkColour: string;
  readonly walkDots: readonly VergeDotsEntry[];
  readonly walkTo: number | null;
}

const LAWNS: readonly Verge["lawn"][] = ["mown", "rough", "none"];
function dotsOf(entries: readonly VergeDotsEntry[]): VergeDots[] {
  return entries.map(({ colours, share }) => ({ colours: colours.map(paletteColour), share }));
}

const whole = v.pipe(v.number(), v.integer());

// A pool from its entry, which must name a light def, lie on the verge inside the walk's outer
// edge, walkTo, and start within its period. Anything else, an unknown field included, throws.
function poolFrom(walkTo: number, entry: unknown): VergePool {
  const pool = parseOrThrow(
    "A verge pool",
    v.strictObject({
      across: whole,
      every: v.pipe(whole, v.minValue(1)),
      light: lightKeySchema,
      offset: v.strictObject({
        left: v.pipe(whole, v.minValue(0)),
        right: v.pipe(whole, v.minValue(0)),
      }),
      zones: lightZonesSchema,
    }),
    entry,
  );
  const { across, every, offset } = pool;
  if (across < ROAD_HALF || across >= walkTo) {
    throw new Error(`A verge pool at ${across} lies off the verge's curb and walk`);
  }
  if (offset.left >= every || offset.right >= every) {
    throw new Error("A verge pool's offsets lie within its period");
  }
  return { ...pool, zones: zonesOf(pool.zones) };
}

// A verge from its entry in shared/verges.json; a lawn kind, pool or colour it does not know or
// that does not fit throws.
export function vergeFrom(entry: VergeEntry): Verge {
  const lawn = LAWNS.find((kind) => kind === entry.lawn);
  if (lawn === undefined) {
    throw new Error(`No verge lawn ${entry.lawn}`);
  }
  const [base, marks, tufts] = (entry.lawnColours ?? []).map(paletteColour);
  const hasLawn = lawn !== "none";
  if (hasLawn !== (base !== undefined && marks !== undefined && tufts !== undefined)) {
    throw new Error("A verge has lawn colours exactly when it has a lawn");
  }
  const walkTo = entry.walkTo ?? Number.POSITIVE_INFINITY;
  return {
    curbColour: paletteColour(entry.curbColour),
    curbTo: entry.curbTo,
    lawn,
    lawnColours: hasLawn ? [base ?? 0, marks ?? 0, tufts ?? 0] : null,
    leaves: entry.leaves,
    pools: (entry.pools ?? []).map((pool) => poolFrom(walkTo, pool)),
    seamColour: paletteColour(entry.seamColour),
    seamEvery: entry.seamEvery,
    strips: entry.strips.map(({ colour, dots, to }) => ({
      colour: paletteColour(colour),
      dots: dotsOf(dots),
      to,
    })),
    walkColour: paletteColour(entry.walkColour),
    walkDots: dotsOf(entry.walkDots),
    walkTo,
  };
}

// Each drawn verge by its zone's art id, as art paints it below the backdrops.
export const VERGES_BY_ART: Readonly<Record<string, Verge>> = Object.fromEntries(
  Object.entries(vergeTable as Readonly<Record<string, VergeEntry>>).map(([art, entry]) => [
    art,
    vergeFrom(entry),
  ]),
);

// Each zone's verge: the one drawn for its art.
export const VERGES: Readonly<Record<ZoneId, Verge>> = Object.fromEntries(
  WORLD.zones.map((zone) => {
    const verge = VERGES_BY_ART[zone.art];
    if (verge === undefined) {
      throw new Error(`No verge for ${zone.art} in shared/verges.json`);
    }
    return [zone.id, verge];
  }),
) as Record<ZoneId, Verge>;

// Where the sidewalk or paving starts, across: past the curb and the strips.
export function walkFrom(verge: Verge): number {
  return verge.strips.at(-1)?.to ?? verge.curbTo;
}

// On paving out to the screen's edges, what stands or stops beside the road takes the sidewalk
// to be this wide, as wide as a street's.
const PAVED_SIDEWALK_WIDTH = 44;

// Where the sidewalk ends, across: its outer edge, or PAVED_SIDEWALK_WIDTH past the paving's
// inner edge. A verge with no sidewalk ends it where it starts.
export function sidewalkTo(verge: Verge): number {
  const from = walkFrom(verge);
  return Number.isFinite(verge.walkTo) ? Math.max(from, verge.walkTo) : from + PAVED_SIDEWALK_WIDTH;
}

// A curb prop's frame keeps this far inside the sidewalk's edges.
const CURB_CLEAR = 2;

// The band of the sidewalk or paving that curb props stand in, from and to across, or null for
// a verge with no room for one.
interface CurbBand {
  readonly from: number;
  readonly to: number;
}

export function curbBand(verge: Verge): CurbBand | null {
  const from = walkFrom(verge) + CURB_CLEAR;
  const to = sidewalkTo(verge) - CURB_CLEAR;
  return to > from ? { from, to } : null;
}

// Whether a curb prop, its frame's centre at across and its full-size frame width wide, stands
// wholly inside the verge's curb band.
export function curbFits(verge: Verge, prop: { across: number; width: number }): boolean {
  const band = curbBand(verge);
  const half = prop.width / 2;
  return band !== null && prop.across - half >= band.from && prop.across + half <= band.to;
}

// A band of the verge that carries dots, from and to across.
interface DottedBand {
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
export function dotColour(dots: readonly VergeDots[], value: number): number | null {
  let rest = value;
  for (const { colours, share } of dots) {
    if (rest < share) {
      return colours[Math.floor((rest / share) * colours.length)] ?? null;
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
    return verge.curbColour;
  }
  for (const strip of verge.strips) {
    if (across < strip.to) {
      return strip.colour;
    }
  }
  if (across < verge.walkTo) {
    return verge.walkColour;
  }
  const [base, marks] = verge.lawnColours ?? [verge.walkColour, verge.walkColour];
  return verge.lawn === "mown" && mownAt(verge.walkTo, across, scale) ? marks : base;
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
interface VergeMark {
  readonly keep: number;
  readonly kind: "leaf" | "tuft";
  readonly shape: number;
  readonly x: number;
}

// Marks per road pixel of verge, and the share of a screen row's pixels that start one: tufts
// as on the backdrop's bottom row, thicker toward the walker; leaves sparser.
const MARK_FIELD = { from: ROAD_HALF + 6, to: ROAD_HALF + 160 } as const;
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
export const LEAF_PIXELS: readonly (readonly (readonly { colour: number; dx: number }[])[])[] =
  LEAF_SHAPES.map((rows, shape) => {
    const [lit, shaded] = LEAF_TONES[shape % LEAF_TONES.length] ?? LEAF_TONES[0];
    return rows.map((cells) =>
      [...cells].flatMap((cell, dx) =>
        cell === "." ? [] : [{ colour: cell === "f" ? lit : shaded, dx }],
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
// their middles 30 to 760 out from the road's edge on either side, as the backdrops place
// them.
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
