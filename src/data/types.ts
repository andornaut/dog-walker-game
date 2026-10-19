import type { ACHIEVEMENTS } from "./achievements";
import type { DEBUFFS } from "./debuffs";
import type { DOGS } from "./dogs";
import type { ENCOUNTERS } from "./encounters";
import type { FORCED_STOPS } from "./forcedStops";
import type { HINTS } from "./hints";
import type { MINOR_OBSTACLES } from "./minorObstacles";
import type { NEED_CARDS, NEED_SPOTS } from "./needs";
import type { SHOP_GEAR } from "./shop";
import type { TUNING } from "./tuning";
import type { UPGRADES } from "./upgrades";
import type { WALKERS } from "./walkers";
import type { WORLD } from "./world";

// The rule vocabulary: adding a value means new rules code, not only data.
export type EncounterId =
  | "biscuitNeighbour"
  | "cafe"
  | "goose"
  | "lemonade"
  | "lostWallet"
  | "otherDog"
  | "petunias"
  | "photoOp"
  | "picnic"
  | "puddle"
  | "skunk"
  | "squirrel"
  | "thief"
  | "trash";
export type Energy = "calm" | "hyper" | "steady";
export type NeedId = "friendly" | "nosy" | "playful" | "regular" | "thirsty";
export type Size = "big" | "medium" | "small";
export type Temperament = "dramatic" | "fussy" | "laidBack";
export type TraitId = "chaser" | "fancy" | "foodDriven";

// Ids come from the data, so adding an entry to a value file is a data-only change.
export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
export type DebuffId = keyof typeof DEBUFFS;
export type DogId = keyof typeof DOGS;
export type ForcedStopId = keyof typeof FORCED_STOPS;
export type GearId = keyof typeof SHOP_GEAR;
export type HintId = keyof typeof HINTS;
export type MinorObstacleId = keyof typeof MINOR_OBSTACLES;
export type NeedCardId = keyof typeof NEED_CARDS;
export type NeedSpotId = keyof typeof NEED_SPOTS;
export type UpgradeId = keyof typeof UPGRADES;
export type WalkerId = keyof typeof WALKERS;
export type ZoneId = (typeof WORLD)["zones"][number]["id"];

type EncounterOfKind<Kind extends Encounter["kind"]> = {
  [Id in EncounterId]: (typeof ENCOUNTERS)[Id]["kind"] extends Kind ? Id : never;
}[EncounterId];
export type LuckyEncounterId = EncounterOfKind<"lucky">;
export type ObstacleEncounterId = EncounterOfKind<"obstacle">;

// The tuning as the game reads it: every value is a number, so a live edit type-checks.
export type LiveTuning = typeof TUNING;
export type UnitGroup = keyof LiveTuning;

// Only keys whose value is a number, so a nested table can never be named as an amount.
export type NumberKeys<Group> = {
  [K in keyof Group]: Group[K] extends number ? K : never;
}[keyof Group];

// Keys into one unit group of the tuning, so a key from the wrong unit is a type error.
export type CountKey = NumberKeys<LiveTuning["counts"]>;
export type HeartsKey = NumberKeys<LiveTuning["hearts"]>;
export type MoneyKey = NumberKeys<LiveTuning["money"]>;
export type MultiplierKey = NumberKeys<LiveTuning["multipliers"]>;
export type PriceKey = keyof LiveTuning["money"]["prices"];

type Table<Key extends PropertyKey> = Readonly<Record<Key, number>>;
type OpenGroup = Readonly<Record<string, number | Table<string>>>;

