import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { AmbientMover, ZoneId } from "../data/types";
import { CROSS_STREET } from "../layout/crossStreet";
import { scaleAtY } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { randomStream } from "../lib/random";
import { keysOf } from "../lib/records";
import { walkProjection } from "../runner/walkGeometry";
import {
  AMBIENT_LIMIT,
  type AmbientDeps,
  type AmbientPlace,
  type AmbientStage,
  clearAmbient,
  gaitTravel,
  HOP,
  newPlace,
  placeAmbient,
  SKY_ROWS,
  skyRows,
  startAmbient,
  stepAmbient,
} from "./ambient";
import { curbBand, VERGES } from "./roadside";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const STAGE: AmbientStage = { band: LAYOUT.backdrop, projection: PROJECTION };
const FRAME_SECONDS = 1 / 60;
const ZONES = keysOf(gameData.ambient);
const SPEED = gameData.tuning.pixels.roadScrollSpeed;
const BAND_ROWS: readonly number[] = Object.values(CROSS_STREET);
// Every feet row a sky mover can fly on.
function skyRowsOf(mover: AmbientMover): number[] {
  const { from, to } = skyRows(mover);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
const isSky = ({ mover }: { mover: AmbientMover }) => mover.path === "sky";

// A sprite's frame width at full size, from its sheet.
function frameWidth(key: string): number {
  const sheet = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8")) as {
    frames: Record<string, { sourceSize: { w: number } }>;
  };
  return Object.values(sheet.frames)[0]?.sourceSize.w ?? 0;
}

function deps(seed: number, drawable: (mover: AmbientMover) => boolean = () => true): AmbientDeps {
  return { drawable, random: randomStream(seed, "ambient"), stage: STAGE };
}

// One mover out on a frame: its slot, the walk time it set out (with the slot, which mover
// this is), and where it is drawn.
interface Shown {
  born: number;
  mover: AmbientMover;
  place: AmbientPlace;
  slot: number;
}

// Every frame of a walk of seconds through zone at the road's speed: the movers out.
function walkThrough(
  zone: ZoneId,
  seconds: number,
  seed = 1,
  drawable?: (mover: AmbientMover) => boolean,
  movers: readonly AmbientMover[] = gameData.ambient[zone],
): Shown[][] {
  const state = startAmbient();
  const using = deps(seed, drawable);
  const frames = [];
  for (let frame = 0; frame * FRAME_SECONDS < seconds; frame++) {
    const now = frame * FRAME_SECONDS;
    const travelled = now * SPEED;
    stepAmbient(using, { movers, now, travelled, zone }, state);
    frames.push(
      state.slots.flatMap((slot, index) => {
        const place = newPlace();
        return slot.active &&
          slot.mover !== null &&
          placeAmbient(STAGE, slot, now, travelled, place)
          ? [{ born: slot.bornAt, mover: slot.mover, place, slot: index }]
          : [];
      }),
    );
  }
  return frames;
}

// The same mover on the frame before: in the same slot and set out at the same time, as a slot
// can pass from one mover to the next within a frame.
function before(frames: readonly Shown[][], i: number, { born, slot }: Shown): Shown | undefined {
  return frames[i - 1]?.find((each) => each.slot === slot && each.born === born);
}

// The movers facing the wrong way while moving. Side views face right in their art, so a mover
// moving left is mirrored; front and back views walking along the sidewalks never are.
function misfaced(frames: readonly Shown[][]): Shown[] {
  return frames.flatMap((out, i) =>
    out.filter((each) => {
      const last = before(frames, i, each);
      const { mover, place } = each;
      if (last === undefined || !place.moving || !last.place.moving) {
        return false;
      }
      if (mover.path === "sidewalkAway" || mover.path === "sidewalkToward") {
        return place.flip;
      }
      const dx = place.x - last.place.x;
      return dx !== 0 && place.flip !== dx < 0;
    }),
  );
}

