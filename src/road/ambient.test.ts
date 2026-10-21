import { describe, expect, it } from "vitest";

import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { AmbientMover, ZoneId } from "../data/types";
import { CROSS_STREET } from "../layout/crossStreet";
import { scaleAtY } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { randomStream } from "../lib/random";
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
  startAmbient,
  stepAmbient,
} from "./ambient";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const STAGE: AmbientStage = { band: LAYOUT.backdrop, projection: PROJECTION };
const FRAME_SECONDS = 1 / 60;
const ZONES = Object.keys(gameData.ambient) as ZoneId[];
const SPEED = gameData.tuning.pixels.roadScrollSpeed;
const BAND_ROWS: readonly number[] = Object.values(CROSS_STREET);
const SKY_ROWS_ALL = Array.from(
  { length: SKY_ROWS.to - SKY_ROWS.from + 1 },
  (_, i) => SKY_ROWS.from + i,
);
const isSky = ({ mover }: { mover: AmbientMover }) => mover.path === "sky";

function deps(seed: number, drawable: (mover: AmbientMover) => boolean = () => true): AmbientDeps {
  return { drawable, random: randomStream(seed, "ambient"), stage: STAGE };
}

// Every frame of a walk of seconds through zone at the road's speed: the movers out, each
// with its slot and where it is drawn.
function walkThrough(
  zone: ZoneId,
  seconds: number,
  seed = 1,
  drawable?: (mover: AmbientMover) => boolean,
  movers: readonly AmbientMover[] = gameData.ambient[zone],
): { mover: AmbientMover; place: AmbientPlace; slot: number }[][] {
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
          ? [{ mover: slot.mover, place, slot: index }]
          : [];
      }),
    );
  }
  return frames;
}

describe("stepAmbient", () => {
  // One long walk through each zone: under the limit with every kind set out, off the road,
  // each side view mirrored only moving left, and the cross street's movers smaller than the
  // road's far edge, nearer rows larger.
  it("keeps every zone's movers to the limit, off the road, facing their way and to scale", () => {
    const { centerX } = PROJECTION;
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
        const rows = isSky(each) ? SKY_ROWS_ALL : BAND_ROWS;
        return place.band
          ? !rows.includes(place.y - LAYOUT.backdrop.y) || place.y >= LAYOUT.approach.y
          : Math.abs(place.x - centerX) < (roadHalf + ROAD_SPRITE_SIZE / 2) * place.scale;
      });
      expect(onRoad, zone).toEqual([]);

      // Side views face right in their art, so a mover moving left is mirrored; front and back
      // views walking along the sidewalks never are.
      const misfaced = frames.slice(1).flatMap((out, i) =>
        out.filter(({ mover, place, slot }) => {
          const before = frames[i]?.find((each) => each.slot === slot && each.mover === mover);
          if (before === undefined || !place.moving || !before.place.moving) {
            return false;
          }
          if (mover.path === "sidewalkAway" || mover.path === "sidewalkToward") {
            return place.flip;
          }
          const dx = place.x - before.place.x;
          return dx !== 0 && place.flip !== dx < 0;
        }),
      );
      expect(misfaced, zone).toEqual([]);

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

  it("plays the same movers for the same seed, and others for another", () => {
    const places = (seed: number) =>
      walkThrough("street", 60, seed).map((out) => out.map(({ place }) => place));
    expect(places(3)).toEqual(places(3));
    expect(places(4)).not.toEqual(places(3));
  });

  // A plane built from a cross street car, until a zone's data lists a sky mover: it crosses
  // the band's top rows both ways at full size, mirrored going left.
  it("flies a sky mover across the band's top rows both ways at full size", () => {
    const planes = gameData.ambient.street
      .filter(({ path }) => path === "crossStreet")
      .slice(0, 1)
      .map((car): AmbientMover => ({ ...car, path: "sky" }));
    expect(planes).toHaveLength(1);
    const shown = walkThrough("homeStretch", 600, 1, undefined, planes).flat();
    const wrong = shown.filter(
      ({ place }) =>
        !place.band || place.scale !== 1 || !SKY_ROWS_ALL.includes(place.y - LAYOUT.backdrop.y),
    );
    expect(wrong).toEqual([]);
    expect(new Set(shown.map(({ place }) => place.flip))).toEqual(new Set([false, true]));
  });

  it("sets out no mover that has no art", () => {
    const drawn = walkThrough("street", 120, 1, (mover) => mover.path !== "crossStreet");
    expect(drawn.flat().filter(({ mover }) => mover.path === "crossStreet")).toEqual([]);
    expect(drawn.flat().length).toBeGreaterThan(0);
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