// The values the rules read by name; each group may hold more keys for cards to name.
export interface Tuning {
  readonly counts: OpenGroup & {
    readonly ballLanesPerSecond: number;
    readonly gooseLanesPerSecond: number;
    readonly looseDogLanesPerSecond: number;
    readonly minorObstaclesFirstZone: number;
    readonly minorObstaclesGainPerZone: number;
    readonly needSpotsPerZone: number;
    readonly obstaclesFirstZone: number;
    readonly obstaclesGainPerZone: number;
    readonly packSizeMax: number;
    readonly packSizeMin: number;
    readonly squirrelDartLanesPerSecond: number;
    readonly tipsFirstZone: number;
    readonly tipsGainPerZone: number;
    readonly treatCarryMax: number;
    readonly treatsPerZone: number;
    readonly upgradeChoiceCount: number;
  };
  readonly hearts: OpenGroup & {
    readonly maxBySize: Table<Size>;
    readonly startByTemperament: Table<Temperament>;
    readonly treat: number;
  };
  readonly money: OpenGroup & {
    readonly feeByTemperament: Table<Temperament>;
    readonly prices: Table<string> & { readonly lockedDog: number };
    readonly minorBump: number;
    readonly tip: number;
  };
  readonly multipliers: OpenGroup & {
    readonly cyclistSpeedMultiplier: number;
    readonly heartsByTemperament: Table<Temperament>;
    readonly scrollSpeedGainPerZone: number;
    readonly tipByPackSize: Table<number>;
  };
  readonly pixels: OpenGroup & { readonly roadScrollSpeed: number };
  readonly probability: OpenGroup & {
    readonly catchBySize: Table<Size>;
    readonly needPayoffCard: number;
  };
  readonly seconds: OpenGroup & {
    readonly ballBounceSeconds: number;
    readonly firingHoldSeconds: number;
    readonly hitStopSeconds: number;
    readonly inputLockBySize: Table<Size>;
    readonly lookAheadSeconds: number;
    readonly minorHitStopSeconds: number;
    readonly minorStumble: number;
    readonly moverWarningSeconds: number;
    readonly needGoneWrong: number;
    readonly needUrgentByEnergy: Table<Energy>;
    readonly pullReactionWindow: number;
    readonly pullTell: number;
    readonly statusVisualSeconds: number;
    readonly zoneAtBaseSpeed: number;
  };
}

// "start": owned from the first run; "shop": bought on the home screen at its price.
export type Unlock =
  { readonly price: PriceKey; readonly unlock: "shop" } | { readonly unlock: "start" };

export interface Owner {
  readonly name: string;
  readonly role: string;
  readonly temperament: Temperament;
}

export type Dog = Unlock & {
  // The name in the dog's art keys: dog-<art> and its depth variants, face-dog-<art>,
  // portrait-dog-<art>, face-owner-<art>, owner-<art> and the <art> tag of ui-doghouse.
  readonly art: string;
  readonly breed: string;
  readonly energy: Energy;
  readonly look: string;
  readonly name: string;
  readonly need: NeedId;
  readonly owner: Owner;
  readonly size: Size;
  readonly trait: TraitId;
};

// Which dogs an effect reaches, among the dogs still in the pack. "affected" is the dogs
// the encounter affected; "randomOne" is one dog drawn at random; "unhappiest" is the dog
// whose owner has the fewest hearts, the first in pack order on a tie.
export type Target =
  | { readonly kind: "affected" }
  | { readonly kind: "all" }
  | { readonly kind: "need"; readonly need: NeedId }
  | { readonly kind: "randomOne" }
  | { readonly kind: "temperament"; readonly temperament: Temperament }
  | { readonly kind: "trait"; readonly trait: TraitId }
  | { readonly kind: "unhappiest" };

export type Condition =
  | { readonly kind: "packHasSize"; readonly size: Size }
  | { readonly kind: "packHasTrait"; readonly trait: TraitId };

// "zone": the rest of the current zone; "nextZone": the whole of the next zone.
export type Duration = "nextZone" | "run" | "zone";

// Stats a modifier changes. An "add" names a key in the stat's own unit group.
export type CountStat = "treatReach";
export type HeartsStat = "maxHearts" | "startHearts";
export type MoneyStat = "costPerDog" | "startMoney";
export type Stat =
  | CountStat
  | HeartsStat
  | MoneyStat
  | "chaserSquirrelPulls"
  | "fees"
  | "inputLock"
  | "obstacleSpawns"
  | "tipSpawns"
  | "tipValue"
  | "zoneLength";

