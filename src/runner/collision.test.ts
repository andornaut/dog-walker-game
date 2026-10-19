import { describe, expect, it } from "vitest";

import { collideWithPack, tickInvulnerability, touchesPack } from "./collision";
import type { RoadItem } from "./roadItems";

type Kind = "obstacle" | "tip";

const rules = {
  invulnerabilitySeconds: 1,
  startsInvulnerability: (item: RoadItem<Kind>) => item.kind === "obstacle",
};
const still = { bottom: 560, lanes: [2], top: 520 };
const midMove = { ...still, lanes: [2, 3] };

const item = (id: number, kind: Kind, lane: number, y: number, laneSpan = 1): RoadItem<Kind> => ({
  height: 32,
  id,
  kind,
  lane,
  laneSpan,
  y,
});

describe("touchesPack", () => {
  it("touches an item in an occupied lane that overlaps the band", () => {
    expect(touchesPack(still, item(1, "tip", 2, 500))).toBe(true);
    expect(touchesPack(still, item(1, "tip", 2, 559))).toBe(true);
  });

  it("misses an item in a lane the pack is not in", () => {
    expect(touchesPack(still, item(1, "tip", 3, 530))).toBe(false);
  });

  it("touches an item spanning several lanes in any of them", () => {
    expect(touchesPack(still, item(1, "obstacle", 0, 530, 3))).toBe(true);
    expect(touchesPack(still, item(1, "obstacle", 2, 530, 2))).toBe(true);
    expect(touchesPack(still, item(1, "obstacle", 0, 530, 2))).toBe(false);
    expect(touchesPack(still, item(1, "obstacle", 3, 530, 2))).toBe(false);
  });

  it("misses an item that only meets the band's edge", () => {
    expect(touchesPack(still, item(1, "tip", 2, 488))).toBe(false);
    expect(touchesPack(still, item(1, "tip", 2, 560))).toBe(false);
  });

  it("touches items in both lanes while moving between them", () => {
    expect(touchesPack(midMove, item(1, "tip", 2, 530))).toBe(true);
    expect(touchesPack(midMove, item(2, "tip", 3, 530))).toBe(true);
    expect(touchesPack(midMove, item(3, "tip", 1, 530))).toBe(false);
  });
});

describe("collideWithPack", () => {
  it("removes a hit item and leaves the rest", () => {
    const hit = item(1, "obstacle", 2, 530);
    const ahead = item(2, "obstacle", 2, 100);
    expect(collideWithPack(rules, still, 0, [hit, ahead])).toEqual({
      hits: [hit],
      invulnerableSeconds: 1,
      remaining: [ahead],
    });
  });

  it("hits pickups in both lanes mid-move without opening the window", () => {
    const tips = [item(1, "tip", 2, 530), item(2, "tip", 3, 530)];
    expect(collideWithPack(rules, midMove, 0, tips)).toEqual({
      hits: tips,
      invulnerableSeconds: 0,
      remaining: [],
    });
  });

  it("hits an obstacle in the lane being left mid-move", () => {
    const behind = item(1, "obstacle", 2, 530);
    expect(collideWithPack(rules, midMove, 0, [behind]).hits).toEqual([behind]);
  });

  it("hits only the lower of two obstacles touching at once, and the other passes", () => {
    const upper = item(1, "obstacle", 3, 500);
    const lower = item(2, "obstacle", 2, 530);
    expect(collideWithPack(rules, midMove, 0, [upper, lower])).toEqual({
      hits: [lower],
      invulnerableSeconds: 1,
      remaining: [upper],
    });
  });

  it("ignores obstacles during the window and keeps them on the road", () => {
    const obstacle = item(1, "obstacle", 2, 530);
    expect(collideWithPack(rules, still, 0.4, [obstacle])).toEqual({
      hits: [],
      invulnerableSeconds: 0.4,
      remaining: [obstacle],
    });
  });

  it("still collects pickups during the window", () => {
    const tip = item(1, "tip", 2, 530);
    expect(collideWithPack(rules, still, 0.4, [tip]).hits).toEqual([tip]);
  });

  it("hits an obstacle again once the window has run out", () => {
    const obstacle = item(1, "obstacle", 2, 530);
    const first = collideWithPack(rules, still, 0, [item(9, "obstacle", 2, 530)]);
    const during = tickInvulnerability(0.9, first.invulnerableSeconds);
    expect(collideWithPack(rules, still, during, [obstacle]).hits).toEqual([]);
    const after = tickInvulnerability(0.1, during);
    expect(collideWithPack(rules, still, after, [obstacle]).hits).toEqual([obstacle]);
  });

  it("hits every touching obstacle when the window is zero", () => {
    const noWindow = { ...rules, invulnerabilitySeconds: 0 };
    const obstacles = [item(1, "obstacle", 2, 530), item(2, "obstacle", 3, 530)];
    expect(collideWithPack(noWindow, midMove, 0, obstacles).hits).toHaveLength(2);
  });
});

describe("tickInvulnerability", () => {
  it("counts the window down to zero and no further", () => {
    expect(tickInvulnerability(0.25, 1)).toBeCloseTo(0.75);
    expect(tickInvulnerability(2, 1)).toBe(0);
  });
});
