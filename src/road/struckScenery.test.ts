import { describe, expect, it } from "vitest";

import type { WalkItem } from "../runner/walk";
import { defined } from "../testing/defined";
import { struckBy, type StruckItem, struckNow } from "./struckScenery";

const ROAD_BOTTOM = 600;
const HIT_ZONE = 1;
const HIT_DISTANCE = 1000;
const item = (id: number, overrides: Partial<WalkItem> = {}): WalkItem => ({
  height: 40,
  id,
  kind: "cone",
  lane: 2,
  laneSpan: 1,
  y: 420,
  ...overrides,
});
// Where the walk is travel road pixels past the hit, in zoneIndex.
const at = (travel: number, zoneIndex = HIT_ZONE) => ({
  zoneDistance: HIT_DISTANCE + travel,
  zoneIndex,
});
const CROSSING: NonNullable<WalkItem["mover"]>["path"] = {
  direction: 1,
  enterTravel: 500,
  idle: 0,
  lanesPerPixel: 2.5 / 32,
  motion: "cross",
  movement: "dart",
  stopAfter: null,
  tilt: 0,
  turnAfter: null,
  warning: 50,
};

function struckOne(hit: WalkItem): StruckItem {
  return defined(struckBy({ bumps: [{ item: hit }], contacts: [], walk: { run: at(0) } })[0]);
}

describe("struck scenery", () => {
  it("keeps every obstacle a step's bumps and contacts took out of play, where the walk was", () => {
    const bumps = [{ item: item(1) }, { item: item(2, { kind: "hedge" }) }];
    const contacts = [{ item: item(3, { kind: "puddle" }) }];
    const struck = struckBy({ bumps, contacts, walk: { run: at(0) } });
    expect(struck.map(({ item: kept }) => kept.id)).toEqual([1, 2, 3]);
    expect(struck.map(({ zoneDistance, zoneIndex }) => [zoneDistance, zoneIndex])).toEqual(
      struck.map(() => [HIT_DISTANCE, HIT_ZONE]),
    );
  });

  it.each<[string, number, number, number | null]>([
    ["stands where it was hit while the road holds", 0, HIT_ZONE, 420],
    ["scrolls down the road as far as the walk goes", 60, HIT_ZONE, 480],
    ["is dropped once wholly past the road's bottom", ROAD_BOTTOM - 420, HIT_ZONE, null],
    ["is dropped in the next zone", 0, HIT_ZONE + 1, null],
  ])("%s", (_, travel, zoneIndex, y) => {
    const struck = struckOne(item(1));
    expect(struckNow(ROAD_BOTTOM, at(travel, zoneIndex), struck)?.y ?? null).toBe(y);
  });

  it("stops a mover where it was hit, scrolling only with the road", () => {
    const mover = { path: CROSSING, since: 80 };
    const hit = item(4, { mover });
    const later = struckNow(ROAD_BOTTOM, at(30), struckOne(hit));
    expect(later?.mover).toEqual(mover);
    expect(later?.y).toBe(hit.y + 30);
  });
});
