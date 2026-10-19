import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { quipLine } from "../rules/choices";
import { zoneFee } from "../rules/dogs";
import { formatDollars } from "../rules/effectText";
import { addCents, type Cents, cents, dollarsToCents, read } from "../rules/units";
import type { EndReason, PackDogs, RunState } from "../state/runState";

// The home screen's logbook: the best walk, totals, and the last walk as one line.
export interface Logbook {
  readonly bestWalk: Cents;
  readonly bestWalkDogs: readonly DogId[];
  readonly bestWalkZones: number;
  readonly dogsWalked: number;
  readonly lastWalk: string;
  readonly timesFired: number;
  readonly walks: number;
}

// What the player keeps between walks. logbook is null before the first walk; dogSlots is
// how many dogs a pack may hold; walker is the one drawn at the gate and on the road.
export interface HomeProfile {
  readonly bank: Cents;
  readonly dogSlots: number;
  readonly logbook: Logbook | null;
  readonly ownedDogs: readonly DogId[];
  readonly ownedGear: readonly GearId[];
  readonly walker: WalkerId;
}

// The pack being picked, in the order picked, and the gear to take.
export interface HomeLoadout {
  readonly dogs: readonly DogId[];
  readonly gear: GearId | null;
}

export type Purchase =
  | { readonly dog: DogId; readonly kind: "dog" }
  | { readonly kind: "dogSlot"; readonly slot: number }
  | { readonly gear: GearId; readonly kind: "gear" };

// A tap on the home screen either changes the loadout or asks to buy a locked item.
export type HomeTap =
  | { readonly kind: "buy"; readonly purchase: Purchase }
  | {
      readonly kind: "loadout";
      readonly loadout: HomeLoadout;
    };

export const emptyLoadout: HomeLoadout = { dogs: [], gear: null };

// How many dogs the player's pack may hold: one per dog slot, up to counts.packSizeMax.
export function packCapacity(data: Pick<GameData, "tuning">, profile: HomeProfile): number {
  return Math.min(profile.dogSlots, read(data.tuning, "counts", "packSizeMax"));
}

// The next dog slot for sale, or undefined once the pack holds the most it can.
export function nextDogSlot(
  data: Pick<GameData, "tuning">,
  profile: HomeProfile,
): number | undefined {
  return profile.dogSlots < read(data.tuning, "counts", "packSizeMax")
    ? profile.dogSlots + 1
    : undefined;
}

// The price of a dog slot, read from money.prices.dogSlot<slot>, or undefined if unpriced.
export function dogSlotPrice(data: Pick<GameData, "tuning">, slot: number): Cents | undefined {
  const prices: Readonly<Record<string, number>> = data.tuning.money.prices;
  const dollars = prices[`dogSlot${slot}`];
  return dollars === undefined ? undefined : dollarsToCents(dollars);
}

// An owned dog joins the pack, or leaves it if already picked; a full pack takes no more.
// A dog not owned yet is a purchase.
export function tapDog(
  data: Pick<GameData, "tuning">,
  profile: HomeProfile,
  dog: DogId,
  loadout: HomeLoadout,
): HomeTap {
  if (!profile.ownedDogs.includes(dog)) {
    return { kind: "buy", purchase: { dog, kind: "dog" } };
  }
  if (loadout.dogs.includes(dog)) {
    return {
      kind: "loadout",
      loadout: { ...loadout, dogs: loadout.dogs.filter((id) => id !== dog) },
    };
  }
  const full = loadout.dogs.length >= packCapacity(data, profile);
  return {
    kind: "loadout",
    loadout: full ? loadout : { ...loadout, dogs: [...loadout.dogs, dog] },
  };
}

// Owned gear is equipped, replacing any other, or unequipped if already on. Gear not owned
// yet is a purchase.
export function tapGear(profile: HomeProfile, gear: GearId, loadout: HomeLoadout): HomeTap {
  if (!profile.ownedGear.includes(gear)) {
    return { kind: "buy", purchase: { gear, kind: "gear" } };
  }
  return { kind: "loadout", loadout: { ...loadout, gear: loadout.gear === gear ? null : gear } };
}

