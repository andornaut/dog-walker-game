import type {
  DebuffId,
  DogId,
  Effect,
  EncounterId,
  GameData,
  GearId,
  Modifier,
  TallyId,
  UpgradeId,
  WalkerId,
  ZoneId,
} from "../data/types";
import { packPlace, startHearts } from "../rules/dogs";
import type { Lasting } from "../rules/durations";
import { applyEffects } from "../rules/effects";
import { modifiedStat } from "../rules/modifiers";
import { firstZoneId } from "../rules/route";
import { type Cents, cents, type Hearts, type Pixels, pixels, read } from "../rules/units";
import { walkerEffects } from "../rules/walkers";
import { packFor, packOrder } from "./pack";

// A run in progress. Plain JSON throughout: arrays for sets, records for maps, numbers for
// units, so a slice of it can be saved and loaded as it is.

type WalkingSlot = {
  readonly dog: DogId;
  readonly hearts: Hearts;
  readonly status: "walking";
};
// zoneIndex is the zone the owner fired you in; that zone pays nothing for the dog.
type FiredSlot = {
  readonly dog: DogId;
  readonly status: "fired";
  readonly zoneIndex: number;
};
export type PackSlot = FiredSlot | WalkingSlot;
export type Pack =
  readonly [PackSlot] | readonly [PackSlot, PackSlot] | readonly [PackSlot, PackSlot, PackSlot];

export type PackDogs = readonly [DogId] | readonly [DogId, DogId] | readonly [DogId, DogId, DogId];

// What a list of effects came from: a card option by its index in the source's data, an
// instant encounter, gear, an upgrade, or the walker.
export type EffectSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter"; readonly option: number }
  | { readonly gear: GearId; readonly kind: "gear" }
  | { readonly encounter: EncounterId; readonly kind: "instant" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "walker"; readonly walker: WalkerId };

export type ModifierSource = EffectSource | { readonly debuff: DebuffId; readonly kind: "debuff" };

// A modifier in effect, with what it came from so a change can name it, and the last zone it
// lasts through.
export type ActiveModifier = Lasting & Modifier & { readonly source: ModifierSource };

// secondsLeft is the walking time the debuff has left.
export type ActiveDebuff = Lasting & {
  readonly debuff: DebuffId;
  readonly secondsLeft: number;
};

// No card opens for the encounter while the immunity lasts.
type ActiveImmunity = Lasting & { readonly encounter: EncounterId };

// What opened a card: an obstacle the pack hit, with the dogs it affected, or a fork, whose
// paths are the zones it leads to, left to right, each carrying the upgrade at its index.
export type CardSource =
  | {
      readonly affected: readonly DogId[];
      readonly encounter: EncounterId;
      readonly kind: "encounter";
    }
  | {
      readonly kind: "fork";
      readonly paths: readonly ZoneId[];
      readonly upgrades: readonly UpgradeId[];
    };

export type EndReason = "finished" | "noDogs" | "wentHome";

type Phase =
  | { readonly kind: "card"; readonly source: CardSource }
  | { readonly kind: "ended"; readonly reason: EndReason }
  | { readonly kind: "walking" };

