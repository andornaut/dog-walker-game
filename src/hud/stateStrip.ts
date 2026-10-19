import { kebabCase } from "../assets/spriteKeys";
import type { DebuffId, GameData, GearId, UpgradeId } from "../data/types";
import type { Point, Rect } from "../layout/rect";
import { effectText, type TextData } from "../rules/effectText";
import type { RunState } from "../state/runState";
import type { RunPause } from "./topBar";

// An effect in force on the run, shown as an icon in the top bar's state strip.
export type StripItem =
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly gear: GearId; readonly kind: "gear" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId };

export type StripRun = Pick<
  RunState,
  "debuffs" | "gear" | "immunities" | "modifiers" | "upgradesPicked"
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

// The debuffs on the pack, the upgrades in effect in the order they were picked, then the gear.
export function stripItems(data: Pick<GameData, "upgrades">, run: StripRun): StripItem[] {
  return [
    ...run.debuffs.map(({ debuff }): StripItem => ({ debuff, kind: "debuff" })),
    ...run.upgradesPicked
      .filter((upgrade) => inEffect(data, run, upgrade))
      .map((upgrade): StripItem => ({ kind: "upgrade", upgrade })),
    ...(run.gear === null ? [] : [{ gear: run.gear, kind: "gear" } as const]),
  ];
}

// The 16x16 icon each item shows: icon-stinky, icon-upgrade-<id>, icon-gear-<id>.
export function stripIconKey(item: StripItem): string {
  switch (item.kind) {
    case "debuff":
      return `icon-${kebabCase(item.debuff)}`;
    case "gear":
      return `icon-gear-${kebabCase(item.gear)}`;
    case "upgrade":
      return `icon-upgrade-${kebabCase(item.upgrade)}`;
    default:
      return item satisfies never;
  }
}

// An item's name and effect, as its upgrade card and the gear's home-screen line write them.
export function stripText(
  data: TextData & Pick<GameData, "shopGear" | "upgrades">,
  item: StripItem,
): string {
  switch (item.kind) {
    case "debuff": {
      const { duration, modifiers, name } = data.debuffs[item.debuff];
      const effects = modifiers.map((modifier) => ({
        ...modifier,
        duration,
        kind: "modifier" as const,
      }));
      return `${name}: ${effectText(data, effects)}.`;
    }
    case "gear": {
      const { effects, name } = data.shopGear[item.gear];
      return `${name}: ${effectText(data, effects)}.`;
    }
    case "upgrade": {
      const { effects, name } = data.upgrades[item.upgrade];
      return `${name}: ${effectText(data, effects)}.`;
    }
    default:
      return item satisfies never;
  }
}

// A tap on the strip opens its descriptions while the walk goes on, under a card and in the
// pause menu; help and settings cover the bar, so a tap there is theirs.
export function stripTapAllowed(pause: RunPause): boolean {
  return pause.menu !== "help" && pause.menu !== "settings";
}

export function stripItemsKey(items: readonly StripItem[]): string {
  return items.map(stripIconKey).join();
}

// The strip hangs under the top bar's zone well, right-aligned with it: an ink well with a
// 2px plum frame, its icons 2px apart. No well has room for five icons beside the zone's
// name and pips. The whole strip is one tap target, at least 44px square, reaching down
// over the backdrop; a tap describes every item.
export const STRIP = { frame: 2, gap: 2, icon: 16, minHit: 44, padding: 2, right: 356, y: 40 };

export interface StripLayout {
  frame: Rect;
  hit: Rect;
  icons: Point[];
  well: Rect;
}

export function stripLayout(screenWidth: number, count: number): StripLayout | undefined {
  if (count === 0) {
    return undefined;
  }
  const { frame, gap, icon, minHit, padding, right, y } = STRIP;
  const width = count * icon + (count - 1) * gap + 2 * padding;
  const well = { height: icon + 2 * padding, width, x: right - width, y };
  const hitX = Math.min(well.x - frame, screenWidth - minHit);
  return {
    frame: {
      height: well.height + frame,
      width: well.width + 2 * frame,
      x: well.x - frame,
      y: well.y,
    },
    hit: { height: minHit, width: screenWidth - hitX, x: hitX, y },
    icons: Array.from({ length: count }, (_, i) => ({
      x: well.x + padding + i * (icon + gap),
      y: well.y + padding,
    })),
    well,
  };
}
