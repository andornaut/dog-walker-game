import { describe, expect, it } from "vitest";

import { encounterSpriteKey, minorObstacleSpriteKey, SKUNK_CLOUD_KEY } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import type { GameData, Skin, ZoneId } from "../data/types";
import {
  baseCardArtPrefix,
  encounterLook,
  type Look,
  minorObstacleLook,
  skinnedArt,
  skinnedCardArt,
  skinnedCloudArt,
  skinnedOwnerArt,
} from "./skins";

const [skinnedZone, plainZone] = gameData.world.zones.map(({ id }) => id as ZoneId);
if (skinnedZone === undefined || plainZone === undefined) {
  throw new Error("The skin tests need two zones");
}
const { squirrel, thief } = ENCOUNTERS;
const { barrier2, cone } = MINOR_OBSTACLES;
const CAT: Skin = {
  art: "cat-on-a-lawn",
  cardArtPrefix: "card-cat-on-a-lawn",
  hitLabel: "MEOW!",
  movement: { kind: "dart", tilt: 0.1 },
  name: "Cat on a lawn",
};
// A skin that names only what it must, so the rest falls back to the base.
const RACCOON: Skin = { art: "raccoon", name: "Raccoon" };
const GNOME: Skin = { art: "garden-gnome", hitLabel: "CLONK!", name: "Garden gnome" };

// The real data with a skin on two encounters and one minor obstacle, in one zone only.
const data: Pick<GameData, "encounters" | "minorObstacles"> = {
  encounters: {
    ...gameData.encounters,
    squirrel: { ...squirrel, skins: { [skinnedZone]: CAT } },
    thief: { ...thief, skins: { [skinnedZone]: RACCOON } },
  },
  minorObstacles: {
    ...gameData.minorObstacles,
    cone: { ...cone, skins: { [skinnedZone]: GNOME } },
  },
};

const base = (
  art: string,
  prefix: string,
  hitLabel: string | null,
  name: string,
  movement: Look["movement"] = null,
): Look => ({
  art,
  baseArt: art,
  baseCardArtPrefix: prefix,
  cardArtPrefix: prefix,
  cloudArt: null,
  hitLabel,
  movement,
  name,
  statusArt: null,
});
const squirrelBase = base(
  encounterSpriteKey("squirrel"),
  baseCardArtPrefix("squirrel"),
  squirrel.hitLabel,
  squirrel.name,
  squirrel.movement,
);

describe("encounterLook and minorObstacleLook", () => {
  it.each<[string, () => Look, Look]>([
    [
      "the squirrel in its skinned zone wears the whole skin",
      () => encounterLook(data, skinnedZone, "squirrel"),
      { ...squirrelBase, ...CAT },
    ],
    [
      "the squirrel in another zone keeps its base look",
      () => encounterLook(data, plainZone, "squirrel"),
      squirrelBase,
    ],
    [
      "a skin without a hit label or card prefix keeps the base's, and without a movement stands still",
      () => encounterLook(data, skinnedZone, "thief"),
      {
        ...base(
          encounterSpriteKey("thief"),
          baseCardArtPrefix("thief"),
          thief.hitLabel,
          thief.name,
        ),
        ...RACCOON,
        movement: null,
      },
    ],
    [
      "a skinned minor obstacle takes the skin's hit label",
      () => minorObstacleLook(data, skinnedZone, "cone"),
      { ...base(minorObstacleSpriteKey("cone"), "", null, cone.name), ...GNOME },
    ],
    [
      "a minor obstacle with no hit label anywhere has none",
      () => minorObstacleLook(data, skinnedZone, "barrier2"),
      base(minorObstacleSpriteKey("barrier2"), "", null, barrier2.name),
    ],
  ])("%s", (_, look, expected) => {
    expect(look()).toEqual(expected);
  });
});

describe("the skinned art keys", () => {
  const cat = encounterLook(data, skinnedZone, "squirrel");
  const plain = encounterLook(data, plainZone, "squirrel");
  const [hold] = squirrel.resolution.options;
  const holdSuffix = hold.art.slice(baseCardArtPrefix("squirrel").length);
  const all = () => true;
  const none = () => false;

  it.each<[string, () => string, string]>([
    ["draws the skin's art once the manifest has it", () => skinnedArt(all, cat), CAT.art],
    ["draws the base art while the skin's is missing", () => skinnedArt(none, cat), cat.baseArt],
    [
      "puts the skin's prefix on an option's illustration once the manifest has it",
      () => skinnedCardArt(all, cat, hold.art),
      `${CAT.cardArtPrefix ?? ""}${holdSuffix}`,
    ],
    [
      "keeps the option's own illustration while the skin's is missing",
      () => skinnedCardArt(none, cat, hold.art),
      hold.art,
    ],
    [
      "keeps the option's own illustration with no skin",
      () => skinnedCardArt(all, plain, hold.art),
      hold.art,
    ],
    [
      "stands the skin's own owner beside it once the manifest has it",
      () => skinnedOwnerArt(all, cat),
      `${CAT.art}-owner`,
    ],
    [
      "stands a skin with its own cloud in it once the manifest has it",
      () => skinnedCloudArt(all, { ...cat, cloudArt: "stink-fish-crate-cloud" }),
      "stink-fish-crate-cloud",
    ],
    [
      "stands a skin in skunk-cloud while its cloud is missing or it names none",
      () => [skinnedCloudArt(none, { ...cat, cloudArt: "x" }), skinnedCloudArt(all, cat)].join(),
      [SKUNK_CLOUD_KEY, SKUNK_CLOUD_KEY].join(),
    ],
    [
      "stands the base's owner beside a skin whose owner is missing",
      () => skinnedOwnerArt((key) => key === CAT.art, cat),
      `${cat.baseArt}-owner`,
    ],
  ])("%s", (_, key, expected) => {
    expect(key()).toBe(expected);
  });
});
