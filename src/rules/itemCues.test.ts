import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, MinorObstacleId, NeedSpotId } from "../data/types";
import { bobOffset, FORCED_STOP_CUE, itemCue } from "./itemCues";

const encounterRows = (Object.keys(gameData.encounters) as EncounterId[]).map((id) => {
  const instant = gameData.encounters[id].resolution.kind === "instant";
  return { bob: instant, id, mark: !instant };
});

describe("itemCue", () => {
  it.each(encounterRows)("encounter $id: bob $bob, mark $mark", ({ bob, id, mark }) => {
    expect(itemCue(gameData, id)).toEqual({ bob, mark });
  });

  it.each(Object.keys(gameData.minorObstacles) as MinorObstacleId[])(
    "minor obstacle %s has no mark and no bob",
    (id) => {
      expect(itemCue(gameData, id)).toEqual({ bob: false, mark: false });
    },
  );

  it.each(Object.keys(gameData.needSpots) as NeedSpotId[])(
    "need spot %s never bobs and marks only when its payoff card is certain",
    (id) => {
      expect(itemCue(gameData, id)).toEqual({
        bob: false,
        mark: gameData.tuning.probability.needPayoffCard >= 1,
      });
    },
  );

  it.each([
    { bob: false, kind: "ball" },
    { bob: false, kind: "cyclist" },
    { bob: true, kind: "tip" },
    { bob: true, kind: "treat" },
  ] as const)("$kind bobs: $bob, and has no mark", ({ bob, kind }) => {
    expect(itemCue(gameData, kind)).toEqual({ bob, mark: false });
  });

  it("marks a forced stop", () => {
    expect(FORCED_STOP_CUE).toEqual({ bob: false, mark: true });
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
