import type {
  DebuffId,
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  Modifier,
  UpgradeId,
} from "../data/types";
import { startHearts } from "../rules/dogs";
import { applyEffects } from "../rules/effects";
import { modifiedStat } from "../rules/modifiers";
import { type Cents, cents, type Hearts, type Pixels, pixels } from "../rules/units";
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

// What opened a card. affected is the dogs the encounter affected (caught by an area roll,
// the chasers for a squirrel, or the whole pack); lucky encounters are encounters too.
export type CardSource =
  | {
      readonly affected: readonly DogId[];
      readonly encounter: EncounterId;
      readonly kind: "encounter";
    }
  | { readonly kind: "forcedStop"; readonly stop: ForcedStopId }
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
  // Each debuff at most once: applying one the pack has refreshes it.
  readonly debuffs: readonly DebuffId[];
  // Fees each dog has paid this run, which its owner takes back on firing you.
  readonly feesEarned: Readonly<Partial<Record<DogId, Cents>>>;
  readonly gear: GearId | null;
  readonly immunities: readonly EncounterId[];
  readonly modifiers: readonly Modifier[];
  readonly money: Cents;
  readonly pack: Pack;
  readonly phase: Phase;
  readonly skipsLeft: number;
  // Carried, up to counts.treatCarryMax.
  readonly treats: number;
  // Picked upgrades leave the pool for the rest of the run.
  readonly upgradesPicked: readonly UpgradeId[];
  // Distance travelled into the current zone.
  readonly zoneDistance: Pixels;
  readonly zoneIndex: number;
}

export interface Loadout {
  readonly dogs: PackDogs;
  readonly gear: GearId | null;
}

// A run's opening state: the gear applied, then each owner's starting hearts and the
// starting money.
export function newRun(
  data: Pick<GameData, "dogs" | "shopGear" | "tuning">,
  loadout: Loadout,
): RunState {
  if (new Set(loadout.dogs).size !== loadout.dogs.length) {
    throw new Error(`A dog can walk only once in a pack: ${loadout.dogs.join(", ")}`);
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
  const empty: RunState = {
    debuffs: [],
    feesEarned: {},
    gear: loadout.gear,
    immunities: [],
    modifiers: [],
    money: cents(0),
    pack: packWith([]),
    phase: { kind: "walking" },
    skipsLeft: 0,
    treats: 0,
    upgradesPicked: [],
    zoneDistance: pixels(0),
    zoneIndex: 0,
  };
  const gearEffects = loadout.gear === null ? [] : data.shopGear[loadout.gear].effects;
  // Gear never targets a random dog, so the draw is never used.
  const geared = applyEffects(data, { affected: [], random: () => 0 }, gearEffects, empty);
  return {
    ...geared,
    money: cents(modifiedStat(data.tuning, geared.modifiers, "startMoney", 0)),
    pack: packWith(geared.modifiers),
  };
}