describe("stepAmbient", () => {
  // One long walk through each zone: under the limit with every kind set out, off the road,
  // each side view mirrored only moving left, and the cross street's movers smaller than the
  // road's far edge, nearer rows larger.
  it("keeps every zone's movers to the limit, off the road, facing their way and to scale", () => {
    const { centreX } = PROJECTION;
    const roadHalf = LAYOUT.road.width / 2;
    const farEdge = scaleAtY(PROJECTION, PROJECTION.farY);
    for (const zone of ZONES) {
      const frames = walkThrough(zone, 600);
      const shown = frames.flat();
      expect(Math.max(...frames.map((out) => out.length)), zone).toBeLessThanOrEqual(AMBIENT_LIMIT);
      const seen = new Set(shown.map(({ mover }) => mover));
      expect([...seen], zone).toEqual(expect.arrayContaining([...gameData.ambient[zone]]));

      const onRoad = shown.filter((each) => {
        const { place } = each;
        const rows = isSky(each) ? skyRowsOf(each.mover) : BAND_ROWS;
        return place.band
          ? !rows.includes(place.y - LAYOUT.backdrop.y) || place.y >= LAYOUT.approach.y
          : Math.abs(place.x - centreX) < (roadHalf + ROAD_SPRITE_SIZE / 2) * place.scale;
      });
      expect(onRoad, zone).toEqual([]);

      expect(misfaced(frames), zone).toEqual([]);

      const sky = shown.filter(isSky).map(({ place }) => place);
      expect(
        sky.filter(({ band, scale }) => !band || scale !== 1),
        zone,
      ).toEqual([]);
      const band = shown
        .filter((each) => each.place.band && !isSky(each))
        .map(({ place }) => place);
      expect(band.length, zone).toBeGreaterThan(0);
      expect(
        band.filter(({ scale }) => scale >= farEdge),
        zone,
      ).toEqual([]);
      const byRow = new Map(band.map(({ scale, y }) => [y, scale]));
      const rows = [...byRow.keys()].sort((a, b) => a - b);
      expect(
        rows.map((y) => byRow.get(y)),
        zone,
      ).toEqual(rows.map((y) => byRow.get(y)).sort((a = 0, b = 0) => a - b));
    }
  });

  // A crowded band, built from the first mover on each band path: every slot is taken, so as
  // one mover leaves the next sets out in its slot within the same frame. The newcomer is drawn
  // from its own start, facing its way, and the facing check follows it, not the slot.
  const CROWDED = (["crossStreet", "crossWalk", "sky"] as const).flatMap((path) =>
    ZONES.flatMap((zone) => gameData.ambient[zone].filter((mover) => mover.path === path))
      .slice(0, 1)
      .map((mover) => ({ mover: { ...mover, perMinute: 6000 }, path })),
  );

  it.each(CROWDED)("hands a $path mover's slot to the next within a frame", ({ mover }) => {
    const { width } = LAYOUT.backdrop;
    const frames = walkThrough("homeStretch", 120, 1, undefined, [mover]);
    const handovers = frames.flatMap((out, i) =>
      out.filter(
        (each) =>
          before(frames, i, each) === undefined &&
          (frames[i - 1] ?? []).some(({ slot }) => slot === each.slot),
      ),
    );
    expect(handovers.length).toBeGreaterThan(0);
    const offStart = handovers.filter(
      ({ place }) => place.x !== (place.flip ? width + ROAD_SPRITE_SIZE : -ROAD_SPRITE_SIZE),
    );
    expect(offStart).toEqual([]);
    expect(misfaced(frames)).toEqual([]);

    // A newcomer mirrored the wrong way on its second frame is caught.
    const [first] = handovers;
    const next = frames.findIndex((out) => first !== undefined && out.includes(first)) + 1;
    const second = frames[next]?.find((each) => before(frames, next, each) === first);
    expect(second).toBeDefined();
    if (second !== undefined) {
      second.place.flip = !second.place.flip;
    }
    expect(misfaced(frames)).toEqual([second]);
  });

  it("plays the same movers for the same seed, and others for another", () => {
    const places = (seed: number) =>
      walkThrough("street", 60, seed).map((out) => out.map(({ place }) => place));
    expect(places(3)).toEqual(places(3));
    expect(places(4)).not.toEqual(places(3));
  });

  // A plane built from a cross street car: it crosses the band's top rows both ways at full
  // size, mirrored going left, its feet on its own rows or, without them, SKY_ROWS.
  it.each([
    { name: "SKY_ROWS", rows: undefined },
    { name: "its own rows", rows: { from: 26, to: 40 } },
  ])("flies a sky mover across $name both ways at full size", ({ rows }) => {
    const planes = gameData.ambient.street
      .filter(({ path }) => path === "crossStreet")
      .slice(0, 1)
      .map((car): AmbientMover => ({ ...car, path: "sky", ...(rows && { rows }) }));
    expect(planes).toHaveLength(1);
    const allowed = rows ?? SKY_ROWS;
    const shown = walkThrough("homeStretch", 600, 1, undefined, planes).flat();
    const wrong = shown.filter(
      ({ place }) =>
        !place.band ||
        place.scale !== 1 ||
        place.y - LAYOUT.backdrop.y < allowed.from ||
        place.y - LAYOUT.backdrop.y > allowed.to,
    );
    expect(wrong).toEqual([]);
    expect(new Set(shown.map(({ place }) => place.y)).size).toBeGreaterThan(1);
    expect(new Set(shown.map(({ place }) => place.flip))).toEqual(new Set([false, true]));
  });

  it("sets out no mover that has no art", () => {
    const drawn = walkThrough("street", 120, 1, (mover) => mover.path !== "crossStreet");
    expect(drawn.flat().filter(({ mover }) => mover.path === "crossStreet")).toEqual([]);
    expect(drawn.flat().length).toBeGreaterThan(0);
  });

  // Every zone with movers stopping beside the road: each stopped mover's frame clear of the
  // curb band, where the curb props stand.
  const STOPPING = ZONES.filter((zone) =>
    gameData.ambient[zone].some(({ path }) => path === "verge"),
  );

  it.each(STOPPING)("stops %s's verge movers clear of its curb band", (zone) => {
    const band = curbBand(VERGES[zone]);
    const stopped = walkThrough(zone, 300)
      .flat()
      .filter(({ mover, place }) => mover.path === "verge" && !place.moving && place.lift === 0);
    expect(stopped.length).toBeGreaterThan(0);
    const inBand = stopped.filter(({ mover, place }) => {
      const across = Math.abs(place.x - PROJECTION.centreX) / place.scale;
      return band !== null && across - frameWidth(mover.key) / 2 <= band.to;
    });
    expect(inBand).toEqual([]);
  });

  it("ends the last zone's movers in a new zone", () => {
    const state = startAmbient();
    const using = deps(1);
    for (let now = 0; now < 60; now += 1) {
      stepAmbient(
        using,
        { movers: gameData.ambient.street, now, travelled: 0, zone: "street" },
        state,
      );
    }
    expect(state.slots.some((slot) => slot.active)).toBe(true);
    stepAmbient(using, { movers: [], now: 60, travelled: 0, zone: "park" }, state);
    expect(state.slots.filter((slot) => slot.active)).toEqual([]);
  });

  it("ends every mover when cleared", () => {
    const state = startAmbient();
    const using = deps(2);
    for (let now = 0; now < 60; now += 1) {
      stepAmbient(
        using,
        { movers: gameData.ambient.shops, now, travelled: 0, zone: "shops" },
        state,
      );
    }
    clearAmbient(state);
    expect(state.slots.filter((slot) => slot.active)).toEqual([]);
  });
});

