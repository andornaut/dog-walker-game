import type {
  DebuffId,
  DogId,
  Effect,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  Modifier,
  NeedCardId,
  NeedId,
  NeedSpotId,
  QuirkId,
  UpgradeId,
  WalkerId,
  ZoneId,
} from "../data/types";
import { startHearts } from "../rules/dogs";
import type { Lasting } from "../rules/durations";
import { applyEffects } from "../rules/effects";
import { modifiedStat } from "../rules/modifiers";
import { firstZoneId } from "../rules/route";
import { type Cents, cents, type Hearts, type Pixels, pixels } from "../rules/units";
import { walkerEffects } from "../rules/walkers";
import { packFor } from "./pack";

// A run in progress. Plain JSON throughout: arrays for sets, records for maps, numbers for
// units, so a slice of it can be saved and loaded as it is.

export type WalkingSlot = {
  readonly dog: DogId;
  readonly hearts: Hearts;
  readonly status: "walking";
};
// zoneIndex is the zone the owner fired you in; that zone pays nothing for the dog.
export type FiredSlot = {
  readonly dog: DogId;
  readonly status: "fired";
  readonly zoneIndex: number;
};
export type PackSlot = FiredSlot | WalkingSlot;
export type Pack =
  readonly [PackSlot] | readonly [PackSlot, PackSlot] | readonly [PackSlot, PackSlot, PackSlot];

export type PackDogs = readonly [DogId] | readonly [DogId, DogId] | readonly [DogId, DogId, DogId];
export type UpgradeOffer = readonly [UpgradeId, UpgradeId, UpgradeId];

// What a list of effects came from: a card option by its index in the source's data, an
// instant encounter, gear, a need met at a spot, a need gone wrong, or the walker.
export type EffectSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter"; readonly option: number }
  | { readonly kind: "forcedStop"; readonly option: number; readonly stop: ForcedStopId }
  | { readonly gear: GearId; readonly kind: "gear" }
  | { readonly encounter: EncounterId; readonly kind: "instant" }
  | { readonly card: NeedCardId; readonly kind: "needCard"; readonly option: number }
  | { readonly kind: "needGoneWrong"; readonly need: NeedId }
  | { readonly kind: "needMet"; readonly spot: NeedSpotId }
  | { readonly kind: "quirk"; readonly quirk: QuirkId }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "walker"; readonly walker: WalkerId };

export type ModifierSource = EffectSource | { readonly debuff: DebuffId; readonly kind: "debuff" };

// A modifier in effect, with what it came from so a change can name it, and the last zone it
// lasts through.
export type ActiveModifier = Lasting & Modifier & { readonly source: ModifierSource };

export type ActiveDebuff = Lasting & { readonly debuff: DebuffId };

// No card opens for the encounter while the immunity lasts.
export type ActiveImmunity = Lasting & { readonly encounter: EncounterId };

// What opened a card. affected is the dogs the encounter affected (caught by an area roll,
// the chasers for a squirrel, or the whole pack), or the dogs whose need opened it; lucky
// encounters are encounters too. A fork's paths are the zones it leads to, left to right.
export type CardSource =
  | {
      readonly affected: readonly DogId[];
      readonly encounter: EncounterId;
      readonly kind: "encounter";
    }
  | { readonly kind: "forcedStop"; readonly stop: ForcedStopId }
  | { readonly kind: "fork"; readonly paths: readonly ZoneId[] }
  | {
      readonly affected: readonly DogId[];
      readonly card: NeedCardId;
      readonly kind: "need";
    }
  | { readonly kind: "upgradeOffer"; readonly offered: UpgradeOffer };

export type EndReason = "finished" | "noDogs" | "wentHome";

export type Phase =
  | {
      readonly kind: "card";
      readonly source: Exclude<CardSource, { readonly kind: "upgradeOffer" }>;
    }
  | { readonly kind: "ended"; readonly reason: EndReason }
  | { readonly kind: "upgrade"; readonly offered: UpgradeOffer }
  | { readonly kind: "walking" };

export interface RunState {
  // Obstacle hits, minor ones included, by zone index. A zone with no entry had none.
  readonly bumpsByZone: readonly number[];
  // How many zones ended with each debuff on.
  readonly debuffZones: Readonly<Partial<Record<DebuffId, number>>>;
  // Each debuff at most once: applying one the pack has refreshes it.
  readonly debuffs: readonly ActiveDebuff[];
  // The zone index the run began in. A dev start skips the zones before it, which count
  // toward no achievement.
  readonly firstZone: number;
  readonly gear: GearId | null;
  readonly immunities: readonly ActiveImmunity[];
  readonly modifiers: readonly ActiveModifier[];
  readonly money: Cents;
  // Seconds each dog has walked this zone since its need was last met or went wrong.
  readonly needSeconds: Readonly<Partial<Record<DogId, number>>>;
  readonly pack: Pack;
  readonly phase: Phase;
  // The zones walked and the zone being walked, in order: zoneIndex is a position in it.
  // Between a zone's end and the fork after it, it has no entry at zoneIndex yet.
  readonly route: readonly ZoneId[];
  readonly skipsLeft: number;
  // Squirrel cards on which the chasers were let chase.
  readonly squirrelChases: number;
  // Carried, up to counts.treatCarryMax.
  readonly treats: number;
  // Picked upgrades leave the pool for the rest of the run.
  readonly upgradesPicked: readonly UpgradeId[];
  readonly walker: WalkerId;
  // Distance travelled into the current zone.
  readonly zoneDistance: Pixels;
  // The current zone's position in the walk, counting from 0.
  readonly zoneIndex: number;
}

// With no walker, the run walks with the default walker.
// CLEANUP (added 2026-10-19): make walker required once RunScene and StartScene build every
// Loadout with one.
export interface Loadout {
  readonly dogs: PackDogs;
  readonly gear: GearId | null;
  readonly walker?: WalkerId;
}

// A run's opening state, in the world's first zone: the walker's effects and the gear's
// applied, then each owner's starting hearts and the starting money. Throws for a dog listed
// twice or more dogs than the player has slots.
export function newRun(
  data: Pick<
    GameData,
    | "debuffs"
    | "defaultWalker"
    | "dogs"
    | "encounters"
    | "shopGear"
    | "tuning"
    | "walkerPaces"
    | "walkerStyles"
    | "walkers"
    | "world"
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
  const packWith = (modifiers: readonly Modifier[]) =>
    packFor(
      (dog) => ({
        dog,
        hearts: startHearts(data.tuning, modifiers, data.dogs[dog]),
        status: "walking",
      }),
      loadout.dogs,
    );
  const walker = loadout.walker ?? data.defaultWalker;
  const empty: RunState = {
    bumpsByZone: [],
    debuffZones: {},
    debuffs: [],
    firstZone: 0,
    gear: loadout.gear,
    immunities: [],
    modifiers: [],
    money: cents(0),
    needSeconds: {},
    pack: packWith([]),
    phase: { kind: "walking" },
    route: [firstZoneId(data)],
    skipsLeft: 0,
    squirrelChases: 0,
    treats: 0,
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
  return {
    ...geared,
    money: cents(modifiedStat(data.tuning, geared.modifiers, "startMoney", 0)),
    pack: packWith(geared.modifiers),
  };
}
