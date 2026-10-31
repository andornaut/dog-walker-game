import { describe, expect, it } from "vitest";

import { atPack, data, geometry, step, walkWith } from "../testing/walk";
import { hitDog } from "./collision";
import { type MoverPath, moverPlace, turnedBack } from "./movers";
import { obstacleHitBox, packBoxes, roadScrollSpeed } from "./walk";
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

describe("an unhit mover the walker passed", () => {
  it("retires it before an upward reversal can hit, without suppressing pickups", () => {
    const since = 50 + 2.5 / 0.015;
    const feetY = geometry.lens.footY + 66;
    const path: MoverPath = {
      direction: 1,
      enterTravel: feetY - geometry.roadTop + since - 50,
      idle: 0,
      lanesPerPixel: 0.015,
      motion: "cross",
      movement: "dart",
      stopAfter: null,
      tilt: -2,
      turnAfter: 3.1,
      warning: 50,
    };
    const ball: WalkItem = {
      ...atPack("ball"),
      mover: { path, since },
      y: feetY - atPack("ball").height,
    };
    const walk = walkWith(["kilo"], [ball, atPack("tip", 1)]);
    expect(obstacleHitBox(data, geometry, ball).top).toBeGreaterThan(geometry.lens.footY);
    const travel = roadScrollSpeed(data, walk);
    const returnedAt = since + travel;
    const returned = {
      ...ball,
      mover: { path, since: returnedAt },
      y: geometry.roadTop - ball.height + moverPlace(geometry.laneCount, path, returnedAt).travel,
    };
    expect(turnedBack(path, returnedAt)).toBe(true);
    expect(
      hitDog(
        packBoxes(geometry, walk.road.control.motion, walk.run),
        obstacleHitBox(data, geometry, returned),
      ),
    ).toBe("kilo");

    const passed = step(walk, 0);
    expect(passed.bumps).toEqual([]);
    expect(passed.contacts).toEqual([]);
    expect(passed.passed.map(({ id }) => id)).toEqual([ball.id]);
    expect(passed.tips).toHaveLength(1);
    expect(passed.walk.road.items).toEqual([]);
    expect(step(passed.walk, 1).bumps).toEqual([]);
  });
});
