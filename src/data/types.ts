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
  "biscuitNeighbour" | "lostWallet" | "otherDog" | "puddle" | "skunk" | "squirrel" | "thief";
export type Size = "big" | "medium" | "small";
// Lifetime counts the save keeps across walks for the badges: small dogs' dodges, landed
// squirrel pulls, treats grabbed, and the card options that name one as their tally.
export type TallyId = "dodges" | "sniffs" | "squirrelPulls" | "thievesLetGo" | "treats";

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
export type SecondsKey = NumberKeys<LiveTuning["seconds"]>;
export type PriceKey = keyof LiveTuning["money"]["prices"];

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
    readonly packSizeMin: number;
    readonly tipsFirstZone: number;
    readonly tipsGainPerZone: number;
    readonly treatsPerZone: number;
    readonly upgradeChoiceCount: number;
  };
  readonly hearts: OpenGroup & {
    readonly maxBySize: Table<Size>;
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
    // A hopping mover's jump lasts this long; the rules' own default while it is absent.
    readonly moverHopSeconds?: number;
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
  // portrait-dog-<art>, face-owner-<art>, owner-<art> and the <art> tag of ui-dog-card.
  readonly art: string;
  readonly breed: string;
  readonly look: string;
  readonly name: string;
  readonly owner: Owner;
  readonly size: Size;
};

// Which dogs an effect reaches, among the dogs still in the pack. "affected" is the dogs
// the encounter affected; "randomOne" is one dog drawn at random.
export type Target =
  { readonly kind: "affected" } | { readonly kind: "all" } | { readonly kind: "randomOne" };

// "zone": the rest of the current zone; "nextZone": the whole of the next zone.
export type Duration = "nextZone" | "run" | "zone";

// Stats a modifier changes. An "add" names a key in the stat's own unit group.
// How many lanes beside the pack's tips and treats are grabbed from, and how many encounter
// cards each zone cost no money.
export type CountStat = "freeCards" | "tipReach" | "treatReach";
// forgivenHearts: how many of the first hearts lost in each zone are forgiven.
export type HeartsStat = "forgivenHearts" | "maxHearts";
export type MoneyStat = "startMoney" | "tipValue";
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
  // How long one lane change takes.
  | "laneMove"
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

export type HeartsDelta = -3 | -2 | -1 | 1 | 2 | 3;

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

// A free Skip on every obstacle card until it is taken, once per walk.
export interface SkipOptionEffect {
  readonly kind: "skipOption";
}

export type Effect =
  DebuffEffect | HeartsEffect | ImmuneEffect | ModifierEffect | MoneyEffect | SkipOptionEffect;

export interface CardOption {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  // What its changes name as their cause, such as "grumpy neighbour"; the option's name when
  // absent.
  readonly cause?: string;
  // Picking it counts one toward this lifetime tally.
  readonly tally?: TallyId;
  readonly effects: readonly Effect[];
  readonly name: string;
}

// Cards show two or three options side by side.
export type CardOptions =
  readonly [CardOption, CardOption] | readonly [CardOption, CardOption, CardOption];

export type NonEmptyEffects = readonly [Effect, ...Effect[]];

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

// The obstacle applies its effects to the whole pack as it is touched, with a plain obstacle's
// hit stop and no card.
export interface ContactResolution {
  readonly effects: NonEmptyEffects;
  // What an immunity to the obstacle does, as an effect's text says it, lower case: "puddles
  // don't muddy the pack".
  readonly immuneText: string;
  readonly kind: "contact";
}

// Touching the obstacle does nothing: its only cost is the dogs pulling toward it.
export interface PullResolution {
  readonly kind: "pull";
}

export type ObstacleResolution = CardResolution | ContactResolution | PullResolution;
export type Resolution = InstantResolution | ObstacleResolution;

// What an obstacle covers on the road: lanes across and rows along it. One row is a lane-width
// of road. The rulebook allows no obstacle wider than 3 lanes.
export interface Shape {
  readonly lanes: 1 | 2 | 3;
  readonly rows: 1 | 2 | 3;
}

