import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { SHOP_GEAR } from "../data/shop";
import type { GearId, MinorObstacleId } from "../data/types";
import { WORLD } from "../data/world";
import type { CardSource } from "../state/runState";
import { animationKey, animationSpecs } from "./asepriteAnimations";
import {
  ART_STAND_INS,
  artOrStandIn,
  backdropKey,
  CARD_FRAME_KEY,
  cardFrameTag,
  cardZoneKey,
  depthVariantKey,
  dogCardTag,
  dogFaceKey,
  dogSpriteKey,
  gearIconKey,
  kebabCase,
  minorObstacleSpriteKey,
  moverBodyTag,
  ownerCardFaceKey,
  ownerFaceKey,
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
  zonePipTag,
} from "./spriteKeys";

const spriteKeys = new Set(manifest.sprites.map(({ key }) => key));
const images = new Set(manifest.images.map(({ key }) => key));
const data = { dogs: DOGS, encounters: ENCOUNTERS };
const renamed = { dogs: { ...DOGS, koda: { ...DOGS.koda, art: "kodiak" } } };
const zone = { art: "woof-way" };

describe("key names", () => {
  it.each<[string, () => string | null, string | null]>([
    ["kebabCase splits camelCase words", () => kebabCase("biscuitNeighbour"), "biscuit-neighbour"],
    ["kebabCase keeps one word", () => kebabCase("koda"), "koda"],
    ["depthVariantKey at 0.875", () => depthVariantKey("dog-koda", 0.875), "dog-koda@88"],
    ["depthVariantKey at 0.75", () => depthVariantKey("dog-koda", 0.75), "dog-koda@75"],
    ["depthVariantKey at 0.625", () => depthVariantKey("dog-koda", 0.625), "dog-koda@62"],
    ["depthVariantKey at 0.5", () => depthVariantKey("tip", 0.5), "tip@50"],
    ["depthVariantKey at full size", () => depthVariantKey("tip", 1), null],
    ["minorObstacleSpriteKey with a digit", () => minorObstacleSpriteKey("barrier3"), "barrier-3"],
    ["minorObstacleSpriteKey", () => minorObstacleSpriteKey("parkedCar"), "parked-car"],
    ["the empty dog card", () => dogCardTag(data, null), "empty"],
    ["a renamed dog's sprite", () => dogSpriteKey(renamed, "koda"), "dog-kodiak"],
    ["a renamed dog's face", () => dogFaceKey(renamed, "koda"), "face-dog-kodiak"],
    ["a renamed dog's owner face", () => ownerFaceKey(renamed, "koda"), "face-owner-kodiak"],
    [
      "a renamed dog's owner's card face",
      () => ownerCardFaceKey(renamed, "koda"),
      "face-owner-kodiak-20",
    ],
    ["a renamed dog's card", () => dogCardTag(renamed, "koda"), "kodiak"],
    ["a zone's backdrop", () => backdropKey(zone), "backdrop-woof-way"],
    ["a zone's road strip", () => roadTileKey(zone), "road-woof-way"],
    ["a zone's start strip", () => roadStartKey(zone), "road-woof-way-start"],
    ["a zone's icon", () => zoneIconKey(zone), "icon-zone-woof-way"],
    ["a zone's card preview", () => cardZoneKey(zone), "card-zone-woof-way"],
    ["a route pip before its fork", () => zonePipTag(null, false), "todo"],
    ["a route pip by its zone", () => zonePipTag({ art: "bark-park" }, false), "bark-park"],
    ["a walked route pip", () => zonePipTag({ art: "bark-park" }, true), "bark-park-done"],
  ])("names %s", (_, key, expected) => {
    expect(key()).toBe(expected);
  });

  it("throws for a scale that is not a depth step", () => {
    expect(() => depthVariantKey("tip", 0.63)).toThrow("not a depth step");
  });

  it.each([
    [{ affected: [], encounter: "skunk", kind: "encounter" }, "encounter"],
    [{ kind: "fork", paths: ["park"], upgrades: ["bellyRubs"] }, "route"],
  ] as const satisfies readonly (readonly [CardSource, string])[])(
    "tags a card frame for %o as %s",
    (source, tag) => {
      expect(cardFrameTag(source)).toBe(tag);
    },
  );
});

