import { kebabCase } from "../assets/spriteKeys";
import type { GameData, GearId, UpgradeId, WalkerId, WalkerPerkId } from "../data/types";
import { gearSourceName } from "../rules/causes";
import { gearShort, perkEffect } from "../rules/effectText";
import { walkLength } from "../rules/route";
import { read } from "../rules/units";
import type { RunState } from "../state/runState";

// An effect in force on the walk, shown as an icon in the walk bar's effect wells. Holding one
// explains it. A gear drop's charm is its gear, found, which has no well of its own.
export type EffectItem =
  | { readonly found?: true; readonly gear: GearId; readonly kind: "gear" }
  | { readonly kind: "perk"; readonly perk: WalkerPerkId }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId };

type EffectRun = Pick<
  RunState,
  "foundGear" | "gear" | "immunities" | "modifiers" | "upgradesPicked" | "walker"
>;

// An effect's icon is this many pixels square.
export const EFFECT_ICON_SIZE = 16;

// A picked upgrade is in effect while one of its lasting effects is: a modifier it added, or an
// immunity to its encounter. Upgrades that only act when picked, such as Belly rubs, never are.
function inEffect(data: Pick<GameData, "upgrades">, run: EffectRun, upgrade: UpgradeId): boolean {
  return data.upgrades[upgrade].effects.some((effect) => {
    switch (effect.kind) {
      case "modifier":
        return run.modifiers.some(
          ({ source }) => source.kind === "upgrade" && source.upgrade === upgrade,
        );
      case "immune":
        return run.immunities.some(({ encounter }) => encounter === effect.encounter);
      default:
        return false;
    }
  });
}

// A walker's perk, as the walk bar and the walker's home-screen tile show it.
export function walkerEffectItems(data: Pick<GameData, "walkers">, walker: WalkerId): EffectItem[] {
  return [{ kind: "perk", perk: data.walkers[walker].perk }];
}

// The walker's perk, the gear in the Pocket, the found gear, then the upgrades in effect in the
// order they were picked. Each takes the next well, so a walk with no found gear leaves no well
// empty between the Pocket's and the upgrades'.
export function effectItems(
  data: Pick<GameData, "upgrades" | "walkers">,
  run: EffectRun,
): EffectItem[] {
  return [
    ...walkerEffectItems(data, run.walker),
    ...(run.gear === null ? [] : [{ gear: run.gear, kind: "gear" } as const]),
    ...(run.foundGear === null
      ? []
      : [{ found: true, gear: run.foundGear, kind: "gear" } as const]),
    ...run.upgradesPicked
      .filter((upgrade) => inEffect(data, run, upgrade))
      .map((upgrade): EffectItem => ({ kind: "upgrade", upgrade })),
  ];
}

// The most effects a walk can have at once: the walker's perk, up to loadoutMax gear in the
// Pocket, one found gear item, and an upgrade from each fork, one between each two zones.
export function maxEffects(data: Pick<GameData, "tuning" | "world">): number {
  return 1 + read(data.tuning, "counts", "loadoutMax") + 1 + walkLength(data) - 1;
}

// The 16x16 icon of a walker's perk.
export function perkIconKey(perk: WalkerPerkId): string {
  return `icon-perk-${kebabCase(perk)}`;
}

// The 16x16 icon each item shows: icon-upgrade-<id>, icon-gear-<id>, icon-perk-<id>.
export function effectIconKey(item: EffectItem): string {
  switch (item.kind) {
    case "gear":
      return `icon-gear-${kebabCase(item.gear)}`;
    case "perk":
      return perkIconKey(item.perk);
    case "upgrade":
      return `icon-upgrade-${kebabCase(item.upgrade)}`;
    default:
      return item satisfies never;
  }
}

// What an item's icon slot shows while its icon art is missing: its name's first letter.
export function effectIconFallback(
  data: Pick<GameData, "runText" | "shopGear" | "upgrades" | "walkerPerks">,
  item: EffectItem,
): string {
  return effectName(data, item).slice(0, 1);
}

// The item's name: a gear drop's names it found (gearSourceName).
export function effectName(
  data: Pick<GameData, "runText" | "shopGear" | "upgrades" | "walkerPerks">,
  item: EffectItem,
): string {
  switch (item.kind) {
    case "gear":
      return gearSourceName(data, item);
    case "perk":
      return data.walkerPerks[item.perk].name;
    case "upgrade":
      return data.upgrades[item.upgrade].name;
    default:
      return item satisfies never;
  }
}

// What the item does, in one line: the perk's and the upgrade's effect, the gear's short line.
export function effectLine(
  data: Pick<GameData, "shopGear" | "tuning" | "upgrades" | "walkerPerks">,
  item: EffectItem,
): string {
  switch (item.kind) {
    case "gear":
      return gearShort(data, item.gear);
    case "perk":
      return perkEffect(data.tuning, data.walkerPerks[item.perk]);
    case "upgrade":
      return data.upgrades[item.upgrade].effect;
    default:
      return item satisfies never;
  }
}

// The 20x20 icon each item shows in the walk bar's effect wells: its 16x16 key and -20.
export function walkBarIconKey(item: EffectItem): string {
  return `${effectIconKey(item)}-20`;
}

export function effectItemsKey(items: readonly EffectItem[]): string {
  return items.map(effectIconKey).join();
}