// How an obstacle moves when it comes as a mover, each move after a cue
// seconds.moverWarningSeconds long. dart: across the road at counts.dartLanesPerSecond, coming
// down it at 1 + tilt of the road's speed meanwhile (tilt 0 when absent). inLane: down its lane
// at factor of the road's speed, above 1 toward the pack, below 1 away. hop: one jump of 1 to
// most spots one way, lanes to either side or, unless sideways, rows toward or away, landing
// seconds.moverHopSeconds after it leaves. step: steps spots, each a lane to either side or a
// row toward or away, seconds.moverStepSeconds each. still: it never moves, as with no
// movement.
export type Movement =
  | { readonly kind: "dart"; readonly tilt?: number }
  | { readonly kind: "hop"; readonly most: 1 | 2; readonly sideways?: true }
  | { readonly kind: "inLane"; readonly factor: number }
  | { readonly kind: "step"; readonly steps: 1 | 2 }
  | { readonly kind: "still" };
export type MovementKind = Movement["kind"];

// An obstacle's look in one zone, in place of its base look: the name (an encounter's card
// title), the road sprite's art key, the hit label, and the prefix replacing card-<kebab id>
// in each card option's illustration key. A Stink skin may name its spray cloud's art key, and
// a skin whose encounter gives a status may name the status overlay's art key, drawn while the
// status it gave lasts. A missing hitLabel, cardArtPrefix, cloudArt or statusArt falls back to
// the base's, and an art key not yet in the manifest to the base art. movement is how the look
// A skin never changes what the obstacle does.
export interface Skin {
  readonly art: string;
  readonly cardArtPrefix?: string;
  readonly cloudArt?: string;
  readonly hitLabel?: string;
  readonly name: string;
  readonly statusArt?: string;
}

// Skins by zone id. The keys are strings, not ZoneId: ZoneId comes from the world's data, whose
// type names the obstacles, so typing their skins by it would be circular. The data tests check
// each key is a zone's id.
export type Skins = Readonly<Partial<Record<string, Skin>>>;

// "obstacle": hit by accident. A card obstacle opens a card for the whole pack, with hitLabel
// shown large as it hits; a contact obstacle applies its effects as it is touched; a pull
// obstacle does nothing when touched. An obstacle the pack is immune to is harmless. "lucky": a
// good thing to bump into, applied on contact with no card. skins are its looks by zone. An
// obstacle with a movement comes as a mover at the zone's moverShare.
export type Encounter = {
  readonly name: string;
  readonly skins?: Skins;
} & (
  | { readonly kind: "lucky"; readonly resolution: InstantResolution }
  | ({
      readonly kind: "obstacle";
      readonly movement?: Movement;
      readonly shape: Shape;
    } & (
      | { readonly hitLabel: string; readonly resolution: CardResolution }
      | { readonly resolution: ContactResolution | PullResolution }
    ))
);

// An obstacle that opens no card: bumping it drops money.minorBump in tips, once for the
// pack, and locks lane input for seconds.minorStumble, showing hitLabel when it has one. Each
// zone's weights set how often it appears there, and skins are its looks by zone: the
// obstacles of one shape share one skin per zone. One with a movement comes as a mover at the
// zone's moverShare.
export interface MinorObstacle {
  readonly hitLabel?: string;
  readonly movement?: Movement;
  readonly name: string;
  readonly shape: Shape;
  readonly skins?: Skins;
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
export type WalkerUnlock =
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
export interface HelpPage {
  // Key of the page's illustration in the art manifest's images.
  readonly art: string;
  readonly body: string;
  readonly title: string;
}

export interface AgilityWord {
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
  // status, and the price status of anything not owned yet.
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
  // The Pet shop page: its title, its tabs, the headings over its lists and their notes, a
  // dog slot row's line, the line of a slot that needs the one before it, and the word on an
  // owned row.
  readonly shop: {
    readonly dogs: string;
    readonly dogsAllOwned: string;
    readonly gearNote: string;
    readonly owned: string;
    readonly slotFirst: string;
    readonly slotLine: string;
    readonly slots: string;
    readonly slotsOwned: string;
    readonly tabs: { readonly dogs: string; readonly gear: string };
    readonly title: string;
  };
  readonly slotBought: string;
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
  // What the bubble says for an owned walker picked or focused: its agility and perk.
  readonly walkerInfo: string;
  // What the walker's bubble says when a locked walker is tapped: the goal that unlocks it.
  readonly walkerLocked: string;
  // A locked walker's name plate on its tile.
  readonly walkerPlate: string;
  // A dog's fee on its tile and its shop row.
  readonly zoneFee: string;
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
    readonly free: string;
    readonly need: string;
    readonly pickOne: string;
    readonly skip: string;
    // The Skip card's effect on its face, and in its body when held.
    readonly skipEffect: string;
    readonly skipHeld: string;
    // An upgrade card's plaque, by how long it lasts.
    readonly upgradeDuration: { readonly [D in UpgradeDuration]: string };
  };
  // Over a small dog that dodged a hit.
  readonly dodge: string;
  // What a still press held on the walk HUD shows in the message strip: an effect's name and
  // line, a debuff's name and stake (its {seconds} the seconds it has left), and a dog's size,
  // hearts and owner. moreEffects is the last effect well's count of the effects past the
  // wells.
  readonly explain: {
    readonly debuff: string;
    readonly dog: string;
    readonly effect: string;
    readonly moreEffects: string;
  };
  readonly fired: string;
  readonly firedBy: string;
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
    readonly fired: string;
    readonly fullPackHome: string;
    readonly kindWords: string;
    readonly lowHearts: string;
    readonly luckyNeighbor: string;
    readonly luckyWallet: string;
    readonly plainHit: string;
    readonly pull: string;
    readonly pullCancel: string;
    readonly treat: string;
  };
  // Names a loss cut short because the money ran out.
  readonly outOfMoney: string;
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
    readonly bank: string;
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
// Two or more lines per moment, one drawn at random.
export type Quips = Readonly<Record<QuipMoment, readonly [string, string, ...string[]]>>;

