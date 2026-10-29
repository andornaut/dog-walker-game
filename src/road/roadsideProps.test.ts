import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { itemAt } from "@andornaut/game-kit/arrays";
import type { Point } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { DEPTH_STEPS } from "../assets/depthSteps";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { distanceAtY, project } from "../layout/projection";
import { walkProjection } from "../runner/walkGeometry";
import {
  CARRIED_LIGHT_UP,
  carriedLightReach,
  distanceBehind,
  newAttachedLightPlaces,
  placeAttachedLights,
} from "./lightPlaces";
import { LIGHT_ATTACHMENTS } from "./lights";
import { curbBand, curbFits, VERGES, VERGES_BY_ART, walkFrom } from "./roadside";
import {
  eachRoadsideProp,
  idleFrame,
  newRoadsidePlaces,
  placeRoadside,
  placeRoadsideLights,
  ROADSIDE,
  ROADSIDE_LIGHT_LIMIT,
  ROADSIDE_LIMIT,
  type RoadsideCurb,
  type RoadsideFrame,
  type RoadsideLights,
  roadsidePhase,
  type RoadsidePlace,
  type RoadsideStage,
  type RoadsideTable,
  type RoadsideZone,
  slotProps,
  START_STRIP_LENGTH,
} from "./roadsideProps";

