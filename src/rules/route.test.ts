import { seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { WORLD } from "../data/world";
import {
  currentZone,
  defaultRoute,
  forkPaths,
  pathSide,
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
      const paths = forkPaths(data, seededRandom(seed), ["distilleryDistrict"]);
      expect(paths).toHaveLength(3);
      expect(paths).not.toContain("distilleryDistrict");
      expect(paths).not.toContain(last);
      expect([...paths].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(paths);
    }
  });

  it("offers only the last zone at the fork before it", () => {
    const route = order.filter((zone) => zone !== last).slice(0, WORLD.walkLength - 1);
    expect(forkPaths(data, seededRandom(1), route)).toEqual([last]);
  });

  it("draws each unwalked zone but the last at some early fork", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, seed) =>
        forkPaths(data, seededRandom(seed), ["distilleryDistrict"]),
      ).flat(),
    );
    expect([...seen].sort()).toEqual(
      unwalkedZones(data, ["distilleryDistrict"])
        .filter((zone) => zone !== last)
        .sort(),
    );
  });
});

describe("the walk's zones", () => {
  it("is the world's walk length, or every zone when there are fewer", () => {
    const zones = WORLD.zones.length;
    expect(walkLength({ world: { ...WORLD, walkLength: zones - 1 } })).toBe(zones - 1);
    expect(walkLength({ world: { ...WORLD, walkLength: zones + 1 } })).toBe(zones);
  });

  it("is the last zone walked between a zone's end and the fork after it", () => {
    expect(zoneAt(data, ["distilleryDistrict", "highPark"], 1).id).toBe("highPark");
    expect(zoneAt(data, ["distilleryDistrict", "highPark"], 2).id).toBe("highPark");
    expect(currentZone(data, { route: ["distilleryDistrict"], zoneIndex: 0 }).id).toBe(
      "distilleryDistrict",
    );
  });

  it("starts a later dev start on the pre-fork route", () => {
    expect(defaultRoute(data, 1)).toEqual(WORLD.preForkRoute.slice(0, 1));
    expect(defaultRoute(data, 3)).toEqual(WORLD.preForkRoute.slice(0, 3));
  });
});

describe("pathSide", () => {
  it("names three paths left, straight and right; two left and right; one straight", () => {
    expect([0, 1, 2].map((index) => pathSide(index, 3))).toEqual(["left", "straight", "right"]);
    expect([0, 1].map((index) => pathSide(index, 2))).toEqual(["left", "right"]);
    expect(pathSide(0, 1)).toBe("straight");
  });
});