// duration is absent for gear, which lasts every run it is taken on.
export type Modifier = { readonly duration?: Duration } & (
  | { readonly by: CountKey; readonly operation: "add"; readonly stat: CountStat }
  | { readonly by: HeartsKey; readonly operation: "add"; readonly stat: HeartsStat }
  | { readonly by: MoneyKey; readonly operation: "add"; readonly stat: MoneyStat }
  | { readonly by: MultiplierKey; readonly operation: "multiply"; readonly stat: Stat }
);

export type HeartsDelta = -3 | -2 | -1 | 1 | 2 | 3;

// Without perDog the amount applies once; with it, once per dog the target reaches.
export interface MoneyEffect {
  readonly amount: MoneyKey;
  readonly change: "gain" | "lose";
  readonly kind: "money";
  readonly perDog?: Target;
}

// Per owner, before the temperament multiplier; traitAmounts replaces amount for those traits.
export interface HeartsEffect {
  readonly amount: HeartsDelta;
  readonly kind: "hearts";
  readonly target: Target;
  readonly traitAmounts?: Readonly<Partial<Record<TraitId, HeartsDelta>>>;
}

// Treats carried, up to counts.treatCarryMax.
export interface TreatsEffect {
  readonly amount: CountKey;
  readonly kind: "treats";
  readonly perDog?: Target;
}

export interface DebuffEffect {
  readonly debuff: DebuffId;
  readonly kind: "debuff";
}

// No card opens for the encounter while the pack is immune to it.
export interface ImmuneEffect {
  readonly duration: Duration;
  readonly encounter: EncounterId;
  readonly kind: "immune";
}

export type ModifierEffect = Modifier & { readonly kind: "modifier" };

// Meets the need of every dog in the pack that has it, so its urgency starts again from 0.
export interface FulfilNeedEffect {
  readonly kind: "fulfilNeed";
  readonly need: NeedId;
}

export interface SkipOptionEffect {
  readonly kind: "skipOption";
  readonly usesPerRun: CountKey;
}

export type Effect =
  | DebuffEffect
  | FulfilNeedEffect
  | HeartsEffect
  | ImmuneEffect
  | ModifierEffect
  | MoneyEffect
  | SkipOptionEffect
  | TreatsEffect;

export type EffectKind = Effect["kind"];

export interface CardOption {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  // What its changes name as their cause, such as "grumpy neighbour"; the option's name when
  // absent.
  readonly cause?: string;
  // Picking it lets the chasers chase, which counts toward squirrelsChased.
  readonly chase?: true;
  readonly effects: readonly Effect[];
  readonly name: string;
}

// Cards show two or three options side by side.
export type CardOptions =
  readonly [CardOption, CardOption] | readonly [CardOption, CardOption, CardOption];

export type NonEmptyEffects = readonly [Effect, ...Effect[]];

// Which dogs an encounter affects. "caught": each dog rolls probability.catchBySize.
export type AffectRule =
  | { readonly kind: "all" }
  | { readonly kind: "caught" }
  | { readonly kind: "trait"; readonly trait: TraitId };

// The encounter opens a card of options.
export interface CardResolution {
  readonly kind: "card";
  readonly options: CardOptions;
}

// The encounter applies its effects on contact, with a popup instead of a card. art is the
// popup's illustration.
export interface InstantResolution {
  readonly art: string;
  readonly effects: NonEmptyEffects;
  readonly kind: "instant";
}

export type Resolution = CardResolution | InstantResolution;

// What an obstacle covers on the road: lanes across and rows along it. One row is a lane-width
// of road. The rulebook allows no obstacle wider than 3 lanes.
export interface Shape {
  readonly lanes: 1 | 2 | 3;
  readonly rows: 1 | 2 | 3;
}

// "obstacle": hit by accident, always a card, with hitLabel shown large as it hits; "lucky":
// a good thing to bump into, a card or instant. A lucky card with a hitLabel shows it as the
// pack meets it, before its card. Nothing happens when no dog is affected, when the pack is
// immune, or when noCardWhen holds.
export type Encounter = {
  readonly affects: AffectRule;
  readonly name: string;
  readonly noCardWhen?: Condition;
} & (
  | { readonly hitLabel?: string; readonly kind: "lucky"; readonly resolution: CardResolution }
  | { readonly kind: "lucky"; readonly resolution: InstantResolution }
  | {
      readonly hitLabel: string;
      readonly kind: "obstacle";
      readonly resolution: CardResolution;
      readonly shape: Shape;
    }
);

