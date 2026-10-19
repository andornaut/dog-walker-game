import type { DogId, EncounterId, ForcedStopId, GameData, GearId } from "../data/types";
import type { CardSource } from "../state/runState";

// Forced stops whose sprite is named for the figure on the road rather than the stop.
const FORCED_STOP_SPRITES: Readonly<Partial<Record<ForcedStopId, string>>> = {
  constructionDetour: "construction",
  kidWantsToPet: "kid",
};

export function forcedStopSpriteKey(stop: ForcedStopId): string {
  return FORCED_STOP_SPRITES[stop] ?? kebabCase(stop);
}

export const CARD_FRAME_KEY = "card-frame";
export type CardFrameTag = "encounter" | "lucky" | "stop" | "upgrade";

// The card frame's colour comes from what opened the card.
export function cardFrameTag(data: Pick<GameData, "encounters">, source: CardSource): CardFrameTag {
  switch (source.kind) {
    case "encounter":
      return data.encounters[source.encounter].kind === "lucky" ? "lucky" : "encounter";
    case "forcedStop":
      return "stop";
    default:
      return "upgrade";
  }
}

// Manifest keys are kebab-case; data ids are camelCase.
export function kebabCase(id: string): string {
  return id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function encounterSpriteKey(encounter: EncounterId): string {
  return kebabCase(encounter);
}

export function dogSpriteKey(dog: DogId): string {
  return `dog-${kebabCase(dog)}`;
}

export function dogFaceKey(dog: DogId): string {
  return `face-dog-${kebabCase(dog)}`;
}

// A gear item's 32x32 icon image.
export function gearIconKey(gear: GearId): string {
  return `item-${kebabCase(gear)}`;
}

// Owner faces are keyed by their dog.
export function ownerFaceKey(dog: DogId): string {
  return `face-owner-${kebabCase(dog)}`;
}
