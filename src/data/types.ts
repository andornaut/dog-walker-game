import type { ACHIEVEMENTS } from "./achievements";
import type { DEBUFFS } from "./debuffs";
import type { DOGS } from "./dogs";
import type { ENCOUNTERS } from "./encounters";
import type { HINTS } from "./hints";
import type { MINOR_OBSTACLES } from "./minorObstacles";
import type { SHOP_GEAR } from "./shop";
import type { TUNING } from "./tuning";
import type { UPGRADES } from "./upgrades";
import type { WALKER_PERKS, WALKERS } from "./walkers";
import type { WORLD } from "./world";

// The rule vocabulary: adding a value means new rules code, not only data.
export type EncounterId =
  "lostWallet" | "otherDog" | "pettingNeighbor" | "puddle" | "skunk" | "squirrel" | "thief";
// How many dogs a walk sets out with.
export type PackSize = 1 | 2 | 3;
export type Size = "big" | "medium" | "small";
// Lifetime counts the save keeps across walks for the badges: small dogs' dodges, landed
// squirrel pulls, tips and treats grabbed, and the card options and lucky finds that name one as
// their tally.
export type TallyId =
  | "dodges"
  | "neighborsMet"
  | "sniffs"
  | "squirrelPulls"
  | "thievesLetGo"
  | "tips"
  | "treats"
  | "walletsFound";

// Ids come from the data, so adding an entry to a value file is a data-only change.
export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
export type DebuffId = keyof typeof DEBUFFS;
export type DogId = keyof typeof DOGS;
export type GearId = keyof typeof SHOP_GEAR;
export type HintId = keyof typeof HINTS;
export type MinorObstacleId = keyof typeof MINOR_OBSTACLES;
export type UpgradeId = keyof typeof UPGRADES;
export type WalkerId = keyof typeof WALKERS;
export type WalkerPerkId = keyof typeof WALKER_PERKS;
export type ZoneId = (typeof WORLD)["zones"][number]["id"];

type EncounterOfKind<Kind extends Encounter["kind"]> = {
  [Id in EncounterId]: (typeof ENCOUNTERS)[Id]["kind"] extends Kind ? Id : never;
}[EncounterId];
type LuckyEncounterId = EncounterOfKind<"lucky">;
export type ObstacleEncounterId = EncounterOfKind<"obstacle">;

// The tuning as the game reads it: every value is a number, so a live edit type-checks.
export type LiveTuning = typeof TUNING;
export type UnitGroup = keyof LiveTuning;

// Only keys whose value is a number, so a nested table can never be named as an amount.
export type NumberKeys<Group> = {
  [K in keyof Group]: Group[K] extends number ? K : never;
}[keyof Group];

// Keys into one unit group of the tuning, so a key from the wrong unit is a type error.
type CountKey = NumberKeys<LiveTuning["counts"]>;
type HeartsKey = NumberKeys<LiveTuning["hearts"]>;
export type MoneyKey = NumberKeys<LiveTuning["money"]>;
export type MultiplierKey = NumberKeys<LiveTuning["multipliers"]>;
export type SecondsKey = NumberKeys<LiveTuning["seconds"]>;
export type PriceKey = keyof LiveTuning["money"]["prices"];
export type ProbabilityKey = NumberKeys<LiveTuning["probability"]>;

type Table<Key extends PropertyKey> = Readonly<Record<Key, number>>;
type OpenGroup = Readonly<Record<string, number | Table<string>>>;

// The values the rules read by name; each group may hold more keys for cards to name.
export interface Tuning {
  readonly counts: OpenGroup & {
    readonly dartLanesPerSecond: number;
    readonly maxDartMovers: number;
    readonly maxMovers: number;
    readonly maxSlowVehicles: number;
    readonly minorObstaclesFirstZone: number;
    readonly minorObstaclesGainPerZone: number;
    readonly obstaclesFirstZone: number;
    readonly obstaclesGainPerZone: number;
    readonly packSizeMax: number;
    readonly tipsFirstZone: number;
    readonly tipsGainPerZone: number;
    readonly treatsPerZone: number;
  };
  readonly hearts: OpenGroup & {
    readonly maxBySize: Table<Size>;
    readonly maxOwnerHearts: number;
    readonly packSizeBonus: Table<PackSize>;
    readonly treat: number;
  };
  readonly money: OpenGroup & {
    readonly payPerDog: number;
    readonly prices: Table<string>;
    readonly startPurse: number;
    readonly tip: number;
  };
  readonly multipliers: OpenGroup & {
    readonly scrollSpeedGainPerZone: number;
  };
  readonly pixels: OpenGroup & { readonly roadScrollSpeed: number };
  readonly probability: OpenGroup & { readonly smallDodgeChance: number };
  readonly seconds: OpenGroup & {
    readonly ballBounceSeconds: number;
    readonly firingHoldSeconds: number;
    readonly hitStopSeconds: number;
    readonly lookAheadSeconds: number;
    readonly minorHitStopSeconds: number;
    readonly moverHopSeconds: number;
    readonly moverStepSeconds: number;
    readonly moverWarningSeconds: number;
    readonly pathReactionMargin: number;
    readonly pullReactionWindow: number;
    readonly pullTell: number;
    readonly zoneAtBaseSpeed: number;
  };
}

