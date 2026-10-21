import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, MinorObstacleId } from "../data/types";
import { bobOffset, itemBobs } from "./itemCues";

describe("itemBobs", () => {
  it.each(Object.keys(gameData.encounters) as EncounterId[])("encounter %s bobs if lucky", (id) => {
    expect(itemBobs(gameData, id)).toBe(gameData.encounters[id].kind === "lucky");
  });

  it.each(Object.keys(gameData.minorObstacles) as MinorObstacleId[])(
    "minor obstacle %s does not bob",
    (id) => {
      expect(itemBobs(gameData, id)).toBe(false);
    },
  );

  it.each(["tip", "treat"] as const)("%s bobs", (kind) => {
    expect(itemBobs(gameData, kind)).toBe(true);
  });
});

describe("bobOffset", () => {
  it.each([0, 250, 500, 750, 1000, 1250, 1999, -250])(
    "is whole pixels, up to 2 px up, at %i ms",
    (t) => {
      const offset = bobOffset(false, t);
      expect(Number.isInteger(offset)).toBe(true);
      expect(offset).toBeLessThanOrEqual(0);
      expect(offset).toBeGreaterThanOrEqual(-2);
    },
  );

  it("repeats every second and moves", () => {
    expect(bobOffset(false, 300)).toBe(bobOffset(false, 1300));
    expect(new Set([0, 250, 500, 750].map((t) => bobOffset(false, t))).size).toBeGreaterThan(1);
  });

  it.each([0, 500, 777])("is zero under reduced motion at %i ms", (t) => {
    expect(bobOffset(true, t)).toBe(0);
  });
});
