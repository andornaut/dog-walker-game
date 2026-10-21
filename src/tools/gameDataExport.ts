import { SKIP_CARD_ART } from "../assets/cardArt";
import {
  backdropKey,
  cardFrameTag,
  cardZoneKey,
  dogFaceKey,
  doghouseTag,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  gearIconKey,
  kebabCase,
  minorObstacleSpriteKey,
  ownerFaceKey,
  roadStartKey,
  roadTileKey,
  zoneIconKey,
} from "../assets/spriteKeys";
import type {
  CardOption,
  DogId,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  UpgradeId,
  WalkerId,
} from "../data/types";
import { maxHearts, startHearts } from "../rules/dogs";
import { effectText } from "../rules/effectText";
import { faceMood } from "../rules/treats";
import type { CardSource } from "../state/runState";

// The game data art's tools read, as shared/export/game-data.json. Every entry spreads its
// data module's fields as they are, so a field added to the data shows up here unchanged,
// then adds what the game derives from it: art keys, card text and per-dog figures.

function entries<Id extends string, T>(record: Readonly<Record<Id, T>>): [Id, T][] {
  return Object.entries(record) as [Id, T][];
}

// An option's id is its art key less the card's prefix: card-lost-wallet-keep is "keep".
function optionId(sourceId: string, art: string): string | null {
  const prefix = `card-${kebabCase(sourceId)}-`;
  return art.startsWith(prefix) ? art.slice(prefix.length) : null;
}

export interface CardFace {
  readonly art: string;
  readonly frame: string;
  readonly id: string | null;
  readonly index: number | null;
  readonly name: string;
  readonly source: { readonly id: string | null; readonly kind: string };
  readonly text: string;
  readonly title: string;
}

function optionFaces(
  data: GameData,
  frame: string,
  options: readonly CardOption[],
  source: { id: string; kind: string },
  title: string,
): CardFace[] {
  return options.map((option, index) => ({
    art: option.art,
    frame,
    id: optionId(source.id, option.art),
    index,
    name: option.name,
    source,
    text: effectText(data, option.effects),
    title,
  }));
}

// Every card face the game can show, one per option: encounter options in data order, each
// zone's fork path card, each upgrade a path can carry, then Skip.
function cardFaces(data: GameData): CardFace[] {
  const encounterCards = entries<EncounterId, GameData["encounters"][EncounterId]>(
    data.encounters,
  ).flatMap(([id, encounter]) => {
    if (encounter.resolution.kind !== "card") {
      return [];
    }
    const source: CardSource = { affected: [], encounter: id, kind: "encounter" };
    return optionFaces(
      data,
      cardFrameTag(source),
      encounter.resolution.options,
      { id, kind: "encounter" },
      encounter.name,
    );
  });
  // Every zone's path card, as a fork shows it, before its upgrade.
  const pathCards = data.world.zones.map((zone): CardFace => ({
    art: cardZoneKey(zone),
    frame: "route",
    id: zone.id,
    index: null,
    name: zone.name,
    source: { id: zone.id, kind: "fork" },
    text: zone.difficultyName,
    title: data.runText.card.forkTitle,
  }));
  const upgradeCards = entries<UpgradeId, GameData["upgrades"][UpgradeId]>(data.upgrades).map(
    ([id, upgrade]): CardFace => ({
      art: upgrade.art,
      frame: "route",
      id,
      index: null,
      name: upgrade.name,
      source: { id, kind: "upgrade" },
      text: effectText(data, upgrade.effects),
      title: data.runText.card.forkTitle,
    }),
  );
  const skip: CardFace = {
    art: SKIP_CARD_ART,
    frame: "encounter",
    id: "skip",
    index: null,
    name: "Skip",
    source: { id: null, kind: "skip" },
    text: effectText(data, []),
    title: "",
  };
  return [...encounterCards, ...pathCards, ...upgradeCards, skip];
}

export function gameDataExport(data: GameData) {
  const { zones, ...world } = data.world;
  const { tuning } = data;
  return {
    cards: cardFaces(data),
    debuffs: entries(data.debuffs).map(([id, debuff]) => ({ id, ...debuff })),
    dogs: entries<DogId, GameData["dogs"][DogId]>(data.dogs).map(([id, dog]) => {
      const start = startHearts(tuning, [], dog);
      return {
        id,
        ...dog,
        // Before modifiers: what a dog brings to a walk with no gear or upgrades.
        figures: {
          maxHearts: maxHearts(tuning, [], dog),
          startHearts: start,
          startMood: faceMood(data, start),
        },
        keys: {
          doghouseTag: doghouseTag(data, id),
          face: dogFaceKey(data, id),
          ownerFace: ownerFaceKey(data, id),
          portrait: dogPortraitKey(data, id),
          sprite: dogSpriteKey(data, id),
        },
      };
    }),
    encounters: entries<EncounterId, GameData["encounters"][EncounterId]>(data.encounters).map(
      ([id, encounter]) => ({ id, ...encounter, spriteKey: encounterSpriteKey(id) }),
    ),
    gear: entries<GearId, GameData["shopGear"][GearId]>(data.shopGear).map(([id, gear]) => ({
      id,
      ...gear,
      iconKey: gearIconKey(id),
    })),
    help: data.help,
    minorObstacles: entries<MinorObstacleId, GameData["minorObstacles"][MinorObstacleId]>(
      data.minorObstacles,
    ).map(([id, obstacle]) => ({ id, ...obstacle, spriteKey: minorObstacleSpriteKey(id) })),
    tuning,
    upgrades: entries<UpgradeId, GameData["upgrades"][UpgradeId]>(data.upgrades).map(
      ([id, upgrade]) => ({ id, ...upgrade }),
    ),
    walkers: entries<WalkerId, GameData["walkers"][WalkerId]>(data.walkers).map(([id, walker]) => ({
      id,
      ...walker,
    })),
    world,
    zones: zones.map((zone) => ({
      ...zone,
      keys: {
        backdrop: backdropKey(zone),
        card: cardZoneKey(zone),
        icon: zoneIconKey(zone),
        road: roadTileKey(zone),
        roadStart: roadStartKey(zone),
      },
    })),
  };
}