// The picked dogs as a pack a walk can start with, or undefined with none picked.
export function packOf(loadout: HomeLoadout): PackDogs | undefined {
  const [first, second, third] = loadout.dogs;
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return [first];
  }
  return third === undefined ? [first, second] : [first, second, third];
}

// What the picked pack pays for each zone it finishes, before upgrades.
export function packFeePerZone(
  data: Pick<GameData, "dogs" | "tuning">,
  loadout: HomeLoadout,
): Cents {
  return loadout.dogs.reduce(
    (total, dog) => addCents(total, zoneFee(data.tuning, [], data.dogs[dog])),
    cents(0),
  );
}

export interface WalkResult {
  readonly dogs: readonly DogId[];
  readonly earned: Cents;
  // Each owner who fired you, with the zone they did it in.
  readonly firings: readonly { readonly dog: DogId; readonly zoneIndex: number }[];
  readonly reason: EndReason;
  readonly zonesFinished: number;
}

// The result of a run that has ended: everything it earned is kept.
export function walkResult(data: Pick<GameData, "world">, run: RunState): WalkResult {
  const reason = run.phase.kind === "ended" ? run.phase.reason : "wentHome";
  return {
    dogs: run.pack.map((slot) => slot.dog),
    earned: run.money,
    firings: run.pack.flatMap((slot) =>
      slot.status === "fired" ? [{ dog: slot.dog, zoneIndex: slot.zoneIndex }] : [],
    ),
    reason,
    zonesFinished: reason === "finished" ? data.world.zones.length : run.zoneIndex,
  };
}

// The last walk as one line for the logbook, naming the owner who fired you if one did.
export function lastWalkLine(data: Pick<GameData, "dogs" | "world">, result: WalkResult): string {
  const earned = `+${formatDollars(result.earned)}.`;
  const firing = result.firings.at(-1);
  if (firing !== undefined) {
    const owner = data.dogs[firing.dog].owner.name;
    const zone = data.world.zones[firing.zoneIndex]?.name ?? data.world.name;
    return `${earned} ${owner} fired you on ${zone}.`;
  }
  if (result.reason === "finished") {
    return `${earned} Walked all of ${data.world.name}.`;
  }
  const zone = data.world.zones[result.zonesFinished]?.name ?? data.world.name;
  return `${earned} Headed home from ${zone}.`;
}

// Splits text into lines of at most maxChars, breaking between words; a longer word gets a
// line of its own.
export function wrapWords(maxChars: number, text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter((part) => part !== "")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= maxChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

// What a dog's owner says when the player picks it: their name, then one of their parting
// lines, wrapped to the speech bubble.
export function partingSpeech(
  data: Pick<GameData, "dogs" | "quips">,
  random: () => number,
  maxChars: number,
  dog: DogId,
): string[] {
  const line = quipLine(data, random, { dog, moment: "parting" });
  return [`${data.dogs[dog].owner.name}:`, ...wrapWords(maxChars, line)];
}

// Banks a finished walk and records it in the logbook. Held in memory until saves land.
export function recordWalk(
  data: Pick<GameData, "dogs" | "world">,
  result: WalkResult,
  profile: HomeProfile,
): HomeProfile {
  const log = profile.logbook;
  const best = log === null || result.earned > log.bestWalk;
  return {
    ...profile,
    bank: addCents(profile.bank, result.earned),
    logbook: {
      bestWalk: best ? result.earned : log.bestWalk,
      bestWalkDogs: best ? result.dogs : log.bestWalkDogs,
      bestWalkZones: best ? result.zonesFinished : log.bestWalkZones,
      dogsWalked: (log?.dogsWalked ?? 0) + result.dogs.length,
      lastWalk: lastWalkLine(data, result),
      timesFired: (log?.timesFired ?? 0) + result.firings.length,
      walks: (log?.walks ?? 0) + 1,
    },
  };
}