export interface RunState {
  // Plain hits that landed, by zone index. A zone with no entry had none.
  readonly bumpsByZone: readonly number[];
  // How many times each debuff was applied this run.
  readonly debuffsGot: Readonly<Partial<Record<DebuffId, number>>>;
  // Each debuff at most once: applying one the pack has refreshes it.
  readonly debuffs: readonly ActiveDebuff[];
  // The zone index the run began in. A dev start skips the zones before it, which count
  // toward no achievement.
  readonly firstZone: number;
  readonly gear: GearId | null;
  // Hearts lost this zone that forgivenHearts modifiers forgave.
  readonly heartsForgiven: number;
  readonly immunities: readonly ActiveImmunity[];
  // The dev panel's cheat: no owner loses hearts. Absent in normal play.
  readonly invincible?: boolean;
  readonly modifiers: readonly ActiveModifier[];
  readonly money: Cents;
  readonly pack: Pack;
  readonly phase: Phase;
  // The zones walked and the zone being walked, in order: zoneIndex is a position in it.
  // Between a zone's end and the fork after it, it has no entry at zoneIndex yet.
  readonly route: readonly ZoneId[];
  // Encounter cards resolved this zone, for the free cards of freeCards modifiers.
  readonly cardsThisZone: number;
  // Hall pass's free Skip: skipPass offers it on every obstacle card until skipUsed, which
  // each zone's start clears.
  readonly skipPass: boolean;
  readonly skipUsed: boolean;
  // The money the run began with, which a money goal leaves out.
  readonly startMoney: Cents;
  // This run's share of the lifetime tallies, banked into the save's at the run's end.
  readonly tallies: Readonly<Partial<Record<TallyId, number>>>;
  // Picked upgrades leave the pool for the rest of the run.
  readonly upgradesPicked: readonly UpgradeId[];
  readonly walker: WalkerId;
  // Distance travelled into the current zone.
  readonly zoneDistance: Pixels;
  // The current zone's position in the walk, counting from 0.
  readonly zoneIndex: number;
}

export interface Loadout {
  readonly dogs: PackDogs;
  readonly gear: GearId | null;
  readonly walker: WalkerId;
}

// A run's opening state, in the world's first zone: the walker's effects and the gear's
// applied, then each owner's starting hearts, full for the pack's size and the starting money. Throws for a dog listed
// twice or more dogs than the player has slots.
export function newRun(
  data: Pick<
    GameData,
    "debuffs" | "dogs" | "encounters" | "shopGear" | "tuning" | "walkerPerks" | "walkers" | "world"
  >,
  dogSlots: number,
  loadout: Loadout,
): RunState {
  if (new Set(loadout.dogs).size !== loadout.dogs.length) {
    throw new Error(`A dog can walk only once in a pack: ${loadout.dogs.join(", ")}`);
  }
  if (loadout.dogs.length > dogSlots) {
    throw new Error(`A pack of ${loadout.dogs.length} needs that many dog slots, not ${dogSlots}`);
  }
  const order = packOrder(data.dogs, loadout.dogs);
  const packWith = (modifiers: readonly Modifier[]) =>
    packFor(
      (dog) => ({
        dog,
        hearts: startHearts(data.tuning, modifiers, packPlace(order, dog), data.dogs[dog]),
        status: "walking",
      }),
      order,
    );
  const { walker } = loadout;
  const empty: RunState = {
    bumpsByZone: [],
    cardsThisZone: 0,
    debuffs: [],
    debuffsGot: {},
    firstZone: 0,
    gear: loadout.gear,
    heartsForgiven: 0,
    immunities: [],
    modifiers: [],
    money: cents(0),
    pack: packWith([]),
    phase: { kind: "walking" },
    route: [firstZoneId(data)],
    skipPass: false,
    skipUsed: false,
    startMoney: cents(0),
    tallies: {},
    upgradesPicked: [],
    walker,
    zoneDistance: pixels(0),
    zoneIndex: 0,
  };
  // Neither walkers nor gear target a random dog, so the draw is never used.
  const applyFrom = (source: EffectSource, effects: readonly Effect[], state: RunState) =>
    applyEffects(data, { affected: [], random: () => 0, source }, effects, state);
  const walked = applyFrom({ kind: "walker", walker }, walkerEffects(data, walker), empty);
  const geared =
    loadout.gear === null
      ? walked
      : applyFrom(
          { gear: loadout.gear, kind: "gear" },
          data.shopGear[loadout.gear].effects,
          walked,
        );
  const purse = read(data.tuning, "money", "startPurse");
  const money = cents(modifiedStat(data.tuning, geared.modifiers, "startMoney", purse));
  return { ...geared, money, pack: packWith(geared.modifiers), startMoney: money };
}