describe("artOrStandIn", () => {
  const [art, standIn] = Object.entries(ART_STAND_INS).find(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ) ?? ["", ""];
  it.each<{ loaded: string[]; name: string; want: string }>([
    { loaded: [art, standIn], name: "its own art once loaded", want: art },
    { loaded: [standIn], name: "the stand-in while its own art is missing", want: standIn },
    { loaded: [], name: "its own art while the stand-in is missing too", want: art },
  ])("draws $name", ({ loaded, want }) => {
    expect(artOrStandIn((key) => loaded.includes(key), art)).toBe(want);
  });

  it("draws art with no stand-in as itself", () => {
    expect(artOrStandIn(() => false, "cone")).toBe("cone");
  });
});

// A mover plays its movement's tag while it moves and its idle between moves; a stalker drawn
// with a lunge (step) lunges on each step and stalks (walk) between them, and one drawn without
// steps on walk and stands idle between.
describe("moverBodyTag", () => {
  it.each([
    { movement: "approach", moving: true, tags: ["idle", "walk", "step"], want: "step" },
    { movement: "approach", moving: false, tags: ["idle", "walk", "step"], want: "walk" },
    { movement: "approach", moving: true, tags: ["idle", "walk", "flee"], want: "walk" },
    { movement: "approach", moving: false, tags: ["idle", "walk", "flee"], want: "idle" },
    { movement: "hop", moving: true, tags: ["idle", "hop"], want: "hop" },
    { movement: "hop", moving: false, tags: ["idle", "hop"], want: "idle" },
  ] as const)(
    "plays $want for a $movement mover drawn with $tags, moving $moving",
    ({ movement, moving, tags, want }) => {
      const has = (tag: string) => (tags as readonly string[]).includes(tag);
      expect(moverBodyTag(has, movement, moving)).toBe(want);
    },
  );
});

describe("standsOnGround", () => {
  // A mover's cue stands on the road; faces, effects, badges and UI do not.
  it.each([
    ["dog-koda", true],
    ["tip", true],
    ["walker-ada", true],
    ["gag-cat", true],
    ["dog-koda@50", true],
    [WARNING_KEY, true],
    [WARNING_ARROW_KEY, true],
    ["face-dog-koda", false],
    ["fx-bump", false],
    ["badge-squirrel", false],
    ["ui-button", false],
    ["card-frame", false],
  ])("%s is %s", (key, expected) => {
    expect(standsOnGround(key)).toBe(expected);
  });
});

describe("the art manifest", () => {
  it("has a variant with its own anchor for each sampled sprite at 0.75 and 0.5", () => {
    const anchored = new Set(
      manifest.sprites.filter((entry) => "anchor" in entry).map(({ key }) => key),
    );
    for (const key of ["dog-koda", "tip", "skunk"]) {
      for (const step of [0.75, 0.5]) {
        expect(anchored.has(depthVariantKey(key, step) ?? ""), `${key} ${step}`).toBe(true);
      }
    }
  });

  it.each<{ keys: () => string[]; name: string; set: Set<string> }>([
    {
      keys: () => (Object.keys(SHOP_GEAR) as GearId[]).map(gearIconKey),
      name: "an icon image for every gear item",
      set: images,
    },
    {
      keys: () => [
        ...(Object.keys(MINOR_OBSTACLES) as MinorObstacleId[]).map((id) =>
          artOrStandIn((key) => spriteKeys.has(key), minorObstacleSpriteKey(id)),
        ),
        SKUNK_CLOUD_KEY,
        CARD_FRAME_KEY,
      ],
      name: "a sprite, or its stand-in, for every minor obstacle, the skunk's cloud and the card frame",
      set: spriteKeys,
    },
    {
      keys: () => WORLD.zones.flatMap((z) => [backdropKey(z), roadTileKey(z), zoneIconKey(z)]),
      name: "a backdrop, a road strip and an icon for every zone",
      set: images,
    },
    {
      keys: () => WORLD.zones.map(roadStartKey),
      name: "a start strip for every zone, since any zone can follow a fork",
      set: images,
    },
  ])("has $name", ({ keys, set }) => {
    expect(keys().filter((key) => !set.has(key))).toEqual([]);
  });

  it.each([
    [WARNING_KEY, WARNING_TAG],
    [WARNING_ARROW_KEY, WARNING_TAG],
    [WARNING_ARROW_KEY, WARNING_DOWN_TAG],
    [WARNING_ARROW_KEY, WARNING_UP_TAG],
    [WARNING_WANDER_KEY, WARNING_TAG],
  ])("tags the mover cue %s with %s", (key, tag) => {
    const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
      eager: true,
      import: "default",
    });
    const specs = animationSpecs(key, sheets[`../../public/art/sprites/${key}.json`]);
    expect(specs.map((spec) => spec.key)).toContain(animationKey(key, tag));
  });

  it("gives every zone its own art", () => {
    const ids = WORLD.zones.map(({ art }) => art);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