// What a first-time hint waits for: an encounter, a debuff, or another event happening for
// the first time.
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
// with, dollars it banked, times it got the debuff, a finished walk with a walking owner on
// their last heart, and a finished walk that paid the Full pack bonus for a pack of at least
// packSize. Profile conditions are judged on the save after a run or a purchase: dogs, gear,
// dog slots and walkers owned (all: every one in the data), finished walks with no owner
// firing you, times fired, distinct dogs that finished a walk without firing you (all: every
// dog), and a lifetime tally.
export type AchievementCondition =
  | { readonly count: number; readonly debuff: DebuffId; readonly kind: "debuffsGot" }
  | { readonly count: number; readonly kind: "packSize" }
  | { readonly count: number; readonly kind: "tally"; readonly tally: TallyId }
  | { readonly count: number; readonly kind: "timesFired" }
  | { readonly count: number; readonly kind: "walksWithoutFiring" }
  | { readonly count: Threshold; readonly kind: "cleanZones" }
  | { readonly count: Threshold; readonly kind: "dogSlotsOwned" }
  | { readonly count: Threshold; readonly kind: "dogsFinishedWith" }
  | { readonly count: Threshold; readonly kind: "dogsOwned" }
  | { readonly count: Threshold; readonly kind: "gearOwned" }
  | { readonly count: Threshold; readonly kind: "walkersUnlocked" }
  | { readonly count: Threshold; readonly kind: "zonesFinished" }
  | { readonly dollars: number; readonly kind: "earnings" }
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

export type GameAchievement = Achievement & { readonly id: AchievementId };

// Where an ambient mover goes. Ambient movers are scenery: they never touch the road, collide,
// or change anything in play.
// - crossStreet: along the backdrop's cross street, in the near lane going right or the far
//   lane going left.
// - crossWalk: along one of the cross street's sidewalks, either way.
// - sidewalkAway, sidewalkToward: along a sidewalk beside the road (on the lawn's edge where
//   there is none), walking away from or toward the walker.
// - verge: on the lawn or paving beside the road. A steady mover darts in from the screen's
//   side, stops, and darts back out; a hopper or flier starts there and leaves the same way.
export type AmbientPath = "crossStreet" | "crossWalk" | "sidewalkAway" | "sidewalkToward" | "verge";

// How a mover covers its path: steadily, in bursts of one or two hops with a pause between
// them, or rising as it goes.
export type AmbientGait = "fly" | "hop" | "steady";

// One kind of ambient mover in a zone: its sprite and the tag it plays while moving, its path
// and gait, its speed while moving (band pixels a second on the cross street and its
// sidewalks, road pixels a second beside the road) and how often one sets out, per minute.
export interface AmbientMover {
  readonly gait: AmbientGait;
  readonly key: string;
  readonly path: AmbientPath;
  readonly perMinute: number;
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