// "start": owned from the first run; "shop": bought on the home screen at its price.
export type Unlock =
  { readonly price: PriceKey; readonly unlock: "shop" } | { readonly unlock: "start" };

export interface Owner {
  readonly name: string;
  readonly role: string;
}

export type Dog = Unlock & {
  // The name in the dog's art keys: dog-<art> and its depth variants, face-dog-<art>,
  // portrait-dog-<art>, face-owner-<art>, face-owner-<art>-20, owner-<art> and the <art> tag of
  // ui-dog-card.
  readonly art: string;
  readonly breed: string;
  readonly look: string;
  readonly name: string;
  readonly owner: Owner;
  readonly size: Size;
};

// Which dogs an effect reaches, among the dogs still in the pack. "affected" is the dogs
// the encounter affected.
export type Target = { readonly kind: "affected" } | { readonly kind: "all" };

// "nextZone": the whole of the next zone.
export type Duration = "nextZone" | "run";

// Stats a modifier changes. An "add" names a key in the stat's own unit group.
// How many lanes beside the pack's tips and treats are grabbed from, and how many encounter
// cards each zone cost no money.
type CountStat = "freeCards" | "tipReach" | "treatReach";
// forgivenHearts: how many of the first hearts lost in each zone are forgiven.
type HeartsStat = "forgivenHearts" | "maxHearts";
type MoneyStat = "startMoney" | "tipValue";
export type Stat =
  | CountStat
  | HeartsStat
  | MoneyStat
  // How many hearts a minor bump costs.
  | "bumpHearts"
  // How long a debuff lasts.
  | "debuffSeconds"
  // The walker's agility: how many times faster than the base the pack changes lanes.
  | "agility"
  | "obstacleSpawns"
  // How many pulls a squirrel draws.
  | "squirrelPulls"
  | "tipSpawns"
  | "treatSpawns";

// duration is absent for gear, which lasts every run it is taken on.
export type Modifier = { readonly duration?: Duration } & (
  | { readonly by: CountKey; readonly operation: "add"; readonly stat: CountStat }
  | { readonly by: HeartsKey; readonly operation: "add"; readonly stat: HeartsStat }
  | { readonly by: MoneyKey; readonly operation: "add"; readonly stat: MoneyStat }
  | { readonly by: MultiplierKey; readonly operation: "add"; readonly stat: "agility" }
  | { readonly by: MultiplierKey; readonly operation: "multiply"; readonly stat: Stat }
);

type HeartsDelta = -3 | -2 | -1 | 1 | 2 | 3;

// Applies once, whatever the pack size.
export interface MoneyEffect {
  readonly amount: MoneyKey;
  readonly change: "gain" | "lose";
  readonly kind: "money";
}

// Per owner.
export interface HeartsEffect {
  readonly amount: HeartsDelta;
  readonly kind: "hearts";
  readonly target: Target;
}

interface DebuffEffect {
  readonly debuff: DebuffId;
  readonly kind: "debuff";
}

// No card opens for the encounter while the pack is immune to it.
interface ImmuneEffect {
  readonly duration: Duration;
  readonly encounter: EncounterId;
  readonly kind: "immune";
}

export type ModifierEffect = Modifier & { readonly kind: "modifier" };

// A plain hit that would land on a dog of one of sizes misses it at chance, costing nothing, as
// a small dog's dodge does, for the rest of the walk. It adds to a small dog's own chance.
export interface DodgeEffect {
  readonly chance: ProbabilityKey;
  readonly kind: "dodge";
  readonly sizes: readonly [Size, ...Size[]];
}

// A free Skip on every obstacle card until it is taken, once per walk.
interface SkipOptionEffect {
  readonly kind: "skipOption";
}

export type Effect =
  | DebuffEffect
  | DodgeEffect
  | HeartsEffect
  | ImmuneEffect
  | ModifierEffect
  | MoneyEffect
  | SkipOptionEffect;

export interface CardOption {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  // Picking it counts one toward this lifetime tally.
  readonly tally?: TallyId;
  readonly effects: readonly Effect[];
  readonly name: string;
}

