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
import { depthStepOfScale } from "./depthSteps";

// Forced stops whose sprite is named for the figure on the road rather than the stop.
const FORCED_STOP_SPRITES: Readonly<Partial<Record<ForcedStopId, string>>> = {
  constructionDetour: "construction",
  kidWantsToPet: "kid",
};

export function forcedStopSpriteKey(stop: ForcedStopId): string {
  return FORCED_STOP_SPRITES[stop] ?? kebabCase(stop);
}

export const CARD_FRAME_KEY = "card-frame";
export type CardFrameTag = "encounter" | "lucky" | "route" | "stop" | "upgrade";

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
    case "fork":
      return "route";
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

// A road sprite's hand-drawn version for a depth step, such as dog-koda@62 for 0.625x, or
// null at full size. Throws for a scale that is not a step.
export function depthVariantKey(key: string, step: number): string | null {
  const { suffix } = depthStepOfScale(step);
  return suffix === "" ? null : `${key}${suffix}`;
}

// Sprites drawn standing on the road or the backdrop, which need their feet line. Faces,
// effects, badges, cards, icons and UI are placed by their frame instead, except a mover's
// cue, which stands on the road (GROUND_UI_KEYS, below its keys).
const UNMEASURED_PREFIXES = ["badge-", "card-", "face-", "fx-", "icon-", "portrait-", "ui-"];

export function standsOnGround(key: string): boolean {
  return GROUND_UI_KEYS.has(key) || !UNMEASURED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// The skunk stands on its spray cloud, which is its hit box.
export const SKUNK_CLOUD_KEY = "skunk-cloud";

// Zone art is keyed by the zone's art: backdrop-woof-way, road-woof-way and so on.
type ZoneArt = Pick<Zone, "art">;

// The 360x150 neighbourhood behind the zone.
export function backdropKey(zone: ZoneArt): string {
  return `backdrop-${zone.art}`;
}

// The zone's 280x64 road strip, which tiles vertically.
export function roadTileKey(zone: ZoneArt): string {
  return `road-${zone.art}`;
}

// The 280x64 strip scrolled in once at the zone's start: a cross-street crossing in its
// bottom rows, which follows any zone's road, and the zone's own strip above it.
export function roadStartKey(zone: ZoneArt): string {
  return `road-${zone.art}-start`;
}

export function zoneIconKey(zone: ZoneArt): string {
  return `icon-zone-${zone.art}`;
}

// The 75x56 preview of the zone on a fork's path card.
export function cardZoneKey(zone: ZoneArt): string {
  return `card-zone-${zone.art}`;
}

// The paws under the zone name on a path card, tagged 1 to 5 by difficulty.
export const DIFFICULTY_KEY = "ui-difficulty";

export const ZONE_PIPS_KEY = "ui-zone-pips";

// A route pip's tag: todo for a zone not yet picked, else the zone's art, filled in the
// zone's colour, with -done once the zone is finished.
export function zonePipTag(zone: ZoneArt | null, done: boolean): string {
  if (zone === null) {
    return "todo";
  }
  return done ? `${zone.art}-done` : zone.art;
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

const GROUND_UI_KEYS: ReadonlySet<string> = new Set([WARNING_KEY, WARNING_ARROW_KEY]);
