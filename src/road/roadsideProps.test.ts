import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { DEPTH_STEPS } from "../assets/depthSteps";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { walkProjection } from "../runner/walkGeometry";
import { VERGES } from "./roadside";
import {
  eachRoadsideProp,
  newRoadsidePlaces,
  placeRoadside,
  ROADSIDE,
  ROADSIDE_LIMIT,
  ROADSIDE_SIDES,
  type RoadsideFrame,
  type RoadsidePlace,
  type RoadsideStage,
  type RoadsideZone,
  slotProps,
  START_STRIP_LENGTH,
} from "./roadsideProps";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const MANIFEST_KEYS = new Set(shippedManifest.sprites.map(({ key }) => key));
const ZONE_ARTS = Object.keys(ROADSIDE.zones);
const ZONES = Object.entries(ROADSIDE.zones);
const PROPS = ZONES.flatMap(([art, zone]) =>
  [...zone.lots, ...zone.gaps].flat().map((prop) => ({ art, ...prop })),
);
const KEYS = [...new Set(PROPS.map(({ key }) => key))].sort();
// A zone whose art has no table, so it places no props.
const BARE = gameData.world.zones.find(({ art }) => !(art in ROADSIDE.zones))?.art ?? "";

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

const STAGE: RoadsideStage = { frameWidth, projection: PROJECTION, width: LAYOUT.roadView.width };

function frame(overrides: Partial<RoadsideFrame>): RoadsideFrame {
  return {
    current: ZONE_ARTS[0] ?? "",
    currentStart: 0,
    previous: null,
    previousStart: 0,
    scroll: 0,
    ...overrides,
  };
}

function placed(at: RoadsideFrame): RoadsidePlace[] {
  const out = newRoadsidePlaces();
  return out.slice(0, placeRoadside(STAGE, at, out));
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
// through their strides, a lot and a gap to a pair of slots.
function repeatSlots(zone: RoadsideZone): number {
  const cycle = (length: number, stride: number) => length / gcd(stride, length);
  const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
  const side = (name: "left" | "right") =>
    lcm(
      cycle(zone.lots.length, zone.sides[name].lotStride),
      cycle(zone.gaps.length, zone.sides[name].gapStride),
    );
  return 2 * lcm(side("left"), side("right"));
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

  it.each(KEYS.flatMap((key) => DEPTH_STEPS.map(({ suffix }) => `${key}${suffix}`)))(
    "has %s in the manifest",
    (key) => {
      expect(MANIFEST_KEYS).toContain(key);
    },
  );

  it.each(ROADSIDE.shadowed)("shadows %s, a key the manifest has", (key) => {
    expect(MANIFEST_KEYS).toContain(key);
  });

  it.each(PROPS)("stands $key at across $across beyond $art's sidewalk", (prop) => {
    const zone = gameData.world.zones.find(({ art }) => art === prop.art);
    const walkTo = Object.entries(VERGES).find(([id]) => id === zone?.id)?.[1].walkTo;
    expect(prop.across - frameWidth(prop.key) / 2).toBeGreaterThan(walkTo ?? Infinity);
  });
});

describe("slotProps", () => {
  it.each(ZONES)("alternates %s's lots and gaps, each lot across from a gap", (_, zone) => {
    for (let n = -100; n < 100; n++) {
      const [left, right] = ROADSIDE_SIDES.map(({ name }) =>
        zone.lots.includes(slotProps(zone, zone.sides[name], n)),
      );
      const [nextLeft] = ROADSIDE_SIDES.map(({ name }) =>
        zone.lots.includes(slotProps(zone, zone.sides[name], n + 1)),
      );
      expect(left).not.toBe(right);
      expect(nextLeft).not.toBe(left);
    }
  });
});

describe("eachRoadsideProp", () => {
  it.each(ZONES)("repeats %s's props with its slots", (_, zone) => {
    const period = repeatSlots(zone) * zone.slot;
    const from = -3 * zone.slot;
    const to = 5 * zone.slot;
    const shifted = propsBetween(zone, from + period, to + period).map((prop) => ({
      ...prop,
      z: prop.z - period,
    }));
    expect(propsBetween(zone, from, to).length).toBeGreaterThan(0);
    expect(shifted).toEqual(propsBetween(zone, from, to));
  });

  it.each(ZONES)("puts each of %s's props in one window only", (_, zone) => {
    const whole = propsBetween(zone, 0, 4 * zone.slot);
    const halves = [
      ...propsBetween(zone, 0, 2 * zone.slot),
      ...propsBetween(zone, 2 * zone.slot, 4 * zone.slot),
    ];
    const order = (props: typeof whole) =>
      props.map(({ key, sign, z }) => `${sign} ${z} ${key}`).sort();
    expect(order(halves)).toEqual(order(whole));
  });
});

describe("placeRoadside", () => {
  const SCROLLS = Array.from({ length: 60 }, (_, i) => i * 97);

  it.each(SCROLLS)("places every prop in view under the limit, scroll %i", (scroll) => {
    const out = newRoadsidePlaces();
    const count = placeRoadside(STAGE, frame({ scroll }), out);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(ROADSIDE_LIMIT);
    for (const place of out.slice(0, count)) {
      const half = (frameWidth(place.key) * Math.min(1, place.scale)) / 2;
      expect(place.y).toBeGreaterThanOrEqual(PROJECTION.farY - 1);
      expect(place.y).toBeLessThanOrEqual(PROJECTION.footY);
      expect(place.x + half).toBeGreaterThan(0);
      expect(place.x - half).toBeLessThan(STAGE.width);
    }
  });

  it("places nothing for a zone with no table", () => {
    expect(BARE).not.toBe("");
    expect(placed(frame({ current: BARE }))).toEqual([]);
  });

  it("keeps the zone before's props in view as a zone begins", () => {
    const length = 4000;
    const before = placed(frame({ scroll: length }));
    const after = placed(
      frame({
        current: BARE,
        currentStart: length,
        previous: ZONE_ARTS[0] ?? "",
        scroll: length,
      }),
    );
    expect(after.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it.each(SCROLLS.slice(0, 20))("leaves a zone's start strip clear, scroll %i", (step) => {
    const length = 4000;
    const scroll = length + step;
    const strip = length + PROJECTION.visibleDistance - scroll;
    const art = ZONE_ARTS[0] ?? "";
    for (const place of placed(
      frame({ current: art, currentStart: length, previous: art, scroll }),
    )) {
      const distance = PROJECTION.focal / place.scale - PROJECTION.focal;
      const along = distance - strip;
      expect(along < -1e-6 || along > START_STRIP_LENGTH - 1e-6).toBe(true);
    }
  });
});