// Cards show two or three options side by side.
export type CardOptions =
  readonly [CardOption, CardOption] | readonly [CardOption, CardOption, CardOption];

type NonEmptyEffects = readonly [Effect, ...Effect[]];

// The encounter opens a card of options.
interface CardResolution {
  readonly kind: "card";
  readonly options: CardOptions;
}

// The encounter applies its effects on contact, with a popup instead of a card. art is the
// popup's illustration. Finding it counts one toward the lifetime tally.
interface InstantResolution {
  readonly art: string;
  readonly effects: NonEmptyEffects;
  readonly kind: "instant";
  readonly tally: TallyId;
}

// The obstacle applies its effects to the whole pack as it is touched, with a plain obstacle's
// hit stop and no card.
interface ContactResolution {
  readonly effects: NonEmptyEffects;
  // What an immunity to the obstacle does, as an effect's text says it, lower case: "puddles
  // don't muddy the pack".
  readonly immuneText: string;
  readonly kind: "contact";
}

// Touching the obstacle does nothing: its only cost is the dogs pulling toward it.
interface PullResolution {
  readonly kind: "pull";
}

// What an obstacle covers on the road: lanes across and rows along it. One row is a lane-width
// of road. The rulebook allows no obstacle wider than 3 lanes.
interface Shape {
  readonly lanes: 1 | 2 | 3;
  readonly rows: 1 | 2 | 3;
}

// How many times a mover moves: a count from min to max, both included, drawn per mover as it is
// planned. A fixed count has min equal to max.
export interface MoveCount {
  readonly max: number;
  readonly min: number;
}

// A dart's tilt, drawn per dart from min to max: above 0 it comes down the road faster than the
// road, below 0 slower, at 0 with it.
export interface Tilt {
  readonly max: number;
  readonly min: number;
}

// How an obstacle moves when it comes as a mover, its first move after a cue
// seconds.moverWarningSeconds long and each later one with no cue, and only while the mover is
// still ahead of the pack's rows. A stepper's or hopper's later moves run back to back. approach: steps steps toward
// the pack, each to the spot a lane to either side, a row down or diagonally down that is nearest
// the pack as the step is chosen, seconds.moverStepSeconds each; the first's cue
// seconds.approachFirstDelayMin to approachFirstDelayMax after it is wholly on the road, each later
// one, with no cue of its own, once the step before has ended and the road left between it and the
// pack is multipliers.approachSecondRoadShareMin to Max of the road's length. dart: across the road
// at counts.dartLanesPerSecond, coming down it at 1 + tilt of the road's speed meanwhile, its tilt
// drawn per dart from its range cut to the steepest the zone's pace leaves a start for, setting
// off multipliers.dartStartRoadShareMin to Max of the road ahead of the pack, drawn per dart and
// never so low that the pack has less than seconds.pathReactionMargin after its cue (above Max
// for a steep enough tilt), nor so high that its cue is off the road; one that has crossed by the
// time it reaches the pack's rows passes harmlessly. A dart turns back at turnBackShare of its
// kind, drawn per dart: with no cue, once it has crossed multipliers.dartTurnAtShareMin to Max of
// the road, drawn per dart, it crosses the whole road back the other way at its tilt. inLane:
// down its lane at factor of the
// road's speed, above 1 toward the pack, below 1 away. hop: times jumps, each of 1 to most spots one way, lanes
// to either side or, unless sideways, a row up the road or diagonally up, landing
// seconds.moverHopSeconds after it leaves; a shy hopper, at probability.shyHopperShare of its
// kind drawn per mover, instead makes each hop away from the pack, starting once the road between
// it and the pack's rows is down to seconds.shyHopNearSeconds of the road's travel, ending in
// neither the pack's lane nor one it is moving into, no nearer it across the road, and at most
// most rows up the road. step: steps spots, each a lane to either side or a row
// toward or away, seconds.moverStepSeconds each.
// Each mover's speed varies by up to multipliers.moverSpeedJitter either way, and each step and
// hop comes up to seconds.moverTimingJitter late.
export type Movement =
  | { readonly kind: "approach"; readonly steps: MoveCount }
  | { readonly kind: "dart"; readonly tilt: Tilt; readonly turnBackShare: number }
  | {
      readonly kind: "hop";
      readonly most: 1 | 2;
      readonly shy?: true;
      readonly sideways?: true;
      readonly times: MoveCount;
    }
  | { readonly kind: "inLane"; readonly factor: number }
  | { readonly kind: "step"; readonly steps: MoveCount };
export type MovementKind = Movement["kind"];

