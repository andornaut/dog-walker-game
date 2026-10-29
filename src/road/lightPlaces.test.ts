import { describe, expect, it, vi } from "vitest";

import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import { project, roadProjection } from "../layout/projection";
import { screenLayout, walkerFootY } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import {
  type LightPlace,
  newLightPlaces,
  placeVergeLights,
  poolZs,
  type VergeLightFrame,
} from "./lightPlaces";
import { VERGES } from "./roadside";
import { START_STRIP_LENGTH } from "./roadsideProps";

// Yonge Street's verge made over as the test verge, with a light every 128, and The Beaches'
// as the same verge with its lights shown in Yonge Street alone.
vi.mock("../../shared/verges.json", async (importOriginal) => {
  const { default: table } = await importOriginal<{ default: Record<string, unknown> }>();
  const { PAVED_VERGE } = await import("../testing/verges");
  const yongeOnly = PAVED_VERGE.pools.map((pool) => ({ ...pool, zones: ["yongeStreet"] }));
  return {
    default: {
      ...table,
      "the-beaches": { ...PAVED_VERGE, pools: yongeOnly },
      "yonge-street": PAVED_VERGE,
    },
  };
});

const LIT: ZoneId = "yongeStreet";
const UNLIT: ZoneId = "theBeaches";
const pool = itemAt(VERGES[LIT].pools, 0);
const { road } = screenLayout(SCREEN_CONFIG);
const projection = roadProjection(ROAD_CAMERA, walkerFootY(road), road);
// Wide enough that no light is left out for lying off screen.
const stage = { projection, reach: 600, width: 1e6 };

const frameOf = (overrides: Partial<VergeLightFrame>): VergeLightFrame => ({
  current: LIT,
  currentStart: 0,
  previous: null,
  previousStart: 0,
  scroll: 0,
  ...overrides,
});
const placed = (frame: VergeLightFrame): LightPlace[] => {
  const out = newLightPlaces(64);
  return out.slice(0, placeVergeLights(stage, frame, out)).map((place) => ({ ...place }));
};

describe("poolZs", () => {
  it.each([
    [0, 0, 300, [0, 128, 256]],
    [64, 0, 300, [64, 192]],
    [64, -200, 0, [-192, -64]],
    [0, 128, 129, [128]],
    [0, 1, 128, []],
  ])("stands lights offset %d along from %d to %d at %j", (offset, from, to, zs) => {
    expect(poolZs(pool, offset, from, to)).toEqual(zs);
  });
});

describe("placeVergeLights", () => {
  // Every light of a zone that began at start, with its distance from the walk's start from
  // from to to (excluded), projected at its z along the zone's road from its start strip,
  // visibleDistance past where the zone began.
  const expected = (start: number, scroll: number, from: number, to: number) => {
    const origin = start + projection.visibleDistance;
    return (["left", "right"] as const).flatMap((side, s) =>
      poolZs(pool, pool.offset[side], from - origin, to - origin).map((z) => {
        const spot = project(projection, {
          distance: origin + z - scroll,
          x: projection.centreX + (s === 0 ? -1 : 1) * pool.across,
        });
        return { key: pool.light, scale: spot.scale, x: spot.x, y: spot.y };
      }),
    );
  };
  const reachOf = (scroll: number) => scroll + stage.reach + 1;

  // A walk started mid-route, or a zone reached later, starts the zone at another scroll; its
  // lights keep their places along its own road.
  it.each([0, 1667, 12345.5])("places the zone's lights from its start at %d", (start) => {
    for (const into of [-500, 0, 333.5]) {
      const frame = frameOf({ currentStart: start, scroll: start + into });
      const places = placed(frame);
      expect(places).toEqual(expected(start, frame.scroll, frame.scroll, reachOf(frame.scroll)));
      expect(places).toEqual(placed(frameOf({ scroll: into })));
    }
  });

  it("places no light in a zone its pools leave out", () => {
    expect(placed(frameOf({ current: UNLIT, scroll: 100 }))).toEqual([]);
  });

  // The start strip lies part way up the view: the previous zone's road below it, the current
  // zone's beyond it.
  const CURRENT_START = 5000;
  const STRIP_AT = CURRENT_START + projection.visibleDistance;
  const SCROLL = STRIP_AT - 300;
  it.each([
    { current: UNLIT, from: SCROLL, name: "previous", previous: LIT, start: -3000, to: STRIP_AT },
    {
      current: LIT,
      from: STRIP_AT + START_STRIP_LENGTH,
      name: "current",
      previous: UNLIT,
      start: CURRENT_START,
      to: reachOf(SCROLL),
    },
  ])("places only the $name zone's lights, on its own road, at a zone change", (zones) => {
    const lit = placed(
      frameOf({
        current: zones.current,
        currentStart: CURRENT_START,
        previous: zones.previous,
        previousStart: -3000,
        scroll: SCROLL,
      }),
    );
    expect(lit.length).toBeGreaterThan(0);
    expect(lit).toEqual(expected(zones.start, SCROLL, zones.from, zones.to));
  });
});
