import { describe, expect, it } from "vitest";

import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { AmbientMover, ZoneId } from "../data/types";
import { CROSS_STREET } from "../layout/sceneryGags";
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

function deps(seed: number, drawable: (mover: AmbientMover) => boolean = () => true): AmbientDeps {
  return { drawable, random: randomStream(seed, "ambient"), stage: STAGE };
}

// Every frame of a walk of seconds through zone at the road's speed: the movers out, each
// with where it is drawn.
function walkThrough(
  zone: ZoneId,
  seconds: number,
  seed = 1,
  drawable?: (mover: AmbientMover) => boolean,
): { mover: AmbientMover; place: AmbientPlace }[][] {
  const state = startAmbient();
  const using = deps(seed, drawable);
  const frames = [];
  for (let frame = 0; frame * FRAME_SECONDS < seconds; frame++) {
    const now = frame * FRAME_SECONDS;
    const travelled = now * SPEED;
    stepAmbient(using, { movers: gameData.ambient[zone], now, travelled, zone }, state);
    frames.push(
      state.slots.flatMap((slot) => {
        const place = newPlace();
        return slot.active &&
          slot.mover !== null &&
          placeAmbient(STAGE, slot, now, travelled, place)
          ? [{ mover: slot.mover, place }]
          : [];
      }),
    );
  }
  return frames;
}

describe("stepAmbient", () => {
  it.each(ZONES)("keeps to the limit and sets out every kind of %s mover", (zone) => {
    const frames = walkThrough(zone, 600);
    expect(Math.max(...frames.map((out) => out.length))).toBeLessThanOrEqual(AMBIENT_LIMIT);
    const seen = new Set(frames.flat().map(({ mover }) => mover));
    expect([...seen]).toEqual(expect.arrayContaining([...gameData.ambient[zone]]));
  });

  it.each(ZONES)("keeps every %s mover off the road", (zone) => {
    const { centerX } = PROJECTION;
    const roadHalf = LAYOUT.road.width / 2;
    const onRoad = walkThrough(zone, 300)
      .flat()
      .filter(({ place }) =>
        place.band
          ? !BAND_ROWS.includes(place.y - LAYOUT.backdrop.y) || place.y >= LAYOUT.approach.y
          : Math.abs(place.x - centerX) < (roadHalf + ROAD_SPRITE_SIZE / 2) * place.scale,
      );
    expect(onRoad).toEqual([]);
  });

  it("plays the same movers for the same seed, and others for another", () => {
    const places = (seed: number) =>
      walkThrough("street", 60, seed).map((out) => out.map(({ place }) => place));
    expect(places(3)).toEqual(places(3));
    expect(places(4)).not.toEqual(places(3));
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

  it.each([1, 2, 3, 4])(
    "hops in bursts of one or two hops with a pause between, seed %i",
    (seed) => {
      const bursts = burstHops(seed);
      expect(bursts.length).toBeGreaterThan(5);
      expect(bursts.filter((hops) => hops !== 1 && hops !== 2)).toEqual([]);
    },
  );

  it.each(["fly", "steady"] as const)("moves a %s mover at its speed throughout", (gait) => {
    expect(gaitTravel(gait, 10, 1, 2)).toEqual({ moving: true, travel: 20 });
  });
});
