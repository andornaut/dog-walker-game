import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { EncounterId, MinorObstacleId } from "../data/types";
import type { Rect } from "../lib/rect";
import {
  BUMP_FLASH,
  bumpBorder,
  bumpFlash,
  type BumpSource,
  FLASH_COLOURS,
  MINOR_FLASH_COLOURS,
} from "./bumpFlash";

const MINOR_OBSTACLES = Object.keys(gameData.minorObstacles) as MinorObstacleId[];
// Every encounter a pack bumps into: an obstacle that opens a card or applies on contact, not a
// pull obstacle such as the squirrel.
const BUMPED_ENCOUNTERS = (Object.keys(gameData.encounters) as EncounterId[]).filter((id) => {
  const encounter = gameData.encounters[id];
  return encounter.kind === "obstacle" && encounter.resolution.kind !== "pull";
});
const SOURCES: readonly BumpSource[] = [
  ...MINOR_OBSTACLES.map((obstacle): BumpSource => ({ kind: "minor", obstacle })),
  ...BUMPED_ENCOUNTERS.map((encounter): BumpSource => ({ encounter, kind: "encounter" })),
];
const SCREEN: Rect = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };

describe("bump flash colours", () => {
  it.each(MINOR_OBSTACLES)("gives the minor obstacle %s a border colour", (obstacle) => {
    expect(MINOR_FLASH_COLOURS[obstacle]).toBeDefined();
  });

  it.each(BUMPED_ENCOUNTERS)("gives the bumped encounter %s a flash colour", (encounter) => {
    expect(FLASH_COLOURS[encounter]).toBeDefined();
  });
});

describe("bump flash with and without reduced motion", () => {
  it.each(SOURCES.map((source) => [JSON.stringify(source), source] as const))(
    "%s nudges the road only in motion, and flashes the same colour either way",
    (_, source) => {
      const moving = bumpFlash(false, source);
      const still = bumpFlash(true, source);
      expect([moving.nudge, still.nudge]).toEqual([true, false]);
      expect(still.colour).toBe(moving.colour);
    },
  );
});

describe("bump border", () => {
  const { band, keyline } = bumpBorder(SCREEN);
  const thin = (rect: Rect) => Math.min(rect.width, rect.height);
  // How far the rect is from the screen edge nearest it.
  const gap = (rect: Rect) =>
    Math.min(
      rect.x - SCREEN.x,
      rect.y - SCREEN.y,
      SCREEN.x + SCREEN.width - rect.x - rect.width,
      SCREEN.y + SCREEN.height - rect.y - rect.height,
    );

  it.each([
    ["colour band", band, BUMP_FLASH.width, 0],
    ["ink keyline", keyline, BUMP_FLASH.keyline, BUMP_FLASH.width],
  ] as const)("draws its %s at its width, that far in from each edge", (_, rects, width, inset) => {
    expect(rects.map(thin)).toEqual([width, width, width, width]);
    expect(rects.map(gap)).toEqual([inset, inset, inset, inset]);
  });

  it("runs its colour band along the whole of each screen edge", () => {
    const long = band.map((rect) => Math.max(rect.width, rect.height));
    expect(long).toEqual([SCREEN.width, SCREEN.width, SCREEN.height, SCREEN.height]);
  });
});