// "obstacle": hit by accident. A card obstacle opens a card for the whole pack, with hitLabel
// shown large as it hits; a contact obstacle applies its effects as it is touched; a pull
// obstacle does nothing when touched. An obstacle the pack is immune to is harmless. "lucky": a
// good thing to bump into, one cell big, applied on contact with no card. An obstacle or lucky
// encounter with a movement comes as a mover at the zone's moverShare; a lucky one stays a prize
// as it moves, never something the pack steers around. hitWord is the comic word drawn in
// font-comic over its hit burst: A to Z, ! ? - and space.
export type Encounter = {
  readonly name: string;
} & (
  | {
      readonly kind: "lucky";
      readonly movement?: Movement;
      readonly resolution: InstantResolution;
    }
  | ({
      readonly hitWord: string;
      readonly kind: "obstacle";
      readonly movement?: Movement;
      readonly shape: Shape;
    } & (
      | { readonly hitLabel: string; readonly resolution: CardResolution }
      | { readonly resolution: ContactResolution | PullResolution }
    ))
);

// An obstacle that opens no card: bumping it costs the touching dog's owner hearts.bump, as
// bumpHearts modifiers such as Muddy's change it, and never money; the dog it lands on may
// dodge it.
// The hit stops the road for seconds.minorHitStopSeconds, showing hitLabel when it has one.
// Each zone's weights set how often it appears there. One with a movement comes as a mover at
// the zone's moverShare.
export interface MinorObstacle {
  readonly hitLabel?: string;
  readonly movement?: Movement;
  readonly name: string;
  readonly shape: Shape;
}

// How long an upgrade card's effects last: applied at once, through the next zone, or for
// the rest of the run.
export type UpgradeDuration = "nextZone" | "now" | "run";

// effect is what the upgrade does in a line, as a fork's path card shows it.
export interface Upgrade {
  // Key of the card's illustration in the art manifest's images.
  readonly art: string;
  readonly duration: UpgradeDuration;
  readonly effect: string;
  readonly effects: NonEmptyEffects;
  readonly kind: "boost" | "tradeOff";
  readonly name: string;
}

export interface Gear {
  readonly effects: NonEmptyEffects;
  readonly name: string;
  readonly price: PriceKey;
  // Its effect in a few words, on its shop row.
  readonly short: string;
}

// The dog slots in order. A run takes at most one dog per owned slot.
export type DogSlot = Unlock;

// "start": walks from the first run; "finishZone": unlocked the first time any walk finishes
// its zone-th zone, counting from 1.
// A walker walks from the start, or unlocks the first time a walk finishes zone.
type WalkerUnlock =
  { readonly unlock: "finishZone"; readonly zone: ZoneId } | { readonly unlock: "start" };

// A walker's perk: its name, its effect in one line, and its effects, which last every walk the
// walker walks, as gear's do.
export interface WalkerPerk {
  readonly effect: string;
  readonly effects: NonEmptyEffects;
  readonly name: string;
}

// A walker the player can pick, walking with its agility and the effects of its perk. agility
// multiplies the pack's lane-change speed. spriteKey and portraitKey are keys into the art
// manifest.
// greeting is what the walker says as they join, the first time a walk finishes the zone that
// unlocks them.
export type Walker = WalkerUnlock & {
  readonly agility: number;
  readonly greeting: string;
  readonly name: string;
  readonly perk: WalkerPerkId;
  readonly portraitKey: string;
  readonly spriteKey: string;
};

// A debuff lasts its seconds of walking, a time that stops during a hit stop and under a card,
// and never past the zone's end. Nothing cures it. stake is what it does, as a card states it
// after the debuff's name, its {seconds} filled with how long it would last. Its modifiers
// change stats while it lasts; one the rules act on by id, such as Zoomies' drift, has none.
export interface Debuff {
  readonly modifiers: readonly Modifier[];
  readonly name: string;
  readonly seconds: SecondsKey;
  readonly stake: string;
}

// Paws out of 5 on a fork's path card.
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// How often each kind is drawn in a zone, relative to the others of its group. 0 keeps it out
// of the zone; each group needs at least one kind above 0.
export interface ZoneWeights {
  readonly luckyFinds: Readonly<Record<LuckyEncounterId, number>>;
  readonly minorObstacles: Readonly<Record<MinorObstacleId, number>>;
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
  // The share of the zone's obstacles, minor or not, whose look has a movement that come as
  // movers, from 0 to 1.
  readonly moverShare: number;
  readonly name: string;
  readonly roadColor: string;
  readonly roadShadowColor: string;
  // Multiplies the scroll speed, on top of multipliers.scrollSpeedGainPerZone.
  readonly speed: number;
  readonly weights: ZoneWeights;
}

