import type { DEBUFFS } from "./debuffs";
import type { DOGS } from "./dogs";
import type { FORCED_STOPS } from "./forcedStops";
import type { SHOP_GEAR } from "./shop";
import type { TUNING } from "./tuning";
import type { UPGRADES } from "./upgrades";
import type { WALKERS } from "./walkers";

// The rule vocabulary: adding a value means new rules code, not only data.
export type EncounterId =
  | "biscuitNeighbour"
  | "lostWallet"
  | "otherDog"
  | "photoOp"
  | "puddle"
  | "skunk"
  | "squirrel"
  | "thief";
export type Energy = "calm" | "hyper" | "steady";
export type Size = "big" | "medium" | "small";
export type Temperament = "dramatic" | "fussy" | "laidBack";
export type TraitId = "chaser" | "fancy" | "foodDriven";

// Ids come from the data, so adding an entry to a value file is a data-only change.
export type DebuffId = keyof typeof DEBUFFS;
export type DogId = keyof typeof DOGS;
export type ForcedStopId = keyof typeof FORCED_STOPS;
export type GearId = keyof typeof SHOP_GEAR;
export type UpgradeId = keyof typeof UPGRADES;
export type WalkerId = keyof typeof WALKERS;

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
    readonly obstaclesFirstZone: number;
    readonly obstaclesGainPerZone: number;
    readonly packSizeMax: number;
    readonly packSizeMin: number;
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
    readonly tip: number;
  };
  readonly multipliers: OpenGroup & {
    readonly heartsByTemperament: Table<Temperament>;
    readonly scrollSpeedGainPerZone: number;
    readonly tipByPackSize: Table<number>;
  };
  readonly pixels: OpenGroup & { readonly roadScrollSpeed: number };
  readonly probability: OpenGroup & { readonly catchBySize: Table<Size> };
  readonly seconds: OpenGroup & {
    readonly inputLockBySize: Table<Size>;
    readonly pullIntervalByEnergy: Table<Energy>;
    readonly pullTell: number;
    readonly zoneAtBaseSpeed: number;
  };
}

export interface Owner {
  readonly name: string;
  readonly role: string;
  readonly temperament: Temperament;
}

export interface Dog {
  readonly breed: string;
  readonly energy: Energy;
  readonly look: string;
  readonly name: string;
  readonly owner: Owner;
  readonly size: Size;
  readonly trait: TraitId;
  // "start": unlocked from the first run; "shop": bought for money.prices.lockedDog.
  readonly unlock: "shop" | "start";
}

// Which dogs an effect reaches, among the dogs still in the pack. "affected" is the dogs
// the encounter affected; "randomOne" is one dog drawn at random.
export type Target =
  | { readonly kind: "affected" }
  | { readonly kind: "all" }
  | { readonly kind: "randomOne" }
  | { readonly kind: "temperament"; readonly temperament: Temperament }
  | { readonly kind: "trait"; readonly trait: TraitId };

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
  | "pullFrequency"
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

export interface SkipOptionEffect {
  readonly kind: "skipOption";
  readonly usesPerRun: CountKey;
}

export type Effect =
  | DebuffEffect
  | HeartsEffect
  | ImmuneEffect
  | ModifierEffect
  | MoneyEffect
  | SkipOptionEffect
  | TreatsEffect;

export type EffectKind = Effect["kind"];

export interface CardOption {
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

// "obstacle": hit by accident; "lucky": a good thing to bump into.
// No card opens when no dog is affected, when the pack is immune, or when noCardWhen holds.
export interface Encounter {
  readonly affects: AffectRule;
  readonly kind: "lucky" | "obstacle";
  readonly name: string;
  readonly noCardWhen?: Condition;
  readonly options: CardOptions;
}

export interface ForcedStop {
  readonly name: string;
  readonly options: CardOptions;
}

export interface Upgrade {
  readonly effects: NonEmptyEffects;
  readonly kind: "boost" | "tradeOff";
  readonly name: string;
}

export interface Gear {
  readonly effects: NonEmptyEffects;
  readonly name: string;
  readonly price: PriceKey;
}

export interface Debuff {
  readonly duration: Duration;
  readonly modifiers: readonly Modifier[];
  readonly name: string;
}

// "start": available from the first run; "shop": bought, at a price not set yet.
export interface Walker {
  readonly name: string;
  // Key of the walker's sprite in the art manifest.
  readonly spriteKey: string;
  readonly unlock: "shop" | "start";
}

export interface Zone {
  readonly id: string;
  readonly name: string;
  // Hex colours from the art palette.
  readonly roadColor: string;
  readonly roadShadowColor: string;
}

export interface World {
  readonly name: string;
  // Walked in this order.
  readonly zones: readonly [Zone, ...Zone[]];
}

export type QuipMoment = "fired" | "happier" | "upset";
export type Quips = Readonly<Record<QuipMoment, readonly string[]>>;

export interface GameData {
  readonly debuffs: Readonly<Record<DebuffId, Debuff>>;
  readonly dogs: Readonly<Record<DogId, Dog>>;
  readonly encounters: Readonly<Record<EncounterId, Encounter>>;
  readonly forcedStops: Readonly<Record<ForcedStopId, ForcedStop>>;
  readonly quips: Readonly<Record<Temperament, Quips>>;
  readonly shopGear: Readonly<Record<GearId, Gear>>;
  readonly tuning: LiveTuning;
  readonly upgrades: Readonly<Record<UpgradeId, Upgrade>>;
  readonly walkers: Readonly<Record<WalkerId, Walker>>;
  readonly world: World;
}
