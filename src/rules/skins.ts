import {
  artOrStandIn,
  encounterSpriteKey,
  kebabCase,
  minorObstacleSpriteKey,
  SKUNK_CLOUD_KEY,
} from "../assets/spriteKeys";
import type { EncounterId, GameData, MinorObstacleId, Skins, ZoneId } from "../data/types";

// Whether the art manifest has a key, so a skin's art can fall back while it is missing.
export type HasArt = (key: string) => boolean;

// What an obstacle looks like in a zone: its name, road sprite key and hit label (null when
// neither the skin nor its base has one), the prefix of its card illustrations, and a skin's
// own spray cloud (null for the base's). art, cardArtPrefix and cloudArt are the skin's even
// while its art is missing: the skinned* functions pick the keys to draw.
export interface Look {
  readonly art: string;
  readonly baseArt: string;
  readonly baseCardArtPrefix: string;
  readonly cardArtPrefix: string;
  readonly cloudArt: string | null;
  readonly hitLabel: string | null;
  readonly name: string;
}

interface BaseLook {
  readonly art: string;
  readonly cardArtPrefix: string;
  readonly hitLabel: string | null;
  readonly name: string;
  readonly skins: Skins | undefined;
}

// The prefix every card option illustration of an encounter starts with, before "-<option>".
export function baseCardArtPrefix(encounter: EncounterId): string {
  return `card-${kebabCase(encounter)}`;
}

// The skin for the zone, each part falling back to the base.
function skinFor(zone: ZoneId, base: BaseLook): Look {
  const skin = base.skins?.[zone];
  return {
    art: skin?.art ?? base.art,
    baseArt: base.art,
    baseCardArtPrefix: base.cardArtPrefix,
    cardArtPrefix: skin?.cardArtPrefix ?? base.cardArtPrefix,
    cloudArt: skin?.cloudArt ?? null,
    hitLabel: skin?.hitLabel ?? base.hitLabel,
    name: skin?.name ?? base.name,
  };
}

// An encounter's look in a zone. Rules never read it: they key on the encounter's id.
export function encounterLook(
  data: Pick<GameData, "encounters">,
  zone: ZoneId,
  encounter: EncounterId,
): Look {
  const entry = data.encounters[encounter];
  return skinFor(zone, {
    art: encounterSpriteKey(encounter),
    cardArtPrefix: baseCardArtPrefix(encounter),
    hitLabel: "hitLabel" in entry ? (entry.hitLabel ?? null) : null,
    name: entry.name,
    skins: entry.skins,
  });
}

// A minor obstacle's look in a zone. It has no card, so no card art.
export function minorObstacleLook(
  data: Pick<GameData, "minorObstacles">,
  zone: ZoneId,
  obstacle: MinorObstacleId,
): Look {
  const entry = data.minorObstacles[obstacle];
  return skinFor(zone, {
    art: minorObstacleSpriteKey(obstacle),
    cardArtPrefix: "",
    hitLabel: entry.hitLabel ?? null,
    name: entry.name,
    skins: entry.skins,
  });
}

// The road sprite key to draw: the skin's art, or the base art while the skin's is missing, or
// the base art's stand-in while that is missing too.
export function skinnedArt(has: HasArt, look: Look): string {
  return has(look.art) ? look.art : artOrStandIn(has, look.baseArt);
}

// The figure standing beside the drawn road sprite, such as the other dog's owner: the drawn
// art's <art>-owner, or the base art's while the skin's owner is missing.
export function skinnedOwnerArt(has: HasArt, look: Look): string {
  const owner = `${skinnedArt(has, look)}-owner`;
  return has(owner) ? owner : `${look.baseArt}-owner`;
}

// The spray cloud a Stink look stands in: the skin's own, or skunk-cloud while it names none
// or its art is missing.
export function skinnedCloudArt(has: HasArt, look: Look): string {
  return look.cloudArt !== null && has(look.cloudArt) ? look.cloudArt : SKUNK_CLOUD_KEY;
}

// A card option's illustration under the look: the option's key with the skin's prefix in
// place of the base prefix, or the option's own key while that illustration is missing.
export function skinnedCardArt(has: HasArt, look: Look, optionArt: string): string {
  if (
    look.cardArtPrefix === look.baseCardArtPrefix ||
    !optionArt.startsWith(`${look.baseCardArtPrefix}-`)
  ) {
    return optionArt;
  }
  const skinned = look.cardArtPrefix + optionArt.slice(look.baseCardArtPrefix.length);
  return has(skinned) ? skinned : optionArt;
}
