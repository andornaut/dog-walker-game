import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { DEPTH_STEPS } from "../assets/depthSteps";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { distanceAtY } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { walkProjection } from "../runner/walkGeometry";
import { curbBand, curbFits, VERGES, VERGES_BY_ART, walkFrom } from "./roadside";
import {
  eachRoadsideProp,
  newRoadsidePlaces,
  placeRoadside,
  ROADSIDE,
  ROADSIDE_LIMIT,
  type RoadsideCurb,
  type RoadsideFrame,
  type RoadsidePlace,
  type RoadsideStage,
  type RoadsideTable,
  type RoadsideZone,
  slotProps,
  START_STRIP_LENGTH,
} from "./roadsideProps";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const MANIFEST_KEYS = new Set(shippedManifest.sprites.map(({ key }) => key));
const ZONE_ARTS = Object.keys(ROADSIDE.zones);
const ZONES = Object.entries(ROADSIDE.zones);
const ART = ZONE_ARTS[0] ?? "";
const PROPS = ZONES.flatMap(([art, zone]) =>
  [...zone.lots, ...zone.gaps].flat().map((prop) => ({ art, ...prop })),
);
const CURB_PROPS = ZONES.flatMap(([art, zone]) =>
  (zone.curb?.groups ?? []).flat().map((prop) => ({ art, ...prop })),
);
const KEYS = [...new Set([...PROPS, ...CURB_PROPS].map(({ key }) => key))].sort();
// An art id with no table, so it places no props.
const BARE = "no-table";

const widths = new Map<string, number>();
function frameWidth(key: string): number {
  let width = widths.get(key);
  if (width === undefined) {
    const sheet = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8")) as {
      frames: Record<string, { sourceSize: { w: number } }>;
    };
    width = Object.values(sheet.frames)[0]?.sourceSize.w ?? 0;
    widths.set(key, width);
  }
  return width;
}

// The made-up tables' slot and sides: a lot across from a gap, each list taken in turn.
const SLOT = 140;
const SIDES: RoadsideZone["sides"] = {
  left: { gapStart: 0, gapStride: 1, lotStart: 0, lotStride: 1, offset: 0 },
  right: { gapStart: 0, gapStride: 1, lotStart: 0, lotStride: 1, offset: 1 },
};
const TREE = { across: 270, dz: 0, key: "roadside-tree-maple" };
const LAMP = { across: 231, dz: -38, key: "roadside-gas-lamp" };
const SHADOW = "3e8948";
// Curb props from existing art, as no curb art is drawn yet: a lamp whose frame fits every curb
// band, every third slot on each side, or two to a slot on both, the busiest curb the draw
// limit allows beside a sparse lawn.
const CURB_LAMP = { across: 186, dz: 0, key: "roadside-gas-lamp" };
const CURB_SIDES: RoadsideCurb["sides"] = {
  left: { start: 0, stride: 1 },
  right: { start: 1, stride: 1 },
};
const SPARSE_CURB: RoadsideCurb = { groups: [[CURB_LAMP], [], []], sides: CURB_SIDES };
const BUSIEST_CURB: RoadsideCurb = {
  groups: [
    [
      { ...CURB_LAMP, dz: -SLOT / 4 },
      { ...CURB_LAMP, dz: SLOT / 4 },
    ],
  ],
  sides: CURB_SIDES,
};

// A table holding the zone with art id art, by default ART, with these lots, gaps and curb.
function tableOf(
  zone: Pick<RoadsideZone, "curb" | "gaps" | "lots">,
  art: string = ART,
): RoadsideTable {
  return {
    ...ROADSIDE,
    zones: { [art]: { shadowColour: SHADOW, sides: SIDES, slot: SLOT, ...zone } },
  };
}

