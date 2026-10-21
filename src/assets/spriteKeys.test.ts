import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { SHOP_GEAR } from "../data/shop";
import type { GearId, MinorObstacleId } from "../data/types";
import { WORLD } from "../data/world";
import { animationKey, animationSpecs } from "./asepriteAnimations";
import {
  ART_STAND_INS,
  artOrStandIn,
  backdropKey,
  CARD_FRAME_KEY,
  depthVariantKey,
  gearIconKey,
  minorObstacleSpriteKey,
  moverBodyTag,
  roadStartKey,
  roadTileKey,
  SKUNK_CLOUD_KEY,
  standsOnGround,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
  WARNING_UP_TAG,
  WARNING_WANDER_KEY,
  zoneIconKey,
} from "./spriteKeys";

const spriteKeys = new Set(manifest.sprites.map(({ key }) => key));
const images = new Set(manifest.images.map(({ key }) => key));

describe("key names", () => {
  it("names a depth variant by its step's rounded percentage, and throws off the steps", () => {
    expect(depthVariantKey("dog-koda", 0.875)).toBe("dog-koda@88");
    expect(depthVariantKey("dog-koda", 0.625)).toBe("dog-koda@62");
    expect(depthVariantKey("tip", 1)).toBeNull();
    expect(() => depthVariantKey("tip", 0.63)).toThrow("not a depth step");
  });

  it("draws a stand-in only while its own art is missing and the stand-in is loaded", () => {
    const [art, standIn] = Object.entries(ART_STAND_INS).find(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ) ?? ["", ""];
    const drawn = (loaded: string[]) => artOrStandIn((key) => loaded.includes(key), art);
    expect([drawn([art, standIn]), drawn([standIn]), drawn([])]).toEqual([art, standIn, art]);
  });

  // A mover plays its movement's tag while it moves and its idle between moves; a stalker drawn
  // with a lunge (step) lunges on each step and stalks (walk) between them, and one drawn
  // without steps on walk and stands idle between.
  it("plays a mover's movement tag while it moves and its idle or stalk between", () => {
    const cases = [
      { movement: "approach", moving: true, tags: ["idle", "walk", "step"], want: "step" },
      { movement: "approach", moving: false, tags: ["idle", "walk", "step"], want: "walk" },
      { movement: "approach", moving: true, tags: ["idle", "walk", "flee"], want: "walk" },
      { movement: "approach", moving: false, tags: ["idle", "walk", "flee"], want: "idle" },
      { movement: "hop", moving: true, tags: ["idle", "hop"], want: "hop" },
      { movement: "hop", moving: false, tags: ["idle", "hop"], want: "idle" },
    ] as const;
    const wrong = cases.filter(
      ({ movement, moving, tags, want }) =>
        moverBodyTag((tag) => (tags as readonly string[]).includes(tag), movement, moving) !== want,
    );
    expect(wrong).toEqual([]);
  });

  // A mover's cue stands on the road; faces, effects, badges and UI do not.
  it("stands road art on the ground, and nothing drawn over the road", () => {
    const standing = ["dog-koda", "tip", "gag-cat", "dog-koda@50", WARNING_KEY];
    const flat = ["face-dog-koda", "fx-bump", "badge-squirrel", "ui-button", "card-frame"];
    expect(standing.filter((key) => !standsOnGround(key))).toEqual([]);
    expect(flat.filter(standsOnGround)).toEqual([]);
  });
});

describe("the art manifest", () => {
  it("has the art every gear item, minor obstacle and zone names, and the mover cues' tags", () => {
    const missing = [
      ...(Object.keys(SHOP_GEAR) as GearId[]).map(gearIconKey).filter((key) => !images.has(key)),
      ...[
        ...(Object.keys(MINOR_OBSTACLES) as MinorObstacleId[]).map((id) =>
          artOrStandIn((key) => spriteKeys.has(key), minorObstacleSpriteKey(id)),
        ),
        SKUNK_CLOUD_KEY,
        CARD_FRAME_KEY,
      ].filter((key) => !spriteKeys.has(key)),
      ...WORLD.zones
        .flatMap((zone) => [
          backdropKey(zone),
          roadTileKey(zone),
          zoneIconKey(zone),
          roadStartKey(zone),
        ])
        .filter((key) => !images.has(key)),
    ];
    const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
      eager: true,
      import: "default",
    });
    const cueTags: [string, string][] = [
      [WARNING_KEY, WARNING_TAG],
      [WARNING_ARROW_KEY, WARNING_TAG],
      [WARNING_ARROW_KEY, WARNING_DOWN_TAG],
      [WARNING_ARROW_KEY, WARNING_UP_TAG],
      [WARNING_WANDER_KEY, WARNING_TAG],
    ];
    const untagged = cueTags.filter(
      ([key, tag]) =>
        !animationSpecs(key, sheets[`../../public/art/sprites/${key}.json`])
          .map((spec) => spec.key)
          .includes(animationKey(key, tag)),
    );
    expect({ missing, untagged }).toEqual({ missing: [], untagged: [] });
  });

  it("gives every zone its own art", () => {
    const ids = WORLD.zones.map(({ art }) => art);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
