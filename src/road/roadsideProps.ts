import table from "../../shared/roadside.json";
import { project, type RoadProjection } from "../layout/projection";
import { STRIP } from "../layout/roadRaster";
import { itemAt } from "../lib/arrays";
import { getOrInsert } from "../lib/maps";

// The roadside props: houses, fences, trees and yard props standing on the lawns beyond the
// sidewalks, and curb props (hydrants, bins, planters, bike racks, newspaper boxes) standing on
// the sidewalk or paving inside its curb band (curbBand), placed from art's per-zone table
// (shared/roadside.json, which art/tools/roadside.py writes). They are scenery only: nothing
// in the walk reads them and they draw no random numbers, so a seed plays the same walk with
// or without them.
//
// Road px: across is the distance from the road's centre line to a prop frame's centre, z the
// distance along the road from the zone's start strip's near edge, as the road raster counts
// its strip rows. Each side has a slot every `slot` along z, slot n at z = n * slot. With
// m = n - offset, an even m is a lot and an odd m a gap, k = floor(m / 2), and the side takes
// lots[(lotStart + k * lotStride) mod lots] or gaps[(gapStart + k * gapStride) mod gaps]. A
// zone's curb props take a group at every slot as well: slot n on a side takes
// groups[(start + n * stride) mod groups]. Each prop stands at its slot's z plus its dz, nearer
// negative.

interface RoadsideProp {
  readonly across: number;
  readonly dz: number;
  readonly key: string;
}

interface RoadsideSide {
  readonly gapStart: number;
  readonly gapStride: number;
  readonly lotStart: number;
  readonly lotStride: number;
  readonly offset: number;
}

// A side's pick of curb groups.
interface CurbSide {
  readonly start: number;
  readonly stride: number;
}

// The curb props, each frame wholly inside its zone's curb band, which keeps them off the road
// and clear of the ambient movers' stops.
export interface RoadsideCurb {
  readonly groups: readonly (readonly RoadsideProp[])[];
  readonly sides: { readonly left: CurbSide; readonly right: CurbSide };
}

// shadowColour is the ground shadow under the zone's free-standing props, a hex RGB string: its
// ground one ramp step darker. A zone with no curb has no curb props.
export interface RoadsideZone {
  readonly curb?: RoadsideCurb;
  readonly gaps: readonly (readonly RoadsideProp[])[];
  readonly lots: readonly (readonly RoadsideProp[])[];
  readonly shadowColour: string;
  readonly sides: { readonly left: RoadsideSide; readonly right: RoadsideSide };
  readonly slot: number;
}

// shadowed lists the props that take a ground shadow; zones is keyed by a zone's art id.
export interface RoadsideTable {
  readonly shadowed: readonly string[];
  readonly zones: Readonly<Record<string, RoadsideZone>>;
}

export const ROADSIDE: RoadsideTable = table;

// The table's sides, each with the sign of its across: the left side is negative.
const ROADSIDE_SIDES = [
  { name: "left", sign: -1 },
  { name: "right", sign: 1 },
] as const;
type RoadsideSign = (typeof ROADSIDE_SIDES)[number]["sign"];

// No prop stands on a zone's start strip, so its cross street stays clear.
export const START_STRIP_LENGTH = STRIP.height;

// At most this many props are drawn at once, lawn and curb props together.
export const ROADSIDE_LIMIT = 40;

const NO_PROPS: readonly RoadsideProp[] = [];

// The props a side's slot n holds: a lot or a gap, none when the zone has no lots or gaps.
export function slotProps(
  zone: RoadsideZone,
  side: RoadsideSide,
  n: number,
): readonly RoadsideProp[] {
  const m = n - side.offset;
  const k = Math.floor(m / 2);
  return m % 2 === 0
    ? groupAt(zone.lots, side.lotStart + k * side.lotStride)
    : groupAt(zone.gaps, side.gapStart + k * side.gapStride);
}

// The curb props a side's slot n holds; none for a zone with no curb.
function curbSlotProps(
  zone: RoadsideZone,
  side: "left" | "right",
  n: number,
): readonly RoadsideProp[] {
  const { curb } = zone;
  if (curb === undefined) {
    return NO_PROPS;
  }
  const { start, stride } = curb.sides[side];
  return groupAt(curb.groups, start + n * stride);
}

