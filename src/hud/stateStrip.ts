import { kebabCase } from "../assets/spriteKeys";
import type { GameData, GearId, UpgradeId, WalkerId, WalkerPerkId } from "../data/types";
import type { Point, Rect } from "../layout/rect";
import type { RunState } from "../state/runState";

// An effect in force on the walk, shown as an icon beside the zone's progress in the top bar.
// The icons take no taps.
export type StripItem =
  | { readonly gear: GearId; readonly kind: "gear" }
  | { readonly kind: "perk"; readonly perk: WalkerPerkId }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId };

export type StripRun = Pick<
  RunState,
  "gear" | "immunities" | "modifiers" | "upgradesPicked" | "walker"
>;

// A picked upgrade is in effect while one of its lasting effects is: a modifier it added, or an
// immunity to its encounter. Upgrades that only act when picked, such as Belly rubs, never are.
function inEffect(data: Pick<GameData, "upgrades">, run: StripRun, upgrade: UpgradeId): boolean {
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

// A walker's perk, as the top bar and the walker's home-screen tile show it.
export function walkerStripItems(data: Pick<GameData, "walkers">, walker: WalkerId): StripItem[] {
  return [{ kind: "perk", perk: data.walkers[walker].perk }];
}

// The upgrades in effect in the order they were picked, the gear, then the walker's perk.
export function stripItems(
  data: Pick<GameData, "upgrades" | "walkers">,
  run: StripRun,
): StripItem[] {
  return [
    ...run.upgradesPicked
      .filter((upgrade) => inEffect(data, run, upgrade))
      .map((upgrade): StripItem => ({ kind: "upgrade", upgrade })),
    ...(run.gear === null ? [] : [{ gear: run.gear, kind: "gear" } as const]),
    ...walkerStripItems(data, run.walker),
  ];
}

// The 16x16 icon of a walker's perk.
export function perkIconKey(perk: WalkerPerkId): string {
  return `icon-perk-${kebabCase(perk)}`;
}

// The 16x16 icon each item shows: icon-upgrade-<id>, icon-gear-<id>, icon-perk-<id>.
export function stripIconKey(item: StripItem): string {
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
export function stripIconFallback(
  data: Pick<GameData, "shopGear" | "upgrades" | "walkerPerks">,
  item: StripItem,
): string {
  switch (item.kind) {
    case "gear":
      return data.shopGear[item.gear].name.slice(0, 1);
    case "perk":
      return data.walkerPerks[item.perk].name.slice(0, 1);
    case "upgrade":
      return data.upgrades[item.upgrade].name.slice(0, 1);
    default:
      return item satisfies never;
  }
}

export function stripItemsKey(items: readonly StripItem[]): string {
  return items.map(stripIconKey).join();
}

// The icons hang under the top bar's zone well, right-aligned with it: a plum tab
// (ui-strip-well, stretched to fit) around an ink well, the icons 2px apart and 2px inside
// it. inset is the tab's rim around the well.
export const STRIP = {
  gap: 2,
  icon: 16,
  inset: { bottom: 5, left: 3, right: 4, top: 1 },
  padding: 2,
  right: 356,
  y: 40,
};

// The bottom of the strip's tab, whatever it holds.
export const STRIP_TAB_BOTTOM =
  STRIP.y + STRIP.inset.top + STRIP.icon + 2 * STRIP.padding + STRIP.inset.bottom;

export interface StripLayout {
  icons: Point[];
  tab: Rect;
  well: Rect;
}

export function stripLayout(count: number): StripLayout | undefined {
  if (count === 0) {
    return undefined;
  }
  const { gap, icon, inset, padding, right, y } = STRIP;
  const width = count * icon + (count - 1) * gap + 2 * padding;
  const well = {
    height: icon + 2 * padding,
    width,
    x: right - inset.right - width,
    y: y + inset.top,
  };
  const tab = {
    height: inset.top + well.height + inset.bottom,
    width: inset.left + well.width + inset.right,
    x: well.x - inset.left,
    y,
  };
  return {
    icons: Array.from({ length: count }, (_, i) => ({
      x: well.x + padding + i * (icon + gap),
      y: well.y + padding,
    })),
    tab,
    well,
  };
}
