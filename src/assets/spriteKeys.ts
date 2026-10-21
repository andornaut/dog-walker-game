import type {
  AchievementId,
  DogId,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  MovementKind,
  Size,
  WalkerId,
  Zone,
} from "../data/types";
import type { CardSource } from "../state/runState";
import { depthStepOfScale } from "./depthSteps";

export const CARD_FRAME_KEY = "card-frame";
type CardFrameTag = "encounter" | "route";

// The card frame's colour comes from what opened the card: an obstacle, or a fork.
export function cardFrameTag(source: CardSource): CardFrameTag {
  return source.kind === "fork" ? "route" : "encounter";
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

// A walker's 64x64 portrait, for its detail card.
export function walkerPortraitKey(walker: WalkerId): string {
  return `portrait-walker-${walker}`;
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

// The owner's 20x20 face, for the photo on their dog's card.
export function ownerCardFaceKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `${ownerFaceKey(data, dog)}-20`;
}

// The dog card's tag: the dog's card, or the empty card of a fired dog.
export function dogCardTag(data: Pick<GameData, "dogs">, dog: DogId | null): string {
  return dog === null ? "empty" : data.dogs[dog].art;
}

// Minor obstacles whose sprite key is not their id in kebab case.
const MINOR_OBSTACLE_SPRITES: Readonly<Partial<Record<MinorObstacleId, string>>> = {
  ball: "ball-bounce",
  barrier2: "barrier-2",
  barrier3: "barrier-3",
  bunny: "chase-rabbit",
  car: "parked-car",
  cat: "chase-cat",
  ducklings: "chase-ducklings",
  frisbeeDog: "social-frisbee-dog",
  garbageTruck: "stink-garbage-truck",
  pigeons: "chase-pigeons",
  raccoon: "snatch-raccoon",
  scooter: "minor-scooter",
  seagull: "snatch-seagull",
};

export function minorObstacleSpriteKey(obstacle: MinorObstacleId): string {
  return MINOR_OBSTACLE_SPRITES[obstacle] ?? kebabCase(obstacle);
}

// Road art not drawn yet, and the drawn sprite that stands in for it until its key is in the
// manifest.
export const ART_STAND_INS: Readonly<Partial<Record<string, string>>> = {
  jogger: "social-jogger-dog-owner",
  "kid-on-bike": "minor-tricycles",
  stroller: "social-handbag-dog-owner",
};

// Whether the art manifest has a key.
export type HasArt = (key: string) => boolean;

// The key to draw for art: its own while it is loaded, else its stand-in once that is.
export function artOrStandIn(has: HasArt, art: string): string {
  const standIn = ART_STAND_INS[art];
  return has(art) || standIn === undefined || !has(standIn) ? art : standIn;
}

// The pull signals over a dog: the bubble its target's icon sits in, and the mark of a pull
// blocked by the fairness rule and its burst.
export const PULL_ART = {
  bubble: "ui-pull-bubble",
  pullBlocked: "ui-pull-blocked",
  pullFail: "fx-pull-fail",
} as const;

// The zone celebration's own art: the 148x132 starburst behind the walker; the 6x6 confetti
// bit, a looping tag per colour, falling over the road; the new walker's bubble's tail,
// pointing up at them; and the walker-<name> tag the walker cheers in and hops in with (idle
// while it is missing). fx-confetti bursts as a new walker lands.
export const ZONE_CELEBRATION_ART = {
  burst: "ui-celebrate-burst",
  confettiBit: "fx-confetti-bit",
  confettiBitTags: ["amber", "cyan", "green", "pink", "white", "yellow"],
  tailUp: "ui-quip-tail-up",
  walkerTags: ["cheer", "idle"],
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

// A 1x road sprite's drawn frame side: dogs, obstacles and encounters are this square, the
// walker and the tall encounters this wide and half again as tall, and tips, treats and
// puddles this wide and half as tall. An object spanning n lanes is drawn n lanes wide less
// the lane's spare width beside a 1-lane sprite.
export const ROAD_SPRITE_SIZE = 48;

// A dog's road sprite frame side by its size: a medium dog's is ROAD_SPRITE_SIZE.
export const DOG_FRAME_SIDES: Readonly<Record<Size, number>> = { big: 54, medium: 48, small: 38 };

// A 1-lane road object's hit box side, independent of how big it is drawn: an object spanning
// n lanes is hit n lanes wide less the lane's spare width beside this.
export const ROAD_HIT_SIZE = 40;

// The skunk stands on its spray cloud, which is its hit box.
export const SKUNK_CLOUD_KEY = "skunk-cloud";

// Zone art is keyed by the zone's art: backdrop-high-park, road-high-park and so on.
type ZoneArt = Pick<Zone, "art">;

// The 360x150 neighborhood behind the zone.
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

// A mover plays its look's art, or the sprite named here for it, in the tag moverBodyTag picks.
export const MOVER_SPRITE_KEYS: Readonly<Partial<Record<string, string>>> = {
  "other-dog": "loose-dog",
  squirrel: "squirrel-dash",
};
export const MOVING_TAGS: Readonly<Record<Exclude<MovementKind, "still">, readonly string[]>> = {
  approach: ["step", "walk", "run"],
  dart: ["flee", "run", "bounce", "walk"],
  hop: ["hop", "pull-out", "run", "walk"],
  inLane: ["drive", "ride", "run", "walk", "pull-out"],
  step: ["walk", "run"],
};
export const IDLE_TAG = "idle";

// A standing road item plays the first of these tags its sprite has: its own motion while the
// walk goes on, and standing still while a card or the pause menu holds the walk. The movement
// tags come last, so an item drawn only in motion, such as the jogger's run, still plays it.
export const STANDING_TAGS = {
  halted: ["idle", "loop", "walk", "wave", "run", "ride", "drive", "bounce", "flee", "hop"],
  walking: ["walk", "wave", "loop", "idle", "run", "ride", "drive", "bounce", "flee", "hop"],
} as const;

// The tag a mover's body plays, of those has says its sprite has: while it moves, its
// movement's first tag, else its idle; otherwise its idle, else that movement tag; and
// failing both, what a standing item would play. A stalker drawn with a step (a lunge) for its
// steps stalks between them, playing walk.
export function moverBodyTag(
  has: (tag: string) => boolean,
  movement: MovementKind,
  moving: boolean,
): string | undefined {
  const motion = movement === "still" ? [] : MOVING_TAGS[movement];
  const stalking = movement === "approach" && has("step") ? ["walk"] : [];
  const tags = moving
    ? [...motion, IDLE_TAG, ...STANDING_TAGS.walking]
    : [...stalking, IDLE_TAG, ...motion, ...STANDING_TAGS.halted];
  return tags.find(has);
}

// An ambient mover wears its own art or one of the variants named here, picked at random as
// it sets out, among those loaded.
export const AMBIENT_VARIANTS: Readonly<Partial<Record<string, readonly string[]>>> = {
  "ambient-car": ["ambient-car-hatchback", "ambient-car-van", "ambient-car-wagon"],
};

// An ambient mover whose art is not drawn yet plays the sprite and tag named here for it, or
// is not shown while its entry is null.
export const AMBIENT_FALLBACKS: Readonly<
  Partial<Record<string, { readonly key: string; readonly tag: string } | null>>
> = {
  "ambient-bike": { key: "cyclist", tag: "ride" },
  "ambient-bird": { key: "chase-pigeons", tag: "run" },
  "ambient-car": { key: "parked-car", tag: "drive" },
  "ambient-cat": { key: "chase-cat", tag: "run" },
  "ambient-pedestrian": { key: "other-dog-owner", tag: "walk" },
  "ambient-pedestrian-back": null,
  "ambient-rabbit": { key: "chase-rabbit", tag: "run" },
};

// A mover's cue: the sign at the lane edge and the arrow pointing the way it will go, which
// faces right. Both play WARNING_TAG; the arrow plays WARNING_DOWN_TAG or WARNING_UP_TAG to
// point down or up a lane. A stepping mover's cue is WARNING_WANDER_KEY over its head, playing
// WARNING_TAG.
export const WARNING_KEY = "ui-warning";
export const WARNING_ARROW_KEY = "ui-warning-arrow";
export const WARNING_WANDER_KEY = "ui-warning-wander";
export const WARNING_TAG = "pulse";
export const WARNING_DOWN_TAG = "down-pulse";
export const WARNING_UP_TAG = "up-pulse";

const GROUND_UI_KEYS: ReadonlySet<string> = new Set([WARNING_KEY, WARNING_ARROW_KEY]);
