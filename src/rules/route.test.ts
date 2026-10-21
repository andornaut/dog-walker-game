import { describe, expect, it } from "vitest";

import { WORLD } from "../data/world";
import { seededRandom } from "../runner/random";
import {
  currentZone,
  defaultRoute,
  forkPaths,
  pathSide,
  PRE_FORK_ROUTE,
  unwalkedZones,
  walkLength,
  zoneAt,
} from "./route";

const data = { world: WORLD };
const order = WORLD.zones.map(({ id }) => id);

describe("forkPaths", () => {
  const last = WORLD.lastZone;

  it("offers three unwalked zones but the last, easiest on the left", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const paths = forkPaths(data, seededRandom(seed), ["street"]);
      expect(paths).toHaveLength(3);
      expect(paths).not.toContain("street");
      expect(paths).not.toContain(last);
      expect([...paths].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(paths);
    }
  });

  it("offers only the last zone at the fork before it", () => {
    const route = ["street", "park", "shops"] as const;
    expect(forkPaths(data, seededRandom(1), route)).toEqual([last]);
  });

  it("draws each unwalked zone but the last at some early fork", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, seed) =>
        forkPaths(data, seededRandom(seed), ["street"]),
      ).flat(),
    );
    expect([...seen].sort()).toEqual(
      unwalkedZones(data, ["street"])
        .filter((zone) => zone !== last)
        .sort(),
    );
  });
});

describe("the walk's zones", () => {
  it("is the world's walk length, or every zone when there are fewer", () => {
    expect(walkLength(data)).toBe(4);
    expect(walkLength({ world: { ...WORLD, walkLength: 9 } })).toBe(WORLD.zones.length);
  });

  it("is the last zone walked between a zone's end and the fork after it", () => {
    expect(zoneAt(data, ["street", "park"], 1).id).toBe("park");
    expect(zoneAt(data, ["street", "park"], 2).id).toBe("park");
    expect(currentZone(data, { route: ["street"], zoneIndex: 0 }).id).toBe("street");
  });

  it("starts a later dev start on the pre-fork route", () => {
    expect(defaultRoute(1)).toEqual(["street"]);
    expect(defaultRoute(3)).toEqual(PRE_FORK_ROUTE.slice(0, 3));
  });
});

describe("pathSide", () => {
  it("names three paths left, straight and right; two left and right; one straight", () => {
    expect([0, 1, 2].map((index) => pathSide(index, 3))).toEqual(["left", "straight", "right"]);
    expect([0, 1].map((index) => pathSide(index, 2))).toEqual(["left", "right"]);
    expect(pathSide(0, 1)).toBe("straight");
  });
});
