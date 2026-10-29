import { type Pixels, pixels } from "@andornaut/game-kit/units";

import type {
  CardSource,
  DebuffId,
  DodgeEffect,
  DogId,
  Effect,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  Modifier,
  OptionPicks,
  TallyId,
  UpgradeId,
  WalkerId,
  ZoneId,
} from "../data/types";
import { packPlace, startHearts } from "../rules/dogs";
import type { Lasting } from "../rules/durations";
import { applyEffects } from "../rules/effects";
import { firstZoneId } from "../rules/route";
import { read } from "../rules/units";
import { walkerEffects } from "../rules/walkers";
import { type Cents, cents, type Hearts } from "../units";
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
// instant encounter, gear (found set for a gear drop grabbed on the road, else the Pocket's), an
// upgrade, or the walker.
export type EffectSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter"; readonly option: number }
  | { readonly found?: true; readonly gear: GearId; readonly kind: "gear" }
  | { readonly encounter: EncounterId; readonly kind: "instant" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "walker"; readonly walker: WalkerId };

export type ModifierSource = EffectSource | { readonly debuff: DebuffId; readonly kind: "debuff" };

// A modifier in effect, with what it came from so a change can name it, and the last zone it
// lasts through.
export type ActiveModifier = Lasting & Modifier & { readonly source: ModifierSource };

// A dodge effect in play for the rest of the walk, with what it came from.
type ActiveDodge = Omit<DodgeEffect, "kind"> & { readonly source: EffectSource };

// secondsLeft is the walking time the debuff has left.
export type ActiveDebuff = Lasting & {
  readonly debuff: DebuffId;
  readonly secondsLeft: number;
};

// No card opens for the encounter while the immunity lasts. source is what gave it.
type ActiveImmunity = Lasting & {
  readonly encounter: EncounterId;
  readonly source: EffectSource;
};

export interface SpareTreats {
  readonly held: number;
  readonly spent: number;
  readonly stored: number;
}

export const NO_SPARE_TREATS: SpareTreats = { held: 0, spent: 0, stored: 0 };

export type EndReason = "finished" | "noDogs" | "wentHome";

type Phase =
  | { readonly kind: "card"; readonly source: CardSource }
  | { readonly kind: "ended"; readonly reason: EndReason }
  | { readonly kind: "walking" };

export interface RunState {
  // Plain hits that cost their owner a heart, so neither dodged nor forgiven, by obstacle kind.
  readonly bumpsByKind: Readonly<Partial<Record<MinorObstacleId, number>>>;
  // Plain hits that landed, by zone index. A zone with no entry had none.
  readonly bumpsByZone: readonly number[];
  // How many times each debuff was applied this run.
  readonly debuffsGot: Readonly<Partial<Record<DebuffId, number>>>;
  // Each debuff at most once: applying one the pack has refreshes it.
  readonly debuffs: readonly ActiveDebuff[];
  // The dodges effects such as the Whistle's gave, which last the walk.
  readonly dodges: readonly ActiveDodge[];
  // The zone index the run began in. A dev start skips the zones before it, which count
  // toward no achievement.
  readonly firstZone: number;
  // The gear drop grabbed last, in effect on top of the Pocket's gear until the walk ends or the
  // next grab replaces it; null before any.
  readonly foundGear: GearId | null;
  // The gear in the Pocket.
  readonly gear: GearId | null;
  // Hearts lost this zone that forgivenHearts modifiers forgave.
  readonly heartsForgiven: number;
  readonly immunities: readonly ActiveImmunity[];
  // The dev panel's cheat: no owner loses hearts. Absent in normal play.
  readonly invincible?: boolean;
  readonly modifiers: readonly ActiveModifier[];
  readonly money: Cents;
  // This run's card option picks by encounter and option id, banked into the save's at the
  // run's end.
  readonly optionPicks: Readonly<OptionPicks>;
  readonly pack: Pack;
  readonly phase: Phase;
  // The zones walked and the zone being walked, in order: zoneIndex is a position in it.
  // Between a zone's end and the fork after it, it has no entry at zoneIndex yet.
  readonly route: readonly ZoneId[];
  // Encounter cards resolved this zone, for the free cards of freeCards modifiers.
  readonly cardsThisZone: number;
  // The spare treats spareTreats modifiers, such as the Fanny pack's, let the pack hold: held
  // now, and this walk's stored and spent.
  readonly spareTreats: SpareTreats;
  // Hall pass's free Skip: skipPass, what gave it, offers it on every obstacle card until
  // skipUsed, which each zone's start clears. Null without one.
  readonly skipPass: EffectSource | null;
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
  // The money at the last zone's end, its pay banked, or at the run's start before any. A walk
  // that ends early keeps no more than this (walkEarnings).
  readonly zoneEndMoney: Cents;
  // The current zone's position in the walk, counting from 0.
  readonly zoneIndex: number;
}

export interface Loadout {
  readonly dogs: PackDogs;
  readonly gear: GearId | null;
  readonly walker: WalkerId;
}

// A run at its start with nothing on it yet but its gear, pack, route and walker: no money, no
// effects, nothing counted, walking zone 0 from its start.
export function blankRun(start: Pick<RunState, "gear" | "pack" | "route" | "walker">): RunState {
  const { gear, pack, route, walker } = start;
  return {
    bumpsByKind: {},
    bumpsByZone: [],
    cardsThisZone: 0,
    debuffs: [],
    debuffsGot: {},
    dodges: [],
    firstZone: 0,
    foundGear: null,
    gear,
    heartsForgiven: 0,
    immunities: [],
    modifiers: [],
    money: cents(0),
    optionPicks: {},
    pack,
    phase: { kind: "walking" },
    route,
    skipPass: null,
    skipUsed: false,
    spareTreats: NO_SPARE_TREATS,
    startMoney: cents(0),
    tallies: {},
    upgradesPicked: [],
    walker,
    zoneDistance: pixels(0),
    zoneEndMoney: cents(0),
    zoneIndex: 0,
  };
}

// A run's opening state, in the world's first zone: the walker's effects and the gear's applied,
// then each owner's starting hearts, full for the pack's size, and the starting money. Throws for a
// dog listed twice or more dogs than the player has slots.
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
  const empty = blankRun({
    gear: loadout.gear,
    pack: packWith([]),
    route: [firstZoneId(data)],
    walker,
  });
  const applyFrom = (source: EffectSource, effects: readonly Effect[], state: RunState) =>
    applyEffects(data, { affected: [], source }, effects, state);
  const walked = applyFrom({ kind: "walker", walker }, walkerEffects(data, walker), empty);
  const geared =
    loadout.gear === null
      ? walked
      : applyFrom(
          { gear: loadout.gear, kind: "gear" },
          data.shopGear[loadout.gear].effects,
          walked,
        );
  const money = read(data.tuning, "money", "startPurse");
  return {
    ...geared,
    money,
    pack: packWith(geared.modifiers),
    startMoney: money,
    zoneEndMoney: money,
  };
}
