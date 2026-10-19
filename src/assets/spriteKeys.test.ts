import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, ForcedStopId, GearId } from "../data/types";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  dogFaceKey,
  dogSpriteKey,
  encounterSpriteKey,
  forcedStopSpriteKey,
  gearIconKey,
  kebabCase,
  ownerFaceKey,
} from "./spriteKeys";

const spriteKeys = new Set(manifest.sprites.map(({ key }) => key));
const data = { encounters: ENCOUNTERS };

describe("kebabCase", () => {
  it("splits camelCase words with hyphens", () => {
    expect(kebabCase("biscuitNeighbour")).toBe("biscuit-neighbour");
    expect(kebabCase("koda")).toBe("koda");
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
      for (const key of [dogSpriteKey(dog), dogFaceKey(dog), ownerFaceKey(dog)]) {
        expect(spriteKeys.has(key), key).toBe(true);
      }
    }
  });
});