// An obstacle that opens no card: bumping it drops money.minorBump in tips, once for the
// pack, and locks lane input for seconds.minorStumble. Each zone's weights set how often it
// appears there.
export interface MinorObstacle {
  readonly name: string;
  readonly shape: Shape;
}

export interface ForcedStop {
  readonly name: string;
  readonly options: CardOptions;
}

// A need: name is its one player-facing word ("Regular"), on a dog's card and in card text.
// Meeting it at a spot applies met to the dogs with the need, unless the payoff card opens
// instead, at probability.needPayoffCard. Gone wrong, it opens its card or applies its
// effects to the dog.
export interface Need {
  readonly goneWrong:
    | { readonly card: NeedCardId; readonly kind: "card" }
    | { readonly effects: NonEmptyEffects; readonly kind: "effects" };
  readonly met: NonEmptyEffects;
  readonly name: string;
  readonly payoff: NeedCardId;
}

// A spot on the road that meets a need, steered into like a pickup.
export interface NeedSpot {
  readonly name: string;
  readonly need: NeedId;
}

// A card a need opens: a payoff for meeting it, or trouble when it goes wrong. A {dog} in
// the name is the names of the dogs it affects.
export interface NeedCard {
  readonly kind: "payoff" | "trouble";
  readonly name: string;
  readonly options: CardOptions;
}

// How long an upgrade card's effects last: applied at once, through the next zone, or for
// the rest of the run.
export type UpgradeDuration = "nextZone" | "now" | "run";

export interface Upgrade {
  // Key of the card's illustration in the art manifest's images.
  readonly art: string;
  readonly duration: UpgradeDuration;
  readonly effects: NonEmptyEffects;
  readonly kind: "boost" | "tradeOff";
  readonly name: string;
}

export interface Gear {
  readonly effects: NonEmptyEffects;
  readonly name: string;
  readonly price: PriceKey;
}

// The dog slots in order. A run takes at most one dog per owned slot.
export type DogSlot = Unlock;

// A walker the player can pick. spriteKey and portraitKey are keys into the art manifest.
export type Walker = Unlock & {
  readonly name: string;
  readonly portraitKey: string;
  readonly spriteKey: string;
};

export interface Debuff {
  readonly duration: Duration;
  readonly modifiers: readonly Modifier[];
  readonly name: string;
}

// Paws out of 5 on a fork's path card.
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// How often each kind is drawn in a zone, relative to the others of its group. 0 keeps it out
// of the zone; each group needs at least one kind above 0.
export interface ZoneWeights {
  readonly forcedStops: Readonly<Record<ForcedStopId, number>>;
  readonly luckyFinds: Readonly<Record<LuckyEncounterId, number>>;
  readonly minorObstacles: Readonly<Record<MinorObstacleId, number>>;
  readonly needSpots: Readonly<Record<NeedSpotId, number>>;
  readonly obstacles: Readonly<Record<ObstacleEncounterId, number>>;
}

export interface Zone {
  // The zone's name in its art keys, such as backdrop-<art>.
  readonly art: string;
  // Multiply the zone's counts, on top of the per-zone gains in counts: obstacles (minor ones
  // too), tips and lucky finds.
  readonly density: {
    readonly luckyFinds: number;
    readonly obstacles: number;
    readonly tips: number;
  };
  readonly difficulty: Difficulty;
  // The difficulty in words, as a path card shows it.
  readonly difficultyName: string;
  // Multiplies every dog's fee for the zone.
  readonly fees: number;
  readonly id: string;
  // Hex colours from the art palette. The leash stands out against the zone's road.
  readonly leashColor: string;
  // The share of the zone's squirrels, other dogs and minor obstacles that come as movers (a
  // darting squirrel, a loose dog, or a ball or cyclist), from 0 to 1.
  readonly moverShare: number;
  readonly name: string;
  readonly roadColor: string;
  readonly roadShadowColor: string;
  // Multiplies the scroll speed, on top of multipliers.scrollSpeedGainPerZone.
  readonly speed: number;
  readonly weights: ZoneWeights;
}