function groupAt(
  groups: readonly (readonly RoadsideProp[])[],
  index: number,
): readonly RoadsideProp[] {
  return groups.length === 0 ? NO_PROPS : itemAt(groups, mod(index, groups.length));
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

// How far a prop stands from its slot's z, nearer and further, over the whole zone.
const DZ_REACH = new Map<RoadsideZone, { far: number; near: number }>();

function dzReach(zone: RoadsideZone): { far: number; near: number } {
  return getOrInsert(DZ_REACH, zone, () => {
    const dzs = [...zone.lots, ...zone.gaps, ...(zone.curb?.groups ?? [])]
      .flat()
      .map(({ dz }) => dz);
    return { far: Math.max(0, ...dzs), near: Math.min(0, ...dzs) };
  });
}

type RoadsideVisit = (prop: RoadsideProp, sign: RoadsideSign, z: number) => void;

// Visits every prop of a zone with its z in from..to (to excluded), on both sides, each with
// the sign of its side and its z: each slot's lawn props, then its curb props. A zone whose slot
// is not a positive length places none.
export function eachRoadsideProp(
  zone: RoadsideZone,
  from: number,
  to: number,
  visit: RoadsideVisit,
): void {
  const { slot } = zone;
  if (!(slot > 0) || !(to > from)) {
    return;
  }
  const { far, near } = dzReach(zone);
  const first = Math.floor((from - far) / slot);
  const last = Math.ceil((to - near) / slot);
  for (const { name, sign } of ROADSIDE_SIDES) {
    const side = zone.sides[name];
    for (let n = first; n <= last; n++) {
      visitSlot(slotProps(zone, side, n), sign, n * slot, from, to, visit);
      visitSlot(curbSlotProps(zone, name, n), sign, n * slot, from, to, visit);
    }
  }
}

// Visits the props of a slot at z slotZ whose z is in from..to (to excluded).
function visitSlot(
  props: readonly RoadsideProp[],
  sign: RoadsideSign,
  slotZ: number,
  from: number,
  to: number,
  visit: RoadsideVisit,
): void {
  for (const prop of props) {
    const z = slotZ + prop.dz;
    if (z >= from && z < to) {
      visit(prop, sign, z);
    }
  }
}

// Where a prop is drawn: its key, its feet on screen, its projected scale, and the colour of
// its ground shadow, or null for a prop with none.
export interface RoadsidePlace {
  key: string;
  scale: number;
  shadow: number | null;
  x: number;
  y: number;
}

export function newRoadsidePlaces(): RoadsidePlace[] {
  return Array.from({ length: ROADSIDE_LIMIT }, () => ({
    key: "",
    scale: 1,
    shadow: null,
    x: 0,
    y: 0,
  }));
}

// What the props are placed against: the placement table, the road's projection, the screen's
// width, a prop's frame width at full size, to leave out props wholly off the screen's sides,
// and reach, how far ahead of the feet props stand: to the cross street, past the road's far
// edge, so they come into view there rather than at the far edge.
export interface RoadsideStage {
  readonly frameWidth: (key: string) => number;
  readonly projection: RoadProjection;
  readonly reach: number;
  readonly table: RoadsideTable;
  readonly width: number;
}

// The road in view: the zone being walked and the one before it, by art id, each with the
// road distance from the walk's start at which it began, and the road distance from the walk's
// start at the walker's feet. A zone with no table has no props.
export interface RoadsideFrame {
  current: string;
  currentStart: number;
  previous: string | null;
  previousStart: number;
  scroll: number;
}

// Scratch shared by placeRoadside and the visitor it passes, so placing allocates nothing.
const placing = {
  count: 0,
  origin: 0,
  out: [] as RoadsidePlace[],
  scroll: 0,
  shadow: 0,
  stage: null as RoadsideStage | null,
};

function placeProp(prop: RoadsideProp, sign: RoadsideSign, z: number): void {
  const { out, stage } = placing;
  const place = out[placing.count];
  if (stage === null || place === undefined) {
    return;
  }
  const { projection } = stage;
  const distance = placing.origin + z - placing.scroll;
  const placed = project(projection, { distance, x: projection.centreX + sign * prop.across });
  const half = (stage.frameWidth(prop.key) * Math.min(1, placed.scale)) / 2;
  if (placed.x + half <= 0 || placed.x - half >= stage.width) {
    return;
  }
  place.key = prop.key;
  place.scale = placed.scale;
  place.shadow = stage.table.shadowed.includes(prop.key) ? placing.shadow : null;
  place.x = placed.x;
  place.y = placed.y;
  placing.count += 1;
}

// The props of the zone with art id art, which began at road distance start, from road distance
// from to to (to excluded); none for a zone with no table.
function placeZone(art: string | null, start: number, from: number, to: number): void {
  const { stage } = placing;
  const zone = art === null || stage === null ? undefined : stage.table.zones[art];
  if (zone === undefined || stage === null || to <= from) {
    return;
  }
  // A zone's z counts from its start strip's near edge, visibleDistance past where it began.
  const origin = start + stage.projection.visibleDistance;
  placing.origin = origin;
  placing.shadow = Number.parseInt(zone.shadowColour, 16);
  eachRoadsideProp(zone, from - origin, to - origin, placeProp);
}

// Writes the props in view into out, at most out.length of them, and returns how many: every
// prop from the feet to the stage's reach, on the zone whose road lies there. Past its start
// strip a zone shows its own props; short of it, the zone before it's, or with none, its own.
export function placeRoadside(
  stage: RoadsideStage,
  frame: RoadsideFrame,
  out: RoadsidePlace[],
): number {
  placing.count = 0;
  placing.out = out;
  placing.scroll = frame.scroll;
  placing.stage = stage;
  const from = frame.scroll;
  const to = frame.scroll + stage.reach + 1;
  if (frame.previous === null) {
    placeZone(frame.current, frame.currentStart, from, to);
  } else {
    const strip = frame.currentStart + stage.projection.visibleDistance;
    placeZone(frame.previous, frame.previousStart, from, Math.min(to, strip));
    placeZone(frame.current, frame.currentStart, Math.max(from, strip + START_STRIP_LENGTH), to);
  }
  placing.stage = null;
  return placing.count;
}
