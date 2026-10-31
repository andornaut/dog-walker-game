import { describe, expect, it } from "vitest";

import { atPack, data, geometry, step, walkWith } from "../testing/walk";
import { type MoverPath, moverPlace, turnedBack } from "./movers";
import { roadScrollSpeed } from "./walk";
import type { WalkItem } from "./walkItems";

describe("a resolved bump", () => {
  it("retires a returning mover, collects during grace and allows a different spawn of its kind", () => {
    const path: MoverPath = {
      direction: 1,
      enterTravel: 532,
      idle: 0,
      lanesPerPixel: 0.015,
      motion: "cross",
      movement: "dart",
      stopAfter: null,
      tilt: -1,
      turnAfter: 3.1,
      warning: 50,
    };
    const since = path.warning + 2.5 / path.lanesPerPixel;
    const ball: WalkItem = { ...atPack("ball"), mover: { path, since } };
    const initial = walkWith(["kilo"], [ball]);
    const hit = step(initial);
    expect(hit.bumps.map(({ item }) => item.id)).toEqual([ball.id]);
    expect(hit.walk.road.items).toEqual([]);

    const released = step(hit.walk, data.tuning.seconds.minorHitStopSeconds + 0.01).walk;
    const pickup = step({ ...released, road: { ...released.road, items: [atPack("tip", 1)] } });
    expect(pickup.walk.road.invulnerableSeconds).toBeGreaterThan(0);
    expect(pickup.tips).toHaveLength(1);

    const laterSeconds = data.tuning.seconds.collisionGrace + 0.1;
    const later = step(pickup.walk, laterSeconds);
    expect(later.walk.road.invulnerableSeconds).toBe(0);
    expect(later.bumps).toEqual([]);
    expect(later.walk.road.items).toEqual([]);

    const returnedAt = since + roadScrollSpeed(data, initial) * (laterSeconds + 0.02);
    expect(turnedBack(path, returnedAt)).toBe(true);
    expect(moverPlace(geometry.laneCount, path, returnedAt).lanePosition).toBeGreaterThan(1);
    const other = { ...ball, id: 2, mover: { path, since: returnedAt } };
    const next = step({ ...later.walk, road: { ...later.walk.road, items: [other] } });
    expect(next.bumps.map(({ item }) => item.id)).toEqual([other.id]);
  });
});
