import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, ForcedStopId, GearId, MinorObstacleId } from "../data/types";
import { WORLD } from "../data/world";
import { animationKey, animationSpecs } from "./asepriteAnimations";
import {
  backdropKey,
  CARD_FRAME_KEY,
  cardFrameTag,
  depthVariantKey,
  dogFaceKey,
  doghouseTag,
  dogSpriteKey,
  encounterSpriteKey,
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
  zoneArtName,
  zoneIconKey,
} from "./spriteKeys";

const spriteKeys = new Set(manifest.sprites.map(({ key }) => key));
const data = { dogs: DOGS, encounters: ENCOUNTERS };

describe("kebabCase", () => {
  it("splits camelCase words with hyphens", () => {
    expect(kebabCase("biscuitNeighbour")).toBe("biscuit-neighbour");
    expect(kebabCase("koda")).toBe("koda");
  });
});

describe("depthVariantKey", () => {
  it("names the @75 and @50 versions, and none at full size", () => {
    expect(depthVariantKey("dog-koda", 0.75)).toBe("dog-koda@75");
    expect(depthVariantKey("tip", 0.5)).toBe("tip@50");
    expect(depthVariantKey("tip", 1)).toBeNull();
  });

  it("names variants the manifest has, each with its own anchor", () => {
    const anchored = new Set(
      manifest.sprites.filter((entry) => "anchor" in entry).map(({ key }) => key),
    );
    for (const key of ["dog-koda", "tip", "skunk"]) {
      for (const step of [0.75, 0.5]) {
        expect(anchored.has(depthVariantKey(key, step) ?? ""), `${key} ${step}`).toBe(true);
      }
    }
  });
});

describe("standsOnGround", () => {
  it("measures road and backdrop sprites, not faces, effects, badges or UI", () => {
    for (const key of ["dog-koda", "tip", "walker-ada", "gag-cat", "dog-koda@50"]) {
      expect(standsOnGround(key), key).toBe(true);
    }
    for (const key of ["face-dog-koda", "fx-bump", "badge-squirrel", "ui-button", "card-frame"]) {
      expect(standsOnGround(key), key).toBe(false);
    }
  });
});

describe("sprite keys", () => {
  it("name a sprite in the art manifest for every encounter", () => {
    for (const id of Object.keys(ENCOUNTERS) as EncounterId[]) {
      expect(spriteKeys.has(encounterSpriteKey(id)), id).toBe(true);
    }
  });

  it("name an icon image in the art manifest for every gear item", () => {
    const images = new Set(manifest.images.map(({ key }) => key));
    for (const gear of Object.keys(SHOP_GEAR) as GearId[]) {
      expect(images.has(gearIconKey(gear)), gear).toBe(true);
    }
  });

  it("name a sprite in the art manifest for every forced stop", () => {
    for (const stop of Object.keys(FORCED_STOPS) as ForcedStopId[]) {
      expect(spriteKeys.has(forcedStopSpriteKey(stop)), stop).toBe(true);
    }
  });

  it("name the card frame, with a tag for every kind of card", () => {
    expect(spriteKeys.has(CARD_FRAME_KEY)).toBe(true);
    expect(cardFrameTag(data, { affected: [], encounter: "skunk", kind: "encounter" })).toBe(
      "encounter",
    );
    expect(cardFrameTag(data, { affected: [], encounter: "lostWallet", kind: "encounter" })).toBe(
      "lucky",
    );
    expect(cardFrameTag(data, { kind: "forcedStop", stop: "kidWantsToPet" })).toBe("stop");
    expect(
      cardFrameTag(data, {
        kind: "upgradeOffer",
        offered: ["bellyRubs", "bigTipper", "raincoats"],
      }),
    ).toBe("upgrade");
  });

  it("name a road sprite, a face and an owner face in the manifest for every dog", () => {
    for (const dog of Object.keys(DOGS) as DogId[]) {
      for (const key of [dogSpriteKey(data, dog), dogFaceKey(data, dog), ownerFaceKey(data, dog)]) {
        expect(spriteKeys.has(key), key).toBe(true);
      }
    }
  });

  it("name a sprite in the manifest for every minor obstacle and the skunk's cloud", () => {
    for (const id of Object.keys(MINOR_OBSTACLES) as MinorObstacleId[]) {
      expect(spriteKeys.has(minorObstacleSpriteKey(id)), id).toBe(true);
    }
    expect(minorObstacleSpriteKey("barrier3")).toBe("barrier-3");
    expect(minorObstacleSpriteKey("parkedCar")).toBe("parked-car");
    expect(spriteKeys.has(SKUNK_CLOUD_KEY)).toBe(true);
  });

  it("name a sprite with its moving tag for every mover, and the cue's sign and arrow", () => {
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

  it("name a doghouse tag for every dog, and the empty house", () => {
    const sheet = manifest.sprites.find(({ key }) => key === "ui-doghouse");
    expect(sheet).toBeDefined();
    expect(doghouseTag(data, "koda")).toBe("koda");
    expect(doghouseTag(data, null)).toBe("empty");
  });

  it("name a dog's art by its art id, not its data id", () => {
    const renamed = { dogs: { ...DOGS, koda: { ...DOGS.koda, art: "kodiak" } } };
    expect(dogSpriteKey(renamed, "koda")).toBe("dog-kodiak");
    expect(dogFaceKey(renamed, "koda")).toBe("face-dog-kodiak");
    expect(ownerFaceKey(renamed, "koda")).toBe("face-owner-kodiak");
    expect(doghouseTag(renamed, "koda")).toBe("kodiak");
  });
});

describe("zone art keys", () => {
  const images = new Set(manifest.images.map(({ key }) => key));

  it("names each zone's art after its name", () => {
    expect(zoneArtName({ name: "The Long Way Home" })).toBe("the-long-way-home");
    expect(backdropKey({ name: "Woof Way" })).toBe("backdrop-woof-way");
  });

  it("names a backdrop, a road strip and an icon in the manifest for every zone", () => {
    for (const zone of WORLD.zones) {
      for (const key of [backdropKey(zone), roadTileKey(zone), zoneIconKey(zone)]) {
        expect(images.has(key), key).toBe(true);
      }
    }
  });

  it("names a start strip for every zone after the first", () => {
    for (const zone of WORLD.zones.slice(1)) {
      expect(images.has(roadStartKey(zone)), zone.name).toBe(true);
    }
  });
});
