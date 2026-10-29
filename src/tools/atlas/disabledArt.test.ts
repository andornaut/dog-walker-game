import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { dogFaceKey, gearIconKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { effectIconKey, walkerEffectItems } from "../../hud/effectIcons";
import { greysOnTile } from "../../ui/disabledArt";

// The pictures the home screen's and the shop's tiles draw through tileTextureKey and
// addTileSprite, each of which a disabled tile greys: the build must pack a grey copy of each.
const TILE_PICTURES = [
  ...keysOf(gameData.dogs).map((dog) => dogFaceKey(gameData, dog)),
  ...keysOf(gameData.walkers).map((walker) => gameData.walkers[walker].portraitKey),
  ...keysOf(gameData.walkers).flatMap((walker) =>
    walkerEffectItems(gameData, walker).map(effectIconKey),
  ),
  ...keysOf(gameData.shopGear).map(gearIconKey),
  "icon-dog-slot",
];

describe("greysOnTile", () => {
  it.each(TILE_PICTURES)("bakes a grey copy of %s", (key) => {
    expect(greysOnTile(key)).toBe(true);
  });

  it.each(["icon-lock", "portrait-dog-kilo", "ui-tile", "face-owner-kilo", "badge-yoink"])(
    "leaves %s in colour only",
    (key) => {
      expect(greysOnTile(key)).toBe(false);
    },
  );
});