export interface World {
  // The id of the zone every walk starts in, and of the zone every walk ends in.
  readonly firstZone: string;
  readonly lastZone: string;
  readonly name: string;
  // How many zones a walk visits, none twice.
  readonly walkLength: number;
  // From easiest to hardest: a fork's paths keep this order, left to right.
  readonly zones: readonly [Zone, ...Zone[]];
}

// One page of the "How to walk" help screen, shown in list order.
// The help pages' pictures of the walk screen, each drawn by the game.
export type HelpPictureId = "cards" | "lanes" | "owners" | "pickups" | "pulls" | "zones";

export interface HelpPage {
  // The picture the page shows.
  readonly art: HelpPictureId;
  readonly body: string;
  readonly title: string;
}

interface AgilityWord {
  readonly from: number;
  readonly word: string;
}

// The home screen's text. A {name} in a line is filled by code, and each line may use only
// the names src/home/homeText.ts lists for it.
export interface HomeText {
  // An agility's word, by band: the word of the last band whose from the agility reaches, in
  // ascending order.
  readonly agilityWords: readonly [AgilityWord, ...AgilityWord[]];
  // The walker's speech bubble, by what happened last. Picking a dog shows its owner's
  // parting quip instead.
  readonly bubble: {
    readonly afterFiring: string;
    readonly afterWalk: string;
    readonly firstVisit: string;
    // Said in place of afterWalk after each of the player's first few walks.
    readonly howTo: string;
    readonly newAffordable: string;
    // After a walk that unlocked a walker.
    readonly newWalker: string;
    readonly noWalker: string;
  };
  // A held dog or gear tile's detail card: the dog's rows, the gear card's subtitle and
  // status, the price status of anything not owned yet, and a locked dog's subtitle.
  readonly detail: {
    readonly dogFee: string;
    // A heavy dog's row, under its size and hearts: it slows lane changes.
    readonly dogHeavy: string;
    readonly dogKind: string;
    readonly dogOwner: string;
    readonly dogStatus: string;
    readonly dogTotals: string;
    readonly gearEquipped: string;
    readonly gearOwned: string;
    readonly gearSubtitle: string;
    readonly priceBuy: string;
    readonly priceLocked: string;
    // A walker's detail card's agility word and perk with its effect.
    readonly walkerAgility: string;
    readonly walkerPerk: string;
    readonly walkerStatus: string;
    readonly walkerSubtitle: string;
  };
  // A dodge effect's text, as a gear item's detail card shows it: the {sizes} of dogs it
  // reaches, joined as a sentence lists them, and its chance as one in {dodgeIn}.
  readonly dodgeEffect: string;
  readonly dogBought: string;
  readonly dogCantAfford: string;
  // A dog slot's name in the purchase line.
  readonly dogSlotName: string;
  // The words an effect's text is built from, wherever it shows: what each duration adds, a
  // freeCards modifier's line for one free card and for {count}, a hearts change to each owner
  // (its signed {hearts}), the text of no effects at all, a free Walk on by's line, and each
  // stat's name.
  readonly effect: {
    readonly durations: { readonly [D in Duration]: string };
    readonly freeCard: string;
    readonly freeCards: string;
    readonly heartsEach: string;
    readonly nothing: string;
    readonly skipOption: string;
    readonly stats: { readonly [S in Stat]: string };
  };
  // The info line for a dog or gear tile the keyboard focuses: an owned dog's, a locked dog's
  // with its price and not its name, a gear item's with its price while locked, and the parts
  // they are built from.
  readonly focus: {
    readonly dogLocked: string;
    readonly dogOwned: string;
    readonly gear: string;
    readonly gearLocked: string;
    readonly kind: string;
    readonly priceBuy: string;
    readonly priceShort: string;
  };
  // The street sign on the gate art.
  readonly gateSign: string;
  readonly gearBought: string;
  // Said first in the walker's bubble while a later version of the game holds the save: asks
  // the player to reload.
  readonly newerSave: string;
  // What the walker says after a tap that changes nothing: the pack is full, or sound
  // toggled.
  readonly noticePackFull: string;
  readonly noticeSoundOff: string;
  readonly noticeSoundOn: string;
  // The Dogs section's band, before a heart: the most hearts the chosen pack's size raises a
  // picked dog's owner's max by.
  readonly packBonus: string;
  readonly packCount: string;
  // The Pocket section's heading, and its band's note while nothing is pocketed.
  readonly pocket: {
    readonly note: string;
    readonly title: string;
  };
  // The Walker and Dogs section headings, and what the Walker band asks for with nothing
  // picked.
  readonly sectionDogs: string;
  readonly sectionWalker: string;
  readonly sectionWalkerPrompt: string;
  // The words that join names in a sentence, as "Jesse, Rosa and Kim": between joins all but
  // the last two, and beforeLast the last two. The card's firing warning uses them too.
  readonly sentenceList: {
    readonly beforeLast: string;
    readonly between: string;
  };
  // The Pet shop page: its title, its tabs, the headings over its lists and their notes, a
  // dog slot row's line, the line of a slot that needs the one before it, and the word on an
  // owned row.
  readonly shop: {
    // The confirm every purchase asks first: its Buy and Cancel buttons, the {amount} the bank
    // would keep, and its title with the item's {name}.
    readonly confirmBuy: string;
    readonly confirmCancel: string;
    readonly confirmLeft: string;
    readonly confirmTitle: string;
    readonly dogs: string;
    readonly dogsAllOwned: string;
    readonly owned: string;
    // The note right of each list's heading: {owned} of the list's {max} purchases.
    readonly ownedCount: string;
    readonly slotFirst: string;
    readonly slotLine: string;
    readonly slots: string;
    readonly tabs: { readonly dogs: string; readonly gear: string };
    readonly title: string;
  };
  readonly slotBought: string;
  // Start walk's label while the walk waits for its art to load.
  readonly startLoading: string;
  readonly startWalk: string;
  // Said first in the walker's bubble while the browser keeps no save.
  readonly unsaved: string;
  // What the bubble says for an owned walker picked or focused: its agility and perk.
  readonly walkerInfo: string;
  // What a locked walker's hold card and a tap on its tile say: the goal that unlocks it.
  readonly walkerLocked: string;
}