describe("gaitTravel", () => {
  // The lengths of each run of moving samples, in hops.
  function burstHops(seed: number): number[] {
    const bursts: number[] = [];
    let run = 0;
    const step = HOP.seconds / 20;
    for (let t = 0; t < 20; t += step) {
      if (gaitTravel("hop", 1, seed, t).moving) {
        run += 1;
      } else if (run > 0) {
        bursts.push(Math.round((run * step) / HOP.seconds));
        run = 0;
      }
    }
    return bursts;
  }

  it("hops in bursts of one or two hops with a pause between", () => {
    const bursts = burstHops(1);
    expect(bursts.length).toBeGreaterThan(5);
    expect(bursts.filter((hops) => hops !== 1 && hops !== 2)).toEqual([]);
  });
});

describe("sky movers", () => {
  const sprites = new Map(parseManifest(shippedManifest).sprites.map((each) => [each.key, each]));
  const sheets = import.meta.glob<{
    frames: Record<string, { sourceSize: { h: number; w: number } }>;
  }>("../../public/art/sprites/*.json", { eager: true, import: "default" });
  // Each mover's highest and lowest feet rows: the sprite's top is highest at the first and its
  // bottom lowest at the last, so the rows between them can only fit when both ends do.
  const sky = ZONES.flatMap((zone) =>
    gameData.ambient[zone]
      .filter((mover) => mover.path === "sky")
      .flatMap((mover) => {
        const { from, to } = skyRows(mover);
        return [...new Set([from, to])].map((row) => ({ key: mover.key, row, zone }));
      }),
  );

  // The sprite's top row stays at or below the band's top edge, and its bottom row inside the
  // band, at every feet row it can fly on.
  it.each(sky)("draws $zone's $key inside the band with its feet on row $row", ({ key, row }) => {
    const entry = sprites.get(key);
    const sheet = entry === undefined ? undefined : sheets[`../../public/art/${entry.json}`];
    const frame = sheet === undefined ? undefined : Object.values(sheet.frames)[0];
    expect(entry?.anchor, key).toBeDefined();
    expect(frame, key).toBeDefined();
    const feetY = entry?.anchor?.feetY ?? 0;
    const height = frame?.sourceSize.h ?? 0;
    expect(row - feetY).toBeGreaterThanOrEqual(0);
    expect(row - feetY + height).toBeLessThanOrEqual(LAYOUT.backdrop.height);
  });
});
