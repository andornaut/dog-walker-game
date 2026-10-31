import { describe, expect, it } from "vitest";

import { signatureTrail } from "../testing/signature";
import { data, geometry, walkWith } from "../testing/walk";
import { hitDog } from "./collision";
import { obstacleHitBoxes, packBoxes, roadScrollSpeed, stepWalk } from "./walk";

describe("signature components", () => {
  it("keeps gaps between three separate bodies outside the collision geometry", () => {
    const { item } = signatureTrail([2, 4]);
    const walk = walkWith(["kilo"]);
    const pack = packBoxes(geometry, walk.road.control.motion, walk.run);
    const feetY = (geometry.packBand.top + geometry.packBand.bottom) / 2 + 80;
    const boxes = obstacleHitBoxes(data, geometry, item(feetY));
    expect(boxes).toHaveLength(3);
    expect(boxes.map((box) => hitDog(pack, box))).toEqual([null, null, null]);
    expect(Math.min(...boxes.map(({ top }) => top))).toBeLessThan(geometry.packBand.top);
    expect(Math.max(...boxes.map(({ bottom }) => bottom))).toBeGreaterThan(
      geometry.packBand.bottom,
    );
  });

  it("keeps the logical trail when the leader leaves and followers remain on the road", () => {
    const { item } = signatureTrail([2, 4]);
    const shown = item((geometry.packBand.top + geometry.packBand.bottom) / 2 + 80);
    expect(shown.y).toBeGreaterThan(geometry.roadBottom);
    const result = stepWalk(data, geometry, () => 0.99, 0, walkWith(["kilo"], [shown]));
    expect(result.bumps).toHaveLength(0);
    expect(result.walk.road.items.map(({ id }) => id)).toEqual([shown.id]);
  });

  it("produces one logical hit and removes all three touching components together", () => {
    const { item } = signatureTrail([0.01, 0.02]);
    const walk = walkWith(["kilo"]);
    const pack = packBoxes(geometry, walk.road.control.motion, walk.run);
    const shown = item((pack.dogs[0]?.top ?? geometry.packBand.top) + 10);
    expect(obstacleHitBoxes(data, geometry, shown).map((box) => hitDog(pack, box))).toEqual([
      "kilo",
      "kilo",
      "kilo",
    ]);
    const result = stepWalk(data, geometry, () => 0.99, 0, {
      ...walk,
      road: { ...walk.road, items: [shown] },
    });
    expect(result.bumps).toHaveLength(1);
    expect(result.bumps[0]?.item.id).toBe(shown.id);
    expect(result.walk.road.items).toHaveLength(0);
  });

  it("collides during a final crossing even when every component has exited by the next step", () => {
    const { height, item } = signatureTrail([0.01, 0.02]);
    const shown = item(geometry.packBand.top - 10);
    const walk = walkWith(["kilo"], [shown]);
    const pack = packBoxes(geometry, walk.road.control.motion, walk.run);
    expect(obstacleHitBoxes(data, geometry, shown).every((box) => hitDog(pack, box) === null)).toBe(
      true,
    );
    const travel = geometry.roadBottom + height + 10 - shown.y - height;
    const result = stepWalk(data, geometry, () => 0.99, travel / roadScrollSpeed(data, walk), walk);
    expect(result.bumps).toHaveLength(1);
    expect(result.walk.road.items).toHaveLength(0);
  });
});
