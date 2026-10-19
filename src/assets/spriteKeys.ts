import type {
  AchievementId,
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  MinorObstacleId,
  NeedSpotId,
  Zone,
} from "../data/types";
import type { MoverKind } from "../runner/movers";
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
export function cardFrameTag(
  data: Pick<GameData, "encounters" | "needCards">,
  source: CardSource,
): CardFrameTag {
  switch (source.kind) {
    case "encounter":
      return data.encounters[source.encounter].kind === "lucky" ? "lucky" : "encounter";
    case "forcedStop":
      return "stop";
    case "need":
      return data.needCards[source.card].kind === "payoff" ? "lucky" : "encounter";
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

// Every dog-keyed art key names the dog by its art id, which can differ from its data id.
export function dogSpriteKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `dog-${data.dogs[dog].art}`;
}

export function dogFaceKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `face-dog-${data.dogs[dog].art}`;
}

// A dog's 64x64 portrait, for the shop and its detail card.
export function dogPortraitKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `portrait-dog-${data.dogs[dog].art}`;
}

// An achievement's 32x32 badge, tagged earned and locked.
export function badgeKey(achievement: AchievementId): string {
  return `badge-${kebabCase(achievement)}`;
}

// A gear item's 32x32 icon image.
export function gearIconKey(gear: GearId): string {
  return `item-${kebabCase(gear)}`;
}

// Owner faces are keyed by their dog.
export function ownerFaceKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `face-owner-${data.dogs[dog].art}`;
}

// The doghouse slot's tag: the dog's roof, or the grey empty house of a fired dog.
export function doghouseTag(data: Pick<GameData, "dogs">, dog: DogId | null): string {
  return dog === null ? "empty" : data.dogs[dog].art;
}

// Minor obstacles whose sprite key is not their id in kebab case.
const MINOR_OBSTACLE_SPRITES: Readonly<Partial<Record<MinorObstacleId, string>>> = {
  barrier2: "barrier-2",
  barrier3: "barrier-3",
};

export function minorObstacleSpriteKey(obstacle: MinorObstacleId): string {
  return MINOR_OBSTACLE_SPRITES[obstacle] ?? kebabCase(obstacle);
}

// Each need spot's road sprite: the hydrant and the other dog reuse their obstacle's art,
// marked on the road by the need's icon.
const NEED_SPOT_SPRITES: Readonly<Record<NeedSpotId, string>> = {
  fireHydrant: "hydrant",
  lampPost: "spot-lamp-post",
  playmate: "other-dog",
  stranger: "spot-stranger",
  tree: "spot-tree",
  waterBowl: "spot-water-bowl",
};

export function needSpotSpriteKey(spot: NeedSpotId): string {
  return NEED_SPOT_SPRITES[spot];
}

// The pull and need signals over a dog: the bubble a need or target icon sits in, the mark of
// a pull blocked by the fairness rule and its burst, a need met, and a Regular dog's accident
// with the decal it leaves on the road.
export const NEED_ART = {
  accident: "fx-accident",
  accidentSpot: "accident-spot",
  bubble: "ui-pull-bubble",
  needMet: "fx-need-met",
  pullBlocked: "ui-pull-blocked",
  pullFail: "fx-pull-fail",
} as const;

// A road sprite's hand-drawn version for a depth step, such as dog-koda@75 for 0.75x, or
// null at full size.
export function depthVariantKey(key: string, step: number): string | null {
  return step >= 1 ? null : `${key}@${Math.round(step * 100)}`;
}

// Sprites drawn standing on the road or the backdrop, which need their feet line. Faces,
// effects, badges, cards, icons and UI are placed by their frame instead.
const UNMEASURED_PREFIXES = ["badge-", "card-", "face-", "fx-", "icon-", "portrait-", "ui-"];

export function standsOnGround(key: string): boolean {
  return !UNMEASURED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// The skunk stands on its spray cloud, which is its hit box.
export const SKUNK_CLOUD_KEY = "skunk-cloud";

// Zone art is keyed by the zone's name in kebab case: "The Long Way Home" is the-long-way-home.
export function zoneArtName(zone: Pick<Zone, "name">): string {
  return zone.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// The 360x150 neighbourhood behind the zone.
export function backdropKey(zone: Pick<Zone, "name">): string {
  return `backdrop-${zoneArtName(zone)}`;
}

// The zone's 280x64 road strip, which tiles vertically.
export function roadTileKey(zone: Pick<Zone, "name">): string {
  return `road-${zoneArtName(zone)}`;
}

// The 280x64 strip joining the previous zone's road to this one's, scrolled in once.
export function roadStartKey(zone: Pick<Zone, "name">): string {
  return `road-${zoneArtName(zone)}-start`;
}

export function zoneIconKey(zone: Pick<Zone, "name">): string {
  return `icon-zone-${zoneArtName(zone)}`;
}

// Each mover's road sprite and the tag it plays while moving. Crossers face right.
export const MOVER_SPRITES = {
  ball: { key: "ball-bounce", tag: "bounce" },
  cyclist: { key: "cyclist", tag: "ride" },
  looseDog: { key: "loose-dog", tag: "run" },
  squirrel: { key: "squirrel-dash", tag: "run" },
} as const satisfies Readonly<Record<MoverKind, { key: string; tag: string }>>;

// A mover's cue: the sign at the lane edge and the arrow pointing the way it will go, which
// faces right. Both play WARNING_TAG; the arrow plays WARNING_DOWN_TAG to point down a lane.
export const WARNING_KEY = "ui-warning";
export const WARNING_ARROW_KEY = "ui-warning-arrow";
export const WARNING_TAG = "pulse";
export const WARNING_DOWN_TAG = "down-pulse";