// The walk's own text. card is the choice cards': the titles and subtitles a card's data
// does not name, the Skip card, and the cost plaque's words. fired is the firing plate's
// word, homeQuestion is what the walk bar's Home button asks, with its two answers, and
// lowHearts is the chip over a dog card down to its last heart, naming its owner. A {name} in a line is filled
// by code, and each line may use only the names src/hud/runText.ts lists for it. firedBy
// names an owner who fires you, and card.fires flags an option that would fire owners.
export interface RunText {
  readonly card: {
    readonly fires: string;
    // A fork's path card plaque, with the zone's fee multiplier.
    readonly forkFees: string;
    readonly forkSubtitle: string;
    readonly forkTitle: string;
    // A plaque whose cost a modifier, such as Sweet talker, waived, after the struck price; and
    // the plaque of the Skip a modifier, such as Hall pass, offers.
    readonly free: string;
    // In an option's text, in place of a dog's heart loss Second chance would forgive; it may
    // name the loss as {hearts}.
    readonly heartForgiven: string;
    // A money option's plaque, with its price.
    readonly need: string;
    readonly pickOne: string;
    readonly skip: string;
    // The Skip card's effect on its face, and in its body when held.
    readonly skipEffect: string;
    readonly skipHeld: string;
    // An upgrade card's plaque, by how long it lasts.
    readonly upgradeDuration: { readonly [D in UpgradeDuration]: string };
  };
  // What a change's floating label names a base cause by (the Full pack bonus, a bump, a
  // zone's pay, a tip or a treat), and atMax for a meter held at its max.
  readonly causes: {
    readonly atMax: string;
    readonly bonus: string;
    readonly bump: string;
    readonly pay: string;
    readonly tip: string;
    readonly treat: string;
  };
  // The comic words drawn in font-comic (A to Z, ! ? - and space): bark in place of a dog's
  // bark, dodge over a dog that dodged a hit.
  readonly comicWords: { readonly bark: string; readonly dodge: string };
  // Over a dog that dodged a hit, with reduced motion or while fx-dodge is missing.
  readonly dodge: string;
  // The walk's lines on the detail card a still press held on the walk HUD opens, which shows a
  // dog card and a gear or walker-perk icon as the home screen's Details do. debuffStatus: a
  // debuff bar's status, under its stake (its {seconds} the seconds it has left). dogHearts: a
  // dog card's status, its owner's hearts now and their max. upgradeStatus: an upgrade icon's
  // status, under its effect.
  readonly explain: {
    readonly debuffStatus: string;
    readonly dogHearts: string;
    // A held dog card's row for each source of its owner's extra max hearts: {name} is the
    // gear's name, such as Lucky collar's, or smallPack for the lead dog's pack-size bonus.
    readonly extraHearts: string;
    readonly smallPack: string;
    readonly upgradeStatus: string;
  };
  readonly fired: string;
  readonly firedBy: string;
  // Over a dog whose owner's heart loss Second chance forgave.
  readonly forgiven: string;
  // The end screen's line when every dog set out with got home after the last zone.
  readonly fullPackHome: string;
  // keep is what going home keeps (the walk's money so far), lose the fees the current zone
  // would pay the dogs still walking, and zonesLeft the zones after this one, shown when any are.
  // lose is the zone's pay given up, loseWithBonus that and the Full pack bonus, and
  // loseBonus the bonus alone, at a fork.
  readonly homeQuestion: {
    readonly headHome: string;
    readonly keepWalking: string;
    readonly lose: string;
    readonly loseBonus: string;
    readonly loseWithBonus: string;
    readonly title: string;
    readonly zonesLeft: string;
  };
  readonly lowHearts: string;
  // A debuff's length in seconds on a struck chip, such as Calm voice's "8s" then "4s".
  readonly seconds: string;
  // The zone celebration as a walker joins, the first time a walk finishes the zone that
  // unlocks them: its headline (a big title of about 14 characters over a subtitle of about
  // 28), their agility and perk under their greeting, and the button.
  readonly newWalker: {
    readonly button: string;
    readonly info: string;
    readonly subtitle: string;
    readonly title: string;
  };
  // The message strip's lines: achievement names a badge earned on the way, debuffStart and
  // debuffEnd announce each debuff, and the rest say what just happened on the road.
  readonly strip: {
    readonly achievement: string;
    readonly debuffEnd: { readonly [D in DebuffId]: string };
    readonly debuffStart: { readonly [D in DebuffId]: string };
    readonly dodge: string;
    // At a walk's start, for gear that changes it from the start, such as Running shoes: the
    // gear's name and short line.
    readonly effectStart: string;
    readonly fired: string;
    readonly fullPackHome: string;
    // At a walk's start, for each heavy dog in the pack, which slows lane changes.
    readonly heavyDog: string;
    readonly kindWords: string;
    readonly lowHearts: string;
    readonly luckyNeighbor: string;
    readonly luckyWallet: string;
    // While Muddy, an owner left one Muddy bump from firing you, above their last heart.
    readonly muddyHearts: string;
    readonly plainHit: string;
    readonly pull: string;
    readonly treat: string;
  };
  // The walk bar's place in the walk beside the neighborhood's name: the zone's number, n, of
  // the walk's total.
  readonly zoneProgress: string;
  // The heading of the banner each zone opens with, over the zone's name: {world} is the
  // world's name and {n} the zone's place in the walk, from 1.
  readonly zoneBanner: string;
  // The zone celebration after any other zone but the last: its headline, as newWalker's,
  // and the zone's fees and tips.
  readonly zoneDone: {
    readonly earnings: string;
    readonly subtitle: string;
    readonly title: string;
  };
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
    // The breakdown's lines, by what the money came from.
    readonly earnings: {
      readonly cardCosts: string;
      readonly fees: string;
      readonly fullPack: string;
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
    // A locked badge's progress across walks, under its goal on the wall.
    readonly badgeProgress: string;
    readonly badges: string;
    readonly dogColumns: {
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
    // The overall rows; bestRunDogs labels the first of the best walk's dogs, one per row,
    // and bestRunZones its neighborhoods finished.
    readonly overall: {
      readonly bestRun: string;
      readonly bestRunDogs: string;
      readonly bestRunZones: string;
      readonly bestZone: string;
      readonly dogsWalked: string;
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
// Two or more lines per moment, one drawn at random.
export type Quips = Readonly<Record<QuipMoment, readonly [string, string, ...string[]]>>;

// What a first-time hint waits for: an encounter, a debuff, or another event happening for
// the first time (moverCue: a mover's arrow cue showing on the road; packBonus: a walk
// starting with a pack-size bonus for its lead dog's owner).
export type HintTrigger =
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | {
      readonly kind:
        | "card"
        | "drag"
        | "firedOwner"
        | "fork"
        | "homeButton"
        | "luckyFind"
        | "minorBump"
        | "moverCue"
        | "packBonus"
        | "pull"
        | "pullLanded"
        | "tip"
        | "treat";
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
// with, dollars it banked, times it got the debuff, distinct lucky finds it found (all: every
// lucky find in the data), a finished walk with a walking owner on their last heart, and a
// finished walk that paid the Full pack bonus for a pack of at least packSize. Profile
// conditions are judged on the save after a run or a purchase: dogs, gear, dog slots and
// walkers owned (all: every one in the data), finished walks with no owner firing you, times
// fired, distinct owners who fired you (all: every dog's owner), distinct dogs that finished a
// walk without firing you (all: every dog), distinct walkers who finished a walk (all: every
// walker), distinct zones finished across walks (all: every zone of the world), walks played,
// dollars banked across walks, landed plain bumps by any of kinds across walks, and a lifetime
// tally.
export type AchievementCondition =
  | {
      readonly count: number;
      readonly kind: "bumps";
      readonly kinds: readonly [MinorObstacleId, ...MinorObstacleId[]];
    }
  | { readonly count: number; readonly debuff: DebuffId; readonly kind: "debuffsGot" }
  | { readonly count: number; readonly kind: "packSize" }
  | { readonly count: number; readonly kind: "tally"; readonly tally: TallyId }
  | { readonly count: number; readonly kind: "timesFired" }
  | { readonly count: number; readonly kind: "walksPlayed" }
  | { readonly count: number; readonly kind: "walksWithoutFiring" }
  | { readonly count: Threshold; readonly kind: "cleanZones" }
  | { readonly count: Threshold; readonly kind: "dogSlotsOwned" }
  | { readonly count: Threshold; readonly kind: "dogsFinishedWith" }
  | { readonly count: Threshold; readonly kind: "dogsOwned" }
  | { readonly count: Threshold; readonly kind: "firedByOwners" }
  | { readonly count: Threshold; readonly kind: "gearOwned" }
  | { readonly count: Threshold; readonly kind: "luckyFinds" }
  | { readonly count: Threshold; readonly kind: "walkersFinishedWith" }
  | { readonly count: Threshold; readonly kind: "walkersUnlocked" }
  | { readonly count: Threshold; readonly kind: "zonesEverFinished" }
  | { readonly count: Threshold; readonly kind: "zonesFinished" }
  | { readonly dollars: number; readonly kind: "earnings" }
  | { readonly dollars: number; readonly kind: "lifetimeEarnings" }
  | { readonly kind: "finishOnLastHeart" }
  | { readonly kind: "fullPackBonus"; readonly packSize: number };

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

type GameAchievement = Achievement & { readonly id: AchievementId };

// Where an ambient mover goes. Ambient movers are scenery: they never touch the road, collide,
// or change anything in play.
// - crossStreet: along the backdrop's cross street, in the near lane going right or the far
//   lane going left.
// - crossWalk: along one of the cross street's sidewalks, either way.
// - sidewalkAway, sidewalkToward: along a sidewalk beside the road (on the lawn's edge where
//   there is none), walking away from or toward the walker.
// - sky: across the backdrop band's top rows, above the skyline, either way, at full size, its
//   feet on a row drawn from its rows.
// - verge: on the lawn or paving beside the road. A steady mover darts in from the screen's
//   side, stops, and darts back out; a hopper or flier starts there and leaves the same way.
type AmbientPath =
  "crossStreet" | "crossWalk" | "sidewalkAway" | "sidewalkToward" | "sky" | "verge";

// How a mover covers its path: steadily, in bursts of one or two hops with a pause between
// them, or rising as it goes.
export type AmbientGait = "fly" | "hop" | "steady";

// One kind of ambient mover in a zone: its sprite and the tag it plays while moving, its path
// and gait, its speed while moving (band pixels a second on the cross street, its sidewalks
// and in the sky, road pixels a second beside the road) and how often one sets out, per minute.
// rows, for a sky mover, is the range its feet row is drawn from, in band pixels, from..to
// inclusive; without it, the plane's (SKY_ROWS in src/road/ambient.ts).
export interface AmbientMover {
  readonly gait: AmbientGait;
  readonly key: string;
  readonly path: AmbientPath;
  readonly perMinute: number;
  readonly rows?: { readonly from: number; readonly to: number };
  readonly speed: number;
  readonly tag: string;
}

export interface GameData {
  // In badge wall order.
  readonly achievements: readonly [GameAchievement, ...GameAchievement[]];
  // Each zone's ambient movers.
  readonly ambient: Readonly<Record<ZoneId, readonly AmbientMover[]>>;
  readonly debuffs: Readonly<Record<DebuffId, Debuff>>;
  // The walker a new player starts with.
  readonly defaultWalker: WalkerId;
  readonly dogSlots: readonly [DogSlot, ...DogSlot[]];
  readonly dogs: Readonly<Record<DogId, Dog>>;
  readonly encounters: Readonly<Record<EncounterId, Encounter>>;
  readonly help: readonly [HelpPage, ...HelpPage[]];
  readonly hints: Readonly<Record<HintId, Hint>>;
  readonly homeText: HomeText;
  readonly menuText: MenuText;
  readonly minorObstacles: Readonly<Record<MinorObstacleId, MinorObstacle>>;
  readonly quips: Readonly<Record<DogId, Quips>>;
  readonly runText: RunText;
  readonly shopGear: Readonly<Record<GearId, Gear>>;
  readonly tuning: LiveTuning;
  readonly upgrades: Readonly<Record<UpgradeId, Upgrade>>;
  readonly walkerPerks: Readonly<Record<WalkerPerkId, WalkerPerk>>;
  readonly walkers: Readonly<Record<WalkerId, Walker>>;
  readonly world: World;
}