export interface World {
  // The id of the zone every walk starts in.
  readonly firstZone: string;
  readonly name: string;
  // How many zones a walk visits, none twice.
  readonly walkLength: number;
  // From easiest to hardest: a fork's paths keep this order, left to right.
  readonly zones: readonly [Zone, ...Zone[]];
}

// One page of the "How to walk" help screen, shown in list order.
export interface HelpPage {
  // Key of the page's illustration in the art manifest's images.
  readonly art: string;
  readonly body: string;
  readonly title: string;
}

// The home screen's text. A {name} in a line is filled by code, and each line may use only
// the names src/home/homeText.ts lists for it.
export interface HomeText {
  // The walker's speech bubble, by what happened last. Picking a dog shows its owner's
  // parting quip instead.
  readonly bubble: {
    readonly afterFiring: string;
    readonly afterWalk: string;
    readonly firstVisit: string;
    // Said in place of afterWalk after each of the player's first few walks.
    readonly howTo: string;
    readonly newAffordable: string;
  };
  // A held dog or gear tile's detail card: the dog's rows, the gear card's subtitle and
  // status, and the price status of anything not owned yet.
  readonly detail: {
    readonly dogFee: string;
    readonly dogKind: string;
    readonly dogOwner: string;
    readonly dogStatus: string;
    readonly dogTemperament: string;
    readonly dogTotals: string;
    readonly gearEquipped: string;
    readonly gearOwned: string;
    readonly gearSubtitle: string;
    readonly priceBuy: string;
    readonly priceLocked: string;
  };
  readonly dogBought: string;
  readonly dogCantAfford: string;
  // A dog slot's name in the purchase line.
  readonly dogSlotName: string;
  // The info line for a dog or gear tile the keyboard focuses: an owned dog's, a locked dog's
  // with its price, a gear item's with its price while locked, and the parts they are built
  // from.
  readonly focus: {
    readonly dogLocked: string;
    readonly dogOwned: string;
    readonly gear: string;
    readonly gearLocked: string;
    readonly kind: string;
    readonly priceBuy: string;
    readonly priceShort: string;
    readonly temper: string;
  };
  // The street sign on the gate art.
  readonly gateSign: string;
  readonly gearBought: string;
  // The logbook card and the lines it shares with the Stats page: the best walk, the last
  // walk by how it ended, the totals, and what it says before any walk.
  readonly logbook: {
    // The button that opens Stats on its badge wall.
    readonly badges: string;
    readonly best: string;
    readonly bestNote: string;
    readonly empty: string;
    readonly emptyNote: string;
    readonly last: string;
    readonly lastEarned: string;
    readonly lastFinished: string;
    readonly lastFired: string;
    readonly lastHeadedHome: string;
    readonly stats: string;
    readonly title: string;
    readonly totals: string;
    readonly zoneMany: string;
    readonly zoneOne: string;
  };
  // What the walker says after a tap that changes nothing: the pack is full, or sound
  // toggled.
  readonly noticePackFull: string;
  readonly noticeSoundOff: string;
  readonly noticeSoundOn: string;
  readonly packCount: string;
  // The section headings, and what a required section with nothing picked asks for on its
  // band.
  readonly sectionDogs: string;
  readonly sectionDogsPrompt: string;
  readonly sectionGear: string;
  readonly sectionWalker: string;
  readonly sectionWalkerPrompt: string;
  readonly slotBought: string;
  readonly slotBuy: string;
  readonly slotSave: string;
  readonly slotSign: string;
  readonly startWalk: string;
  // The top bar's best walk and walk count, or what it says before any walk.
  readonly topBar: {
    readonly best: string;
    readonly noWalks: string;
    readonly walkMany: string;
    readonly walkOne: string;
  };
  // Said first in the walker's bubble while the browser keeps no save.
  readonly unsaved: string;
}

