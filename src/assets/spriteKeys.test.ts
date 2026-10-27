import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { SHOP_GEAR } from "../data/shop";
import type { GearId, MinorObstacleId } from "../data/types";
import { WORLD } from "../data/world";
import { animationKey, animationSpecs } from "./asepriteAnimations";
import {
  backdropKey,
  CARD_FRAME_KEY,
  depthVariantKey,
  gearIconKey,
  minorObstacleSpriteKey,
  moverBodyTag,
  prizeMoverTag,
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
    expect(depthVariantKey("dog-kilo", 0.875)).toBe("dog-kilo@88");
    expect(depthVariantKey("dog-kilo", 0.625)).toBe("dog-kilo@62");
    expect(depthVariantKey("tip", 1)).toBeNull();
    expect(() => depthVariantKey("tip", 0.63)).toThrow("not a depth step");
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

  // A moving prize plays its movement's tag while it moves, where its art has one, and otherwise
  // what it plays standing: waving or walking in place while the walk goes on, idle while held.
  it.each([
    { halted: false, moving: true, tags: ["idle", "wave", "walk"], want: "walk" },
    { halted: false, moving: true, tags: ["idle", "wave"], want: "wave" },
    { halted: false, moving: false, tags: ["idle", "wave"], want: "wave" },
    { halted: true, moving: false, tags: ["idle", "wave", "walk"], want: "idle" },
  ] as const)(
    "plays a stepping prize's $want, moving $moving, halted $halted",
    ({ halted, moving, tags, want }) => {
      const has = (tag: string) => (tags as readonly string[]).includes(tag);
      expect(prizeMoverTag(has, "step", moving, halted)).toBe(want);
    },
  );

  // A mover's cue stands on the road; faces, effects, badges and UI do not.
  it("stands road art on the ground, and nothing drawn over the road", () => {
    const standing = ["dog-kilo", "tip", "ambient-cat", "dog-kilo@50", WARNING_KEY];
    const flat = ["face-dog-kilo", "fx-bump", "badge-squirrel", "ui-button", "card-frame"];
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
          minorObstacleSpriteKey(id),
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