const DENSE = tableOf({ gaps: [[TREE, LAMP]], lots: [[TREE, LAMP], [LAMP]] });
// The shipped table, and made-up ones from empty to dense.
const TABLES: readonly (readonly [string, RoadsideTable])[] = [
  ["the shipped table", ROADSIDE],
  ["a table with no lots or gaps", tableOf({ gaps: [], lots: [] })],
  ["a table of empty lots and gaps", tableOf({ gaps: [[]], lots: [[], []] })],
  ["a table with an occasional tree", tableOf({ gaps: [[TREE], [], [], [], []], lots: [[]] })],
  ["a dense table", DENSE],
  ["a table with curb props only", tableOf({ curb: SPARSE_CURB, gaps: [], lots: [] })],
  [
    "the busiest curb beside the shipped lawn",
    tableOf({ ...(ROADSIDE.zones[ART] ?? { gaps: [], lots: [] }), curb: BUSIEST_CURB }),
  ],
];

// Props stand up to the cross street, the junction's top row.
const REACH = distanceAtY(PROJECTION, LAYOUT.junction.y);

function stageOf(table: RoadsideTable): RoadsideStage {
  return { frameWidth, projection: PROJECTION, reach: REACH, table, width: LAYOUT.roadView.width };
}

function frame(overrides: Partial<RoadsideFrame>): RoadsideFrame {
  return {
    current: ART,
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
    ...overrides,
  };
}

function placed(table: RoadsideTable, at: RoadsideFrame): RoadsidePlace[] {
  const out = newRoadsidePlaces();
  return out.slice(0, placeRoadside(stageOf(table), at, out));
}

function zoneOf(table: RoadsideTable): RoadsideZone {
  return table.zones[ART] ?? { gaps: [], lots: [], shadowColour: SHADOW, sides: SIDES, slot: SLOT };
}

// How many props a zone holds over all its lots, gaps and curb groups.
function propCount(zone: RoadsideZone): number {
  return [...zone.lots, ...zone.gaps, ...(zone.curb?.groups ?? [])].flat().length;
}