// The walk's own text. card is the choice cards': the titles and subtitles a card's data
// does not name, the Skip card, and the cost plaque's words. fired is the firing plate's
// word, homeQuestion is what the top bar's Home button asks, with its two answers, and
// lowHearts is the chip over a doghouse down to its last heart. A {name} in a line is filled
// by code, and each line may use only the names src/hud/runText.ts lists for it. firedBy
// names an owner who fires you, and card.fires flags an option that would fire owners.
export interface RunText {
  readonly card: {
    readonly fires: string;
    // A fork's path card plaque, with the zone's fee multiplier.
    readonly forkFees: string;
    readonly forkSubtitle: string;
    readonly forkTitle: string;
    readonly free: string;
    readonly need: string;
    readonly pickOne: string;
    readonly skip: string;
    // The Skip card's effect on its face, and in its body when held.
    readonly skipEffect: string;
    readonly skipHeld: string;
    readonly stopSubtitle: string;
    // An upgrade card's plaque, by how long it lasts.
    readonly upgradeDuration: { readonly [D in UpgradeDuration]: string };
    readonly upgradeTitle: string;
  };
  readonly fired: string;
  readonly firedBy: string;
  readonly homeQuestion: {
    readonly body: string;
    readonly headHome: string;
    readonly keepWalking: string;
    readonly title: string;
  };
  readonly lowHearts: string;
}

// The text of the menus and pages over the game: Settings, Stats, Help, the End screen, the
// pause menu and the badge celebration. A {name} in a line is filled by code, and each line
// may use only the names src/home/menuText.ts lists for it.
export interface MenuText {
  readonly celebration: {
    readonly button: string;
    readonly titleMany: string;
    readonly titleOne: string;
  };
  readonly end: {
    readonly backHome: string;
    readonly bank: string;
    // The breakdown's lines, by what the money came from.
    readonly earnings: {
      readonly cardCosts: string;
      readonly clawbacks: string;
      readonly fees: string;
      readonly luckyFinds: string;
      readonly start: string;
      readonly tips: string;
    };
    readonly firedYou: string;
    readonly newBest: string;
    // The title, by how the walk ended.
    readonly titles: {
      readonly finished: string;
      readonly noDogs: string;
      readonly wentHome: string;
    };
    readonly total: string;
    readonly zonesWalked: string;
  };
  // Help's heading, and its paging buttons: Next reads gotIt on the last page.
  readonly help: {
    readonly gotIt: string;
    readonly heading: string;
    readonly next: string;
    readonly previous: string;
  };
  readonly pause: {
    readonly headHome: string;
    readonly help: string;
    readonly note: string;
    readonly resume: string;
    readonly settings: string;
    readonly title: string;
  };
  readonly settings: {
    readonly effects: string;
    readonly motion: string;
    readonly motionNote: string;
    readonly music: string;
    // A volume slider's value while sound is off; volume is its value while sound is on.
    readonly muted: string;
    readonly sound: string;
    readonly soundNote: string;
    readonly title: string;
    readonly volume: string;
  };
  readonly stats: {
    readonly badgeEarned: string;
    readonly badgeLine: string;
    readonly badgeLocked: string;
    readonly badges: string;
    readonly dogColumns: {
      readonly dog: string;
      readonly fired: string;
      readonly walks: string;
      readonly zones: string;
    };
    readonly earnedCount: string;
    // Walks by how they ended.
    readonly outcomes: {
      readonly finished: string;
      readonly noDogs: string;
      readonly wentHome: string;
    };
    readonly overall: {
      readonly bestRun: string;
      readonly bestZone: string;
      readonly lifetime: string;
      readonly runsPlayed: string;
      readonly timesFired: string;
    };
    readonly sections: {
      readonly overall: string;
      readonly runs: string;
    };
    readonly tabs: {
      readonly badges: string;
      readonly dogs: string;
      readonly runs: string;
    };
    // Times fired once an owner has fired you, naming the owner who did it most.
    readonly timesFiredBy: string;
    readonly title: string;
  };
}

// What makes an owner speak: a choice that raised or lowered their hearts, firing you, or
// the player picking their dog on the home screen.
export type QuipMoment = "fired" | "happier" | "parting" | "upset";
// One owner's lines, two per moment.
export type Quips = Readonly<Record<QuipMoment, readonly [string, string]>>;

