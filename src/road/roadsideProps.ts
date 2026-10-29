import { itemAt } from "@andornaut/game-kit/arrays";
import { getOrInsertComputed } from "@andornaut/game-kit/maps";

import table from "../../shared/roadside.json";
import { project, type RoadProjection } from "../layout/projection";
import { STRIP } from "../layout/roadRaster";

// The roadside props: houses, fences, trees and yard props standing on the lawns beyond the
// sidewalks, and curb props (hydrants, bins, planters, bike racks, newspaper boxes) standing on
// the sidewalk or paving inside its curb band (curbBand), placed from art's per-zone table
// (shared/roadside.json, which art/tools/roadside.py writes). They are scenery only: nothing
// in the walk reads them and they draw no random numbers, so a seed plays the same walk with
// or without them.
//
// A prop whose sprite has an idle tag loops it from its own phase (roadsidePhase), so props of
// one kind never change in step, and with reduced motion holds its first frame (idleFrame).
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
export type RoadsideSign = (typeof ROADSIDE_SIDES)[number]["sign"];

// No prop stands on a zone's start strip, so its cross street stays clear.
export const START_STRIP_LENGTH = STRIP.height;

// At most this many props are drawn at once, lawn and curb props together.
export const ROADSIDE_LIMIT = 40;
// At most this many props whose art is left out carry lights still on screen at once.
export const ROADSIDE_LIGHT_LIMIT = 12;

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
  return getOrInsertComputed(
    zone,
    () => {
      const dzs = [...zone.lots, ...zone.gaps, ...(zone.curb?.groups ?? [])]
        .flat()
        .map(({ dz }) => dz);
      return { far: Math.max(0, ...dzs), near: Math.min(0, ...dzs) };
    },
    DZ_REACH,
  );
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

// The share of its idle loop's length a prop starts at, in [0, 1): the murmur3 finalizer over
// where it stands, its road distance from the walk's start and its across, signed by its side
// (left negative), each rounded. So it keeps its phase as the road scrolls, and its neighbours
// of the same kind take others. It draws no random numbers.
export function roadsidePhase(distance: number, across: number): number {
  let hash = Math.imul(Math.round(distance), 0x9e3779b1) ^ Math.round(across);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 2 ** 32;
}

// The frame of its idle loop a prop shows ms into the walk, by the loop's frame durations: the
// loop runs on from phase, a share of its length. With still it holds the first frame.
export function idleFrame(
  still: boolean,
  durationsMs: readonly number[],
  phase: number,
  ms: number,
): number {
  const total = durationsMs.reduce((sum, duration) => sum + duration, 0);
  if (still || !(total > 0)) {
    return 0;
  }
  let into = mod(ms + phase * total, total);
  for (const [i, duration] of durationsMs.entries()) {
    if (into < duration) {
      return i;
    }
    into -= duration;
  }
  return 0;
}

// Where a prop is drawn: its key, its feet on screen, its projected scale, the colour of its
// ground shadow, or null for a prop with none, and the phase its idle loop starts at.
export interface RoadsidePlace {
  key: string;
  phase: number;
  scale: number;
  shadow: number | null;
  x: number;
  y: number;
}