const LAYOUT = SCREEN_LAYOUT;
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
const EMPTY: readonly [string, RoadsideTable] = [
  "a table with no lots or gaps",
  tableOf({ gaps: [], lots: [] }),
];
// The shipped table, and made-up ones from sparse to dense, for the checks a table placing no
// props passes with nothing to check.
const PROPPED_TABLES: readonly (readonly [string, RoadsideTable])[] = [
  ["the shipped table", ROADSIDE],
  ["a table with an occasional tree", tableOf({ gaps: [[TREE], [], [], [], []], lots: [[]] })],
  ["a dense table", DENSE],
  ["a table with curb props only", tableOf({ curb: SPARSE_CURB, gaps: [], lots: [] })],
  [
    "the busiest curb beside the shipped lawn",
    tableOf({ ...(ROADSIDE.zones[ART] ?? { gaps: [], lots: [] }), curb: BUSIEST_CURB }),
  ],
];
// Every table, from empty to dense.
const TABLES = [EMPTY, ...PROPPED_TABLES];

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

  it("places each table's props for a zone of the world, a positive slot apart", () => {
    const arts: readonly string[] = gameData.world.zones.map((zone) => zone.art);
    expect(ZONE_ARTS.filter((art) => !arts.includes(art))).toEqual([]);
    expect(ZONES.filter(([, zone]) => !(zone.slot > 0)).map(([art]) => art)).toEqual([]);
  });

  it("has every prop at every depth step in the manifest", () => {
    const keys = KEYS.flatMap((key) => DEPTH_STEPS.map(({ suffix }) => `${key}${suffix}`));
    expect(keys.filter((key) => !MANIFEST_KEYS.has(key))).toEqual([]);
  });

  it("shadows only keys the manifest has", () => {
    expect(ROADSIDE.shadowed.filter((key) => !MANIFEST_KEYS.has(key))).toEqual([]);
  });

  // On a lawn, past the sidewalk; on paving out to the screen's edges, past the curb and strips.
  it("stands every lot and gap prop wholly beyond its zone's sidewalk", () => {
    const misfits = PROPS.filter((prop) => {
      const zone = gameData.world.zones.find(({ art }) => art === prop.art);
      const verge = zone === undefined ? undefined : VERGES[zone.id as keyof typeof VERGES];
      const clear =
        verge === undefined
          ? Infinity
          : Number.isFinite(verge.walkTo)
            ? verge.walkTo
            : walkFrom(verge);
      return !(prop.across - frameWidth(prop.key) / 2 > clear);
    });
    expect(misfits).toEqual([]);
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

  it.each(PROPPED_TABLES)("puts each of %s's props in one window only", (_, table) => {
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

  it.each([0, Number.NaN])("places nothing for a slot of %d", (slot) => {
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
  it.each(PROPPED)("places %s's props up to the cross street, under the limit", (art, zone) => {
    const rows = new Set<number>();
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += 3) {
      const props = placed(ROADSIDE, frame({ current: art, scroll }));
      expect(props.length).toBeLessThan(ROADSIDE_LIMIT);
      for (const place of props) {
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
  it.each(PROPPED_TABLES)(
    "keeps the zone before's props in view as a zone begins, %s",
    (_, table) => {
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
    },
  );

  it.each(PROPPED_TABLES)("leaves a zone's start strip clear, %s", (_, table) => {
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

  // Between two scrolls that place the same props in the same order, each keeps its phase.
  it.each(PROPPED_TABLES)("keeps each prop's phase as the road scrolls, %s", (_, table) => {
    const zone = zoneOf(table);
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += 7) {
      const before = placed(table, frame({ scroll }));
      const after = placed(table, frame({ scroll: scroll + 0.5 }));
      if (before.map(({ key }) => key).join() === after.map(({ key }) => key).join()) {
        expect(after.map(({ phase }) => phase)).toEqual(before.map(({ phase }) => phase));
      }
    }
  });

  it.each(ZONES)("gives each of %s's props of one kind in view its own phase", (art, zone) => {
    for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += zone.slot) {
      const phases = new Map<string, Set<number>>();
      const counts = new Map<string, number>();
      for (const { key, phase } of placed(ROADSIDE, frame({ current: art, scroll }))) {
        phases.set(key, (phases.get(key) ?? new Set()).add(phase));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const [key, count] of counts) {
        expect(phases.get(key)?.size).toBe(count);
      }
    }
  });
});

describe("placeRoadsideLights", () => {
  const VIEW = LAYOUT.walkView;
  const LIGHTS_STAGE: RoadsideLights = {
    behind: distanceBehind(PROJECTION, VIEW.y + VIEW.height, CARRIED_LIGHT_UP),
    reach: carriedLightReach,
  };
  const carried = (table: RoadsideTable, at: RoadsideFrame) => {
    const out = newRoadsidePlaces(ROADSIDE_LIGHT_LIMIT);
    return out.slice(0, placeRoadsideLights(stageOf(table), LIGHTS_STAGE, at, out));
  };
  const samePlace = (a: Point, b: Point) =>
    Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  // How many of a prop's lights in zone show, drawn at its feet at spot, at its art's scale.
  const lightsShown = (zone: ZoneId, key: string, spot: Point & { readonly scale: number }) => {
    const anchor = {
      flipX: false,
      frame: 0,
      key,
      leftOfRoad: spot.x < PROJECTION.centreX,
      scale: Math.min(1, spot.scale),
      x: spot.x,
      y: spot.y,
    };
    return placeAttachedLights(VIEW, zone, [anchor], newAttachedLightPlaces());
  };
  // Each shipped prop that carries lights, at its shipped across, in a zone its lights show in.
  const LIT = KEYS.filter((key) => LIGHT_ATTACHMENTS.has(key)).map((key) => {
    const prop = itemAt(
      [...PROPS, ...CURB_PROPS].filter((candidate) => candidate.key === key),
      0,
    );
    const zones = LIGHT_ATTACHMENTS.get(key)?.[0]?.zones ?? null;
    const zone = itemAt(
      WORLD.zones.filter(({ id }) => zones === null || zones.includes(id)),
      0,
    );
    return { across: prop.across, art: zone.art, id: zone.id, key };
  });

  // Every slot holds the prop on both sides. Each prop the art leaves out whose lights still
  // show, behind the feet or past the screen's side, stands where the projection puts it.
  it.each(LIT)(
    "keeps $key's lights where it stands once its art leaves the screen, until theirs do",
    ({ across, art, id, key }) => {
      const prop = { across, dz: 0, key };
      const table = tableOf({ gaps: [[prop]], lots: [[prop]] }, art);
      const zone = itemAt(Object.values(table.zones), 0);
      const origin = PROJECTION.visibleDistance;
      for (let scroll = 2000; scroll < 2000 + 2 * SLOT; scroll += 1) {
        const at = frame({ current: art, scroll });
        const drawn = placed(table, at);
        const lit = carried(table, at);
        expect(lit.filter((place) => drawn.some((standing) => samePlace(standing, place)))).toEqual(
          [],
        );
        const from = scroll - LIGHTS_STAGE.behind - SLOT - origin;
        eachRoadsideProp(zone, from, scroll + REACH + 1 - origin, (shown, sign, z) => {
          const spot = project(PROJECTION, {
            distance: origin + z - scroll,
            x: PROJECTION.centreX + sign * shown.across,
          });
          if (!drawn.some((place) => samePlace(place, spot)) && lightsShown(id, key, spot) > 0) {
            expect(lit.some((place) => samePlace(place, spot))).toBe(true);
          }
        });
      }
    },
  );

  it("carries some lamp's lights past its art, and never more than the limit", () => {
    let total = 0;
    for (const [art, zone] of ZONES) {
      for (let scroll = 0; scroll < repeatSlots(zone) * zone.slot; scroll += 3) {
        const lit = carried(ROADSIDE, frame({ current: art, scroll }));
        total += lit.length;
        expect(lit.length).toBeLessThan(ROADSIDE_LIGHT_LIMIT);
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});

describe("roadsidePhase", () => {
  // Every road distance over a long stretch, at one across.
  const STRETCH = Array.from({ length: 4000 }, (_, i) => i);

  it.each([-231, 186])("spreads the phases at across %i over [0, 1) evenly", (across) => {
    const phases = STRETCH.map((distance) => roadsidePhase(distance, across));
    expect(phases.every((phase) => phase >= 0 && phase < 1)).toBe(true);
    for (const quarter of [0, 1, 2, 3]) {
      const share = phases.filter((phase) => Math.floor(phase * 4) === quarter).length;
      expect(share / STRETCH.length).toBeCloseTo(1 / 4, 1);
    }
  });

  it.each([
    ["the same place on the two sides", [1200, -231], [1200, 231]],
    ["neighbouring acrosses", [1200, 231], [1200, 232]],
    ["neighbouring distances", [1200, 231], [1201, 231]],
  ] as const)("differs between %s", (_, [distance, across], [other, otherAcross]) => {
    expect(roadsidePhase(distance, across)).not.toBe(roadsidePhase(other, otherAcross));
  });

  it("rounds the distance, so a prop keeps its phase over a fractional zone start", () => {
    expect(roadsidePhase(1200.4, 231)).toBe(roadsidePhase(1200, 231));
  });
});

describe("idleFrame", () => {
  const LOOP = [100, 200, 300];

  it.each([
    { durations: LOOP, frame: 2, ms: 0, phase: 0.5, still: false },
    { durations: LOOP, frame: 0, ms: 300, phase: 0.5, still: false },
    { durations: LOOP, frame: 2, ms: 600 * 40 + 350, phase: 0, still: false },
    { durations: LOOP, frame: 0, ms: 150, phase: 0.5, still: true },
    { durations: [1000], frame: 0, ms: 700, phase: 0.9, still: false },
  ])(
    "shows frame $frame at $ms ms from phase $phase, still $still",
    ({ durations, frame: shown, ms, phase, still }) => {
      expect(idleFrame(still, durations, phase, ms)).toBe(shown);
    },
  );

  // Idle tags with uneven frame durations, as art draws a lamp's slow fade or a sign's flicker.
  const UNEVEN = [
    [2400, 300, 250, 900, 250, 300],
    [2600, 250, 350, 250],
    [1800, 300, 300],
  ].map((durations) => ({ durations }));
  // Every frame's run of shown ms over one loop from start, sampled every millisecond.
  function frameRuns(durations: readonly number[], phase: number, start: number) {
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const runs: { frame: number; ms: number }[] = [];
    for (let ms = start; ms < start + total; ms++) {
      const frame = idleFrame(false, durations, phase, ms);
      const last = runs.at(-1);
      if (last?.frame === frame) {
        last.ms += 1;
      } else {
        runs.push({ frame, ms: 1 });
      }
    }
    return runs;
  }

  // From a phase the loop starts part way through, and still shows every frame for its own
  // duration in turn.
  it.each(UNEVEN)(
    "shows each frame of the loop $durations for its duration from a phase",
    ({ durations }) => {
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      const phase = 0.25;
      expect(frameRuns(durations, phase, total - phase * total)).toEqual(
        durations.map((ms, frame) => ({ frame, ms })),
      );
    },
  );
});