// What a first-time hint waits for: an encounter, a debuff, or another event happening for
// the first time.
export type HintTrigger =
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | {
      readonly kind:
        | "accident"
        | "areaEffect"
        | "card"
        | "drag"
        | "firedOwner"
        | "forcedStop"
        | "fork"
        | "homeButton"
        | "luckyFind"
        | "minorBump"
        | "needSpot"
        | "needUrgent"
        | "pull"
        | "strip"
        | "tip"
        | "treat"
        | "upgrade";
    };

// A one-line hint shown the first time its trigger happens.
export interface Hint {
  readonly text: string;
  readonly trigger: HintTrigger;
}

// How many a condition needs: a number, or "all" of what the game data has.
export type Threshold = number | "all";

// What earns an achievement. Run conditions are judged on one run as it is banked: zones it
// finished (all: every zone of a walk), zones it finished without a bump, dogs it set out
// with, dollars it banked, and zones it finished with the debuff on. Profile conditions are
// judged on the save after a run or a purchase: dogs, gear and dog slots owned (all: every
// one in the data), finished walks with no owner firing you, times fired, distinct dogs that
// finished a walk without firing you (all: every dog), and squirrel chases let happen.
export type AchievementCondition =
  | { readonly count: number; readonly debuff: DebuffId; readonly kind: "debuffZones" }
  | { readonly count: number; readonly kind: "packSize" }
  | { readonly count: number; readonly kind: "squirrelsChased" }
  | { readonly count: number; readonly kind: "timesFired" }
  | { readonly count: number; readonly kind: "walksWithoutFiring" }
  | { readonly count: Threshold; readonly kind: "cleanZones" }
  | { readonly count: Threshold; readonly kind: "dogSlotsOwned" }
  | { readonly count: Threshold; readonly kind: "dogsFinishedWith" }
  | { readonly count: Threshold; readonly kind: "dogsOwned" }
  | { readonly count: Threshold; readonly kind: "gearOwned" }
  | { readonly count: Threshold; readonly kind: "zonesFinished" }
  | { readonly dollars: number; readonly kind: "earnings" };

export type AchievementConditionKind = AchievementCondition["kind"];

// A badge on the Stats page's wall, earned once every condition holds. Celebration only: it
// changes nothing in play. The badge art is badge-<id in kebab case>.
export interface Achievement {
  readonly badgeLine: string;
  readonly conditions: readonly [AchievementCondition, ...AchievementCondition[]];
  readonly goal: string;
  readonly id: string;
  readonly name: string;
  // The goal on the badge wall when the full goal does not fit beside the name.
  readonly shortGoal?: string;
}

export type GameAchievement = Achievement & { readonly id: AchievementId };

export interface GameData {
  // In badge wall order.
  readonly achievements: readonly [GameAchievement, ...GameAchievement[]];
  readonly debuffs: Readonly<Record<DebuffId, Debuff>>;
  // The walker a new player starts with.
  readonly defaultWalker: WalkerId;
  readonly dogSlots: readonly [DogSlot, ...DogSlot[]];
  readonly dogs: Readonly<Record<DogId, Dog>>;
  readonly encounters: Readonly<Record<EncounterId, Encounter>>;
  readonly forcedStops: Readonly<Record<ForcedStopId, ForcedStop>>;
  readonly help: readonly [HelpPage, ...HelpPage[]];
  readonly hints: Readonly<Record<HintId, Hint>>;
  readonly homeText: HomeText;
  readonly menuText: MenuText;
  readonly minorObstacles: Readonly<Record<MinorObstacleId, MinorObstacle>>;
  readonly needCards: Readonly<Record<NeedCardId, NeedCard>>;
  readonly needSpots: Readonly<Record<NeedSpotId, NeedSpot>>;
  readonly needs: Readonly<Record<NeedId, Need>>;
  readonly quips: Readonly<Record<DogId, Quips>>;
  readonly runText: RunText;
  readonly shopGear: Readonly<Record<GearId, Gear>>;
  readonly tuning: LiveTuning;
  readonly upgrades: Readonly<Record<UpgradeId, Upgrade>>;
  readonly walkers: Readonly<Record<WalkerId, Walker>>;
  readonly world: World;
}
