import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { NEED_CARDS } from "../data/needs";
import { SHOP_GEAR } from "../data/shop";
import type { ForcedStopId, GearId, MinorObstacleId } from "../data/types";
import { WORLD } from "../data/world";
import type { CardSource } from "../state/runState";
import { animationKey, animationSpecs } from "./asepriteAnimations";
import {
  backdropKey,
  CARD_FRAME_KEY,
  cardFrameTag,
  cardZoneKey,
  depthVariantKey,
  dogFaceKey,
  doghouseTag,
  dogSpriteKey,
  forcedStopSpriteKey,
  gearIconKey,
  kebabCase,
  minorObstacleSpriteKey,
  MOVER_SPRITES,
  ownerFaceKey,
  roadStartKey,
  roadTileKey,
  SKUNK_CLOUD_KEY,
  standsOnGround,
  WARNING_ARROW_KEY,
  WARNING_DOWN_TAG,
  WARNING_KEY,
  WARNING_TAG,
  zoneIconKey,
  zonePipTag,
} from "./spriteKeys";

const spriteKeys = new Set(manifest.sprites.map(({ key }) => key));
const images = new Set(manifest.images.map(({ key }) => key));
const data = { dogs: DOGS, encounters: ENCOUNTERS, needCards: NEED_CARDS };
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
    ["the empty doghouse", () => doghouseTag(data, null), "empty"],
    ["a renamed dog's sprite", () => dogSpriteKey(renamed, "koda"), "dog-kodiak"],
    ["a renamed dog's face", () => dogFaceKey(renamed, "koda"), "face-dog-kodiak"],
    ["a renamed dog's owner face", () => ownerFaceKey(renamed, "koda"), "face-owner-kodiak"],
    ["a renamed dog's doghouse", () => doghouseTag(renamed, "koda"), "kodiak"],
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
    [{ affected: [], encounter: "lostWallet", kind: "encounter" }, "lucky"],
    [{ kind: "forcedStop", stop: "kidWantsToPet" }, "stop"],
    [{ kind: "upgradeOffer", offered: ["bellyRubs", "bigTipper", "raincoats"] }, "upgrade"],
    [{ kind: "fork", paths: ["park"] }, "route"],
  ] as const satisfies readonly (readonly [CardSource, string])[])(
    "tags a card frame for %o as %s",
    (source, tag) => {
      expect(cardFrameTag(data, source)).toBe(tag);
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
      keys: () => (Object.keys(FORCED_STOPS) as ForcedStopId[]).map(forcedStopSpriteKey),
      name: "a sprite for every forced stop",
      set: spriteKeys,
    },
    {
      keys: () => [
        ...(Object.keys(MINOR_OBSTACLES) as MinorObstacleId[]).map(minorObstacleSpriteKey),
        SKUNK_CLOUD_KEY,
        CARD_FRAME_KEY,
      ],
      name: "a sprite for every minor obstacle, the skunk's cloud and the card frame",
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

  it("tags every mover's sprite with its moving tag, and the cue's sign and arrow", () => {
    const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
      eager: true,
      import: "default",
    });
    const hasTag = (key: string, tag: string) =>
      animationSpecs(key, sheets[`../../public/art/sprites/${key}.json`]).some(
        (spec) => spec.key === animationKey(key, tag),
      );
    for (const { key, tag } of Object.values(MOVER_SPRITES)) {
      expect(hasTag(key, tag), key).toBe(true);
    }
    expect(hasTag(WARNING_KEY, WARNING_TAG)).toBe(true);
    expect(hasTag(WARNING_ARROW_KEY, WARNING_TAG)).toBe(true);
    expect(hasTag(WARNING_ARROW_KEY, WARNING_DOWN_TAG)).toBe(true);
  });

  it("gives every zone its own art", () => {
    const ids = WORLD.zones.map(({ art }) => art);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