// Every prop with its z in from..to, as key, side and z.
function propsBetween(zone: RoadsideZone, from: number, to: number) {
  const props: { key: string; sign: number; z: number }[] = [];
  eachRoadsideProp(zone, from, to, ({ key }, sign, z) => props.push({ key, sign, z }));
  return props;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// The slots after which a zone's two sides both repeat: each side's lots and gaps cycle
// through their strides, a lot and a gap to a pair of slots, and its curb groups one to a
// slot. An empty list repeats every slot.
function repeatSlots(zone: RoadsideZone): number {
  const cycle = (length: number, stride: number) =>
    length === 0 ? 1 : length / gcd(stride, length);
  const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
  const side = (name: "left" | "right") =>
    lcm(
      cycle(zone.lots.length, zone.sides[name].lotStride),
      cycle(zone.gaps.length, zone.sides[name].gapStride),
    );
  const curb = (name: "left" | "right") =>
    zone.curb === undefined ? 1 : cycle(zone.curb.groups.length, zone.curb.sides[name].stride);
  return lcm(2 * lcm(side("left"), side("right")), lcm(curb("left"), curb("right")));
}

describe("the roadside table", () => {
  it("is what art's tool prints", () => {
    const tool = spawnSync("python3", ["-I", "art/tools/roadside.py", "table"], {
      encoding: "utf8",
    });
    expect(tool.status).toBe(0);
    expect(JSON.parse(tool.stdout)).toEqual(ROADSIDE);
  });

  it.each(ZONE_ARTS)("places %s's props for a zone of the world", (art) => {
    expect(gameData.world.zones.map((zone) => zone.art)).toContain(art);
  });

  it.each(ZONES)("gives %s a positive slot", (_, zone) => {
    expect(zone.slot).toBeGreaterThan(0);
  });

  it.each(KEYS.flatMap((key) => DEPTH_STEPS.map(({ suffix }) => `${key}${suffix}`)))(
    "has %s in the manifest",
    (key) => {
      expect(MANIFEST_KEYS).toContain(key);
    },
  );

  it.each(ROADSIDE.shadowed)("shadows %s, a key the manifest has", (key) => {
    expect(MANIFEST_KEYS).toContain(key);
  });

  // On a lawn, past the sidewalk; on paving out to the screen's edges, past the curb and strips.
  it.each(PROPS)("stands $key at across $across beyond $art's sidewalk", (prop) => {
    const zone = gameData.world.zones.find(({ art }) => art === prop.art);
    const verge = zone === undefined ? undefined : VERGES[zone.id as keyof typeof VERGES];
    const clear =
      verge === undefined
        ? Infinity
        : Number.isFinite(verge.walkTo)
          ? verge.walkTo
          : walkFrom(verge);
    expect(prop.across - frameWidth(prop.key) / 2).toBeGreaterThan(clear);
  });

  // Inside the curb band: off the road and the curb, and clear of the verge movers' stops.
  it("stands every curb prop wholly inside its zone's curb band", () => {
    const misfits = CURB_PROPS.filter(({ across, art, key }) => {
      const verge = VERGES_BY_ART[art];
      return verge === undefined || !curbFits(verge, { across, width: frameWidth(key) });
    });
    expect(misfits).toEqual([]);
  });

  it.each(ZONES)("shades %s's shadowed props in its own colour and the rest in none", (art) => {
    const zone = ROADSIDE.zones[art];
    const shadows = new Set<number | null>();
    for (let scroll = 4000; scroll < 4000 + 12 * (zone?.slot ?? 0); scroll += 70) {
      for (const place of placed(ROADSIDE, frame({ current: art, scroll }))) {
        const shadowed = ROADSIDE.shadowed.includes(place.key);
        expect(place.shadow).toBe(shadowed ? Number.parseInt(zone?.shadowColour ?? "", 16) : null);
        shadows.add(place.shadow);
      }
    }
    expect(shadows.size).toBeGreaterThan(0);
  });
});

describe("slotProps", () => {
  // Each lot holds one prop keyed lot and each gap one keyed gap, so a slot's prop names it.
  const MARKED = zoneOf(
    tableOf({ gaps: [[{ ...TREE, key: "gap" }]], lots: [[{ ...TREE, key: "lot" }]] }),
  );

  it.each(ZONES)("alternates %s's lots and gaps, each lot across from a gap", (_, zone) => {
    const kind = (name: "left" | "right", n: number) =>
      slotProps(MARKED, zone.sides[name], n)[0]?.key;
    for (let n = -100; n < 100; n++) {
      expect(kind("left", n)).not.toBe(kind("right", n));
      expect(kind("left", n + 1)).not.toBe(kind("left", n));
    }
  });

  it("holds no props where a zone has no lots or gaps", () => {
    const zone = zoneOf(tableOf({ gaps: [], lots: [] }));
    expect([-1, 0, 1, 2].map((n) => slotProps(zone, SIDES.left, n))).toEqual([[], [], [], []]);
  });
});

describe("eachRoadsideProp", () => {
  it.each(TABLES)("repeats %s's props with its slots", (_, table) => {
    const zone = zoneOf(table);
    const period = repeatSlots(zone) * zone.slot;
    const shifted = propsBetween(zone, period, 2 * period).map((prop) => ({
      ...prop,
      z: prop.z - period,
    }));
    const one = propsBetween(zone, 0, period);
    expect(one.length > 0).toBe(propCount(zone) > 0);
    expect(shifted).toEqual(one);
  });

  it.each(TABLES)("puts each of %s's props in one window only", (_, table) => {
    const zone = zoneOf(table);
    const whole = propsBetween(zone, 0, 4 * zone.slot);
    const halves = [
      ...propsBetween(zone, 0, 2 * zone.slot),
      ...propsBetween(zone, 2 * zone.slot, 4 * zone.slot),
    ];
    const order = (props: typeof whole) =>
      props.map(({ key, sign, z }) => `${sign} ${z} ${key}`).sort();
    expect(order(halves)).toEqual(order(whole));
  });

  it.each([0, -SLOT, Number.NaN])("places nothing for a slot of %d", (slot) => {
    const zone = { ...zoneOf(DENSE), slot };
    expect(propsBetween(zone, 0, 10 * SLOT)).toEqual([]);
  });
});

describe("placeRoadside", () => {
  it.each(TABLES)("places %s's props in view on screen, under the limit", (_, table) => {
    const zone = zoneOf(table);
    let total = 0;
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += zone.slot / 4) {
      const props = placed(table, frame({ scroll }));
      total += props.length;
      expect(props.length).toBeLessThan(ROADSIDE_LIMIT);
      for (const place of props) {
        const half = (frameWidth(place.key) * Math.min(1, place.scale)) / 2;
        expect(place.y).toBeGreaterThanOrEqual(LAYOUT.junction.y - 1);
        expect(place.y).toBeLessThanOrEqual(PROJECTION.footY);
        expect(place.x + half).toBeGreaterThan(0);
        expect(place.x - half).toBeLessThan(LAYOUT.roadView.width);
      }
    }
    expect(total > 0).toBe(propCount(zone) > 0);
  });

  it.each(ZONES)("keeps %s's props in view under the limit", (art, zone) => {
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += zone.slot / 4) {
      expect(placed(ROADSIDE, frame({ current: art, scroll })).length).toBeLessThan(ROADSIDE_LIMIT);
    }
  });

  // Each verge with a curb band, with the sparse curb lamps: every lamp drawn on both sides,
  // its frame inside the band at the scale of its row.
  const BANDED = Object.entries(VERGES_BY_ART).flatMap(([art, verge]) => {
    const band = curbBand(verge);
    return band === null ? [] : [{ art, band }];
  });

  it.each(BANDED)("stands curb props inside $art's curb band, on both sides", ({ art, band }) => {
    const table = tableOf({ curb: SPARSE_CURB, gaps: [], lots: [] }, art);
    const signs = new Set<number>();
    for (let scroll = 0; scroll < 6 * SLOT; scroll += SLOT / 4) {
      for (const place of placed(table, frame({ current: art, scroll }))) {
        const offset = (place.x - PROJECTION.centreX) / place.scale;
        const half = frameWidth(place.key) / 2;
        signs.add(Math.sign(offset));
        expect(Math.abs(offset) - half).toBeGreaterThanOrEqual(band.from - 1e-6);
        expect(Math.abs(offset) + half).toBeLessThanOrEqual(band.to + 1e-6);
      }
    }
    expect([...signs].sort()).toEqual([-1, 1]);
  });

  // A prop comes into view on the cross street, where it fades in, not at the road's far edge.
  const PROPPED = ZONES.filter(([, zone]) => propCount(zone) > 0);
  it.each(PROPPED)("places %s's props up to the cross street", (art, zone) => {
    const rows = new Set<number>();
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += 3) {
      for (const place of placed(ROADSIDE, frame({ current: art, scroll }))) {
        rows.add(Math.round(place.y));
      }
    }
    expect(Math.abs(Math.min(...rows) - LAYOUT.junction.y)).toBeLessThanOrEqual(1);
    expect([...rows].some((y) => y > LAYOUT.junction.y && y < PROJECTION.farY)).toBe(true);
  });

  it("places nothing for a zone with no table", () => {
    expect(placed(ROADSIDE, frame({ current: BARE }))).toEqual([]);
  });

  // As a zone begins, its start strip lies on the road's far edge: the zone before's props
  // stand short of it, and the zone's own beyond it.
  it.each(TABLES)("keeps the zone before's props in view as a zone begins, %s", (_, table) => {
    const zone = zoneOf(table);
    const onRoad = (props: RoadsidePlace[]) => props.filter(({ y }) => y >= PROJECTION.farY);
    for (let length = 4000; length < 4000 + repeatSlots(zone) * zone.slot; length += SLOT) {
      const before = placed(table, frame({ scroll: length }));
      const after = placed(
        table,
        frame({ current: BARE, currentStart: length, previous: ART, scroll: length }),
      );
      expect(after).toEqual(onRoad(before));
    }
  });

  it.each(TABLES)("leaves a zone's start strip clear, %s", (_, table) => {
    const length = 4000;
    for (let step = 0; step < PROJECTION.visibleDistance + START_STRIP_LENGTH; step += 23) {
      const scroll = length + step;
      const strip = length + PROJECTION.visibleDistance - scroll;
      for (const place of placed(table, frame({ currentStart: length, previous: ART, scroll }))) {
        const distance = PROJECTION.focal / place.scale - PROJECTION.focal;
        const along = distance - strip;
        expect(along < -1e-6 || along > START_STRIP_LENGTH - 1e-6).toBe(true);
      }
    }
  });
});