export function newRoadsidePlaces(count = ROADSIDE_LIMIT): RoadsidePlace[] {
  return Array.from({ length: count }, () => ({
    key: "",
    phase: 0,
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

// How far across a prop's lights reach from its feet, in px at full size, left negative.
export interface RoadsideLightReach {
  readonly left: number;
  readonly right: number;
}

// What placeRoadsideLights reads of the lights props carry: how far behind the walker's feet,
// in road px, a prop's lights can still show, and how far across the lights a prop of key
// carries reach on the side of the road sign gives (undefined for a key that carries none).
export interface RoadsideLights {
  readonly behind: number;
  readonly reach: (key: string, sign: RoadsideSign) => RoadsideLightReach | undefined;
}

// Slack, in px, on a prop's lights' reach across: a depth step can draw a prop a little larger
// than its projected scale, and its lights with it.
const LIGHT_SLACK = 4;

// Scratch shared by placeRoadside and the visitor it passes, so placing allocates nothing.
// artFrom is the z the zone's props' art shows from; lights, null to place the props whose art
// shows, or what places the props whose art is left out but whose lights may show.
const placing = {
  artFrom: 0,
  count: 0,
  lights: null as RoadsideLights | null,
  origin: 0,
  out: [] as RoadsidePlace[],
  scroll: 0,
  shadow: 0,
  stage: null as RoadsideStage | null,
};

function placeProp(prop: RoadsideProp, sign: RoadsideSign, z: number): void {
  const { lights, out, stage } = placing;
  const place = out[placing.count];
  if (stage === null || place === undefined) {
    return;
  }
  const { projection } = stage;
  const distance = placing.origin + z - placing.scroll;
  const placed = project(projection, { distance, x: projection.centreX + sign * prop.across });
  const scale = Math.min(1, placed.scale);
  const half = (stage.frameWidth(prop.key) * scale) / 2;
  const art = z >= placing.artFrom && placed.x + half > 0 && placed.x - half < stage.width;
  if (lights === null ? !art : art || !lightsAcross(lights, prop.key, sign, placed.x, scale)) {
    return;
  }
  place.key = prop.key;
  place.phase = roadsidePhase(placing.origin + z, sign * prop.across);
  place.scale = placed.scale;
  place.shadow = stage.table.shadowed.includes(prop.key) ? placing.shadow : null;
  place.x = placed.x;
  place.y = placed.y;
  placing.count += 1;
}

// Whether a prop of key at screen x, drawn at scale, carries lights reaching across into the
// screen.
function lightsAcross(
  lights: RoadsideLights,
  key: string,
  sign: RoadsideSign,
  x: number,
  scale: number,
): boolean {
  const reach = lights.reach(key, sign);
  const width = placing.stage?.width ?? 0;
  return (
    reach !== undefined &&
    x + reach.right * scale + LIGHT_SLACK > 0 &&
    x + reach.left * scale - LIGHT_SLACK < width
  );
}

// The props of the zone with art id art, which began at road distance start, from road distance
// from to to (to excluded), their art showing from road distance artFrom; none for a zone with
// no table.
function placeZone(
  art: string | null,
  start: number,
  from: number,
  artFrom: number,
  to: number,
): void {
  const { stage } = placing;
  const zone = art === null || stage === null ? undefined : stage.table.zones[art];
  if (zone === undefined || stage === null || to <= from) {
    return;
  }
  // A zone's z counts from its start strip's near edge, visibleDistance past where it began.
  const origin = start + stage.projection.visibleDistance;
  placing.artFrom = artFrom - origin;
  placing.origin = origin;
  placing.shadow = Number.parseInt(zone.shadowColour, 16);
  eachRoadsideProp(zone, from - origin, to - origin, placeProp);
}

// Writes the props in view into out, at most out.length of them, and returns how many: every
// prop from the feet to the stage's reach, on the zone whose road lies there, whose frame lies
// partly across the screen. Past its start strip a zone shows its own props; short of it, the
// zone before it's, or with none, its own.
export function placeRoadside(
  stage: RoadsideStage,
  frame: RoadsideFrame,
  out: RoadsidePlace[],
): number {
  return placeInView(stage, null, frame, out);
}

// Writes into out, as placeRoadside does, the props that carry lights whose art placeRoadside
// leaves out but whose lights may still show: standing from lights.behind behind the feet to the
// stage's reach, with their lights reaching across into the screen. A light is culled by its own
// rect, never by its prop's, so these props' lights follow where they stand while their art is
// gone.
export function placeRoadsideLights(
  stage: RoadsideStage,
  lights: RoadsideLights,
  frame: RoadsideFrame,
  out: RoadsidePlace[],
): number {
  return placeInView(stage, lights, frame, out);
}

function placeInView(
  stage: RoadsideStage,
  lights: RoadsideLights | null,
  frame: RoadsideFrame,
  out: RoadsidePlace[],
): number {
  placing.count = 0;
  placing.lights = lights;
  placing.out = out;
  placing.scroll = frame.scroll;
  placing.stage = stage;
  const artFrom = frame.scroll;
  const from = artFrom - (lights?.behind ?? 0);
  const to = frame.scroll + stage.reach + 1;
  if (frame.previous === null) {
    placeZone(frame.current, frame.currentStart, from, artFrom, to);
  } else {
    const strip = frame.currentStart + stage.projection.visibleDistance;
    const past = strip + START_STRIP_LENGTH;
    placeZone(frame.previous, frame.previousStart, from, artFrom, Math.min(to, strip));
    placeZone(frame.current, frame.currentStart, Math.max(from, past), Math.max(artFrom, past), to);
  }
  placing.lights = null;
  placing.stage = null;
  return placing.count;
}
