import type { GameData, GearId, LiveTuning } from "../data/types";
import { chanceRound, type Random, weightedPick } from "../lib/random";
import { keysOf } from "../lib/records";
import { clampHearts } from "../lib/units";
import { mapPack } from "../state/pack";
import type { EffectSource, ModifierSource, RunState } from "../state/runState";
import { ownerMaxHearts } from "./dogs";
import { resolveEffects } from "./effects";
import type { ModifiedValue } from "./modified";
import { price } from "./shop";
import { holdSpareTreats } from "./spareTreats";
import { readTable } from "./units";

// Gear drops: a gear item found on the road, which a neighbourhood places at random. Grabbing
// one puts the item in effect, on top of the Pocket's gear, until the walk ends or another drop
// is grabbed: one found item at a time.

type DropData = Pick<GameData, "shopGear" | "tuning">;

// The gear in effect: the Pocket's, then the found item.
export function gearInEffect(run: Pick<RunState, "foundGear" | "gear">): GearId[] {
  return [run.gear, run.foundGear].filter((gear) => gear !== null);
}

// How many drops the neighbourhood at walk position zoneIndex (from 0) places:
// counts.gearDropsPerZone for its position, rounded by chanceRound.
export function gearDropCount(tuning: LiveTuning, random: Random, zoneIndex: number): number {
  const position = (zoneIndex + 1) as keyof LiveTuning["counts"]["gearDropsPerZone"];
  return chanceRound(random, readTable(tuning, "counts", "gearDropsPerZone", position));
}

// The gear items a drop may be, each weighted by 1 over its price, so a cheaper item drops more
// often: every item but those in excluded, in the data's order.
export function gearDropWeights(data: DropData, excluded: readonly GearId[]): [GearId, number][] {
  return keysOf(data.shopGear)
    .filter((gear) => !excluded.includes(gear))
    .map((gear): [GearId, number] => [gear, 1 / price(data.tuning, data.shopGear[gear].price)]);
}

// The neighbourhood's drops, in the order drawn: gearDropCount of them, each drawn by
// gearDropWeights among the items not in effect (the Pocket's and the found item) and not drawn
// before it in the neighbourhood. Fewer when the items run out.
export function drawGearDrops(
  data: DropData,
  random: Random,
  run: Pick<RunState, "foundGear" | "gear" | "zoneIndex">,
): GearId[] {
  const count = gearDropCount(data.tuning, random, run.zoneIndex);
  const drops: GearId[] = [];
  for (let i = 0; i < count; i++) {
    const weights = gearDropWeights(data, [...gearInEffect(run), ...drops]);
    if (weights.length === 0) {
      break;
    }
    drops.push(
      weightedPick(
        random,
        weights.map(([gear]) => gear),
        weights.map(([, weight]) => weight),
      ),
    );
  }
  return drops;
}

// What a grabbed drop's effects come from: its gear, found.
export function foundGearSource(gear: GearId): Extract<EffectSource, { kind: "gear" }> {
  return { found: true, gear, kind: "gear" };
}

// Whether an effect's source is a found item.
const isFound = (source: ModifierSource): boolean =>
  source.kind === "gear" && source.found === true;

// The found item's effects ended: its modifiers, dodges, immunities and skip gone, the spare
// treats held cut to the room left without them, as when a found Fanny pack goes back with its
// spare treat, and each owner's hearts held to their max as it stands without them, as when a
// found Lucky collar's extra max goes. A Skip already used this neighbourhood stays used.
function dropFoundEffects(data: Pick<GameData, "dogs" | "tuning">, run: RunState): RunState {
  const ended: RunState = holdSpareTreats(data, {
    ...run,
    dodges: run.dodges.filter(({ source }) => !isFound(source)),
    foundGear: null,
    immunities: run.immunities.filter(({ source }) => !isFound(source)),
    modifiers: run.modifiers.filter(({ source }) => !isFound(source)),
    skipPass: run.skipPass !== null && isFound(run.skipPass) ? null : run.skipPass,
  });
  return {
    ...ended,
    pack: mapPack(
      (slot) =>
        slot.status === "walking"
          ? { ...slot, hearts: clampHearts(ownerMaxHearts(data, ended, slot.dog), slot.hearts) }
          : slot,
      ended.pack,
    ),
  };
}

// A drop grabbed: the item found before it, if any, goes back (its effects end), then this
// item's effects apply, named as found, until the walk ends or the next grab. Each effect takes
// hold, and ends, as any gear's would, read where it acts: a maxHearts modifier, such as Lucky
// collar's, raises each owner's max but not their hearts, and on going back lowers it, holding
// hearts above it to it; a skip, such as Hall pass's, is offered from this neighbourhood on; a
// spareTreats modifier, such as the Fanny pack's, holds the treats grabbed after it; a dodge,
// such as the Whistle's, and an agility modifier, such as Running shoes', act at once. replaced
// is the item that went back, or null.
export function grabGear(
  data: Pick<GameData, "debuffs" | "dogs" | "encounters" | "shopGear" | "tuning">,
  gear: GearId,
  run: RunState,
): {
  readonly modified: readonly ModifiedValue[];
  readonly replaced: GearId | null;
  readonly run: RunState;
} {
  const replaced = run.foundGear;
  const applied = resolveEffects(
    data,
    { affected: [], source: foundGearSource(gear) },
    data.shopGear[gear].effects,
    replaced === null ? run : dropFoundEffects(data, run),
  );
  return { modified: applied.modified, replaced, run: { ...applied.state, foundGear: gear } };
}
