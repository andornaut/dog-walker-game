import { describe, expect, it } from "vitest";

import { ROAD_SPRITE_SIZE } from "../../assets/spriteKeys";
import { LANE_COUNT, SCREEN_CONFIG } from "../../data/screen";
import { WORLD } from "../../data/world";
import { curbBand, VERGES } from "../../road/roadside";
import type { KeptScenery } from "../../road/struckScenery";
import { DART_VERGE_LANES } from "../../runner/moverPlanning";
import { type MoverPath, moverPlace } from "../../runner/movers";
import { goesToVerge, vergeNow } from "./vergeScenery";

const ROAD = { laneCount: LANE_COUNT, roadBottom: 700, roadTop: 0 };
const KEPT_ZONE = 1;
const KEPT_DISTANCE = 1000;
// A dart setting off at 500px of travel across the road at 2.5 lanes per 32px, stopping
// stopAfter lanes from its edge: on the verge past the far edge, in the far lane, or never.
const darting = (stopAfter: number | null): MoverPath => ({
  direction: 1,
  enterTravel: 500,
  idle: 0,
  lanesPerPixel: 2.5 / 32,
  motion: "cross",
  movement: "dart",
  stopAfter,
  tilt: 0,
  turnAfter: null,
  warning: 50,
});
const VERGING = darting(LANE_COUNT + DART_VERGE_LANES);
// Kept 70px of scroll after its cue: 5.47 lanes across, just off the road.
const kept = (path: MoverPath): KeptScenery => ({
  item: {
    height: 40,
    id: 1,
    kind: "seagull",
    lane: 5,
    laneSpan: 1,
    mover: { path, since: 120 },
    y: 0,
  },
  zoneDistance: KEPT_DISTANCE,
  zoneIndex: KEPT_ZONE,
});

describe("goesToVerge", () => {
  it.each([
    { goes: true, name: "stops on the verge", path: VERGING },
    { goes: false, name: "stops in the far lane", path: darting(LANE_COUNT - 0.5) },
    { goes: false, name: "crosses", path: darting(null) },
  ])("keeps a dart that $name as scenery: $goes", ({ goes, path }) => {
    expect(goesToVerge(LANE_COUNT, kept(path).item)).toBe(goes);
  });
});

describe("vergeNow", () => {
  // Played on as far as the walk has gone, it crosses on to its stop past the far edge and then
  // comes down the road with it, its top at roadTop less its height plus its travel; it is gone
  // once that is past the road's bottom, or in another zone.
  it.each([
    { name: "just kept", travel: 0, zoneIndex: KEPT_ZONE },
    { name: "stopped on the verge", travel: 60, zoneIndex: KEPT_ZONE },
    { name: "near the road's bottom", travel: 160, zoneIndex: KEPT_ZONE },
    { name: "past the road's bottom", travel: 300, zoneIndex: KEPT_ZONE },
    { name: "in the next zone", travel: 60, zoneIndex: KEPT_ZONE + 1 },
  ])("draws a dart on the verge $name", ({ travel, zoneIndex }) => {
    const verging = kept(VERGING);
    const now = vergeNow(ROAD, { zoneDistance: KEPT_DISTANCE + travel, zoneIndex }, verging);
    const since = 120 + travel;
    const place = moverPlace(LANE_COUNT, VERGING, since);
    const y = ROAD.roadTop - verging.item.height + place.travel;
    const shown = zoneIndex === KEPT_ZONE && y < ROAD.roadBottom;
    expect(now).toEqual(shown ? { ...verging.item, mover: { path: VERGING, since }, y } : null);
  });

  it("stands a dart on the verge past the far edge once stopped", () => {
    const place = moverPlace(LANE_COUNT, VERGING, 1e6);
    expect(place.lanePosition).toBeCloseTo(LANE_COUNT - 0.5 + DART_VERGE_LANES);
  });
});

// Where a dart stops on the verge, its frame stands clear of the road and of every zone's curb
// props, out on the sidewalk's far side or on the lawn.
describe("DART_VERGE_LANES", () => {
  const across =
    SCREEN_CONFIG.roadWidth / 2 + (DART_VERGE_LANES * SCREEN_CONFIG.roadWidth) / LANE_COUNT;
  it.each(WORLD.zones.map(({ id }) => ({ zone: id })))(
    "stops a dart clear of the curb in $zone",
    ({ zone }) => {
      const verge = VERGES[zone];
      const clear = curbBand(verge)?.to ?? SCREEN_CONFIG.roadWidth / 2;
      expect(across - ROAD_SPRITE_SIZE / 2).toBeGreaterThanOrEqual(clear);
    },
  );
});
