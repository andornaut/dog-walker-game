import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, MinorObstacleId } from "../data/types";
import { bobOffset, itemBobs } from "./itemCues";

describe("itemBobs", () => {
  it("bobs only pickups and lucky finds", () => {
    const encounters = Object.keys(gameData.encounters) as EncounterId[];
    const kinds = [...encounters, ...(Object.keys(gameData.minorObstacles) as MinorObstacleId[])];
    const lucky = encounters.filter((id) => gameData.encounters[id].kind === "lucky");
    expect(kinds.filter((kind) => itemBobs(gameData, kind))).toEqual(lucky);
    expect([itemBobs(gameData, "tip"), itemBobs(gameData, "treat")]).toEqual([true, true]);
  });
});

describe("bobOffset", () => {
  it("moves whole pixels up to 2 px up, repeating every second, and never under reduced motion", () => {
    const offsets = [0, 250, 500, 750, 1999, -250].map((t) => bobOffset(false, t));
    const outside = offsets.filter(
      (offset) => !Number.isInteger(offset) || offset > 0 || offset < -2,
    );
    expect(outside).toEqual([]);
    expect(new Set(offsets).size).toBeGreaterThan(1);
    expect(bobOffset(false, 300)).toBe(bobOffset(false, 1300));
    expect(bobOffset(true, 777)).toBe(0);
  });
});
