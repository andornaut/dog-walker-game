import { kebabCase } from "../assets/spriteKeys";
import type {
  DebuffId,
  GameData,
  GearId,
  UpgradeId,
  WalkerId,
  WalkerPace,
  WalkerStyle,
} from "../data/types";
import { exceedsTapDistance } from "../input/gestures";
import { containsPoint, type Point, type Rect } from "../layout/rect";
import { namedEffectText, type TextData } from "../rules/effectText";
import type { RunState } from "../state/runState";
import type { RunPause } from "./topBar";

// An effect in force on the run, shown as an icon in the top bar's state strip.
export type StripItem =
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly gear: GearId; readonly kind: "gear" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "pace"; readonly pace: WalkerPace }
  | { readonly kind: "style"; readonly style: WalkerStyle };

export type StripRun = Pick<
  RunState,
  "debuffs" | "gear" | "immunities" | "modifiers" | "upgradesPicked" | "walker"
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

// A walker's pace and style, as the strip and the walker's home-screen tile show them.
export function walkerStripItems(data: Pick<GameData, "walkers">, walker: WalkerId): StripItem[] {
  const { pace, style } = data.walkers[walker];
  return [
    { kind: "pace", pace },
    { kind: "style", style },
  ];
}

// The debuffs on the pack, the upgrades in effect in the order they were picked, the gear, then
// the walker's pace and style.
export function stripItems(
  data: Pick<GameData, "upgrades" | "walkers">,
  run: StripRun,
): StripItem[] {
  return [
    ...run.debuffs.map(({ debuff }): StripItem => ({ debuff, kind: "debuff" })),
    ...run.upgradesPicked
      .filter((upgrade) => inEffect(data, run, upgrade))
      .map((upgrade): StripItem => ({ kind: "upgrade", upgrade })),
    ...(run.gear === null ? [] : [{ gear: run.gear, kind: "gear" } as const]),
    ...walkerStripItems(data, run.walker),
  ];
}

// The 16x16 icon each item shows: icon-stinky, icon-upgrade-<id>, icon-gear-<id>,
// icon-pace-<id>, icon-style-<id>.
export function stripIconKey(item: StripItem): string {
  switch (item.kind) {
    case "debuff":
      return `icon-${kebabCase(item.debuff)}`;
    case "gear":
      return `icon-gear-${kebabCase(item.gear)}`;
    case "upgrade":
      return `icon-upgrade-${kebabCase(item.upgrade)}`;
    case "pace":
      return `icon-pace-${kebabCase(item.pace)}`;
    case "style":
      return `icon-style-${kebabCase(item.style)}`;
    default:
      return item satisfies never;
  }
}

// An item's name and effect, as its upgrade card and the gear's home-screen line write them.
export function stripText(
  data: TextData & Pick<GameData, "shopGear" | "upgrades" | "walkerPaces" | "walkerStyles">,
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
      return namedEffectText(data, name, effects);
    }
    case "gear": {
      const { effects, name } = data.shopGear[item.gear];
      return namedEffectText(data, name, effects);
    }
    case "upgrade": {
      const { effects, name } = data.upgrades[item.upgrade];
      return namedEffectText(data, name, effects);
    }
    case "pace": {
      const { effects, name } = data.walkerPaces[item.pace];
      return namedEffectText(data, name, effects);
    }
    case "style": {
      const { effects, name } = data.walkerStyles[item.style];
      return namedEffectText(data, name, effects);
    }
    default:
      return item satisfies never;
  }
}

// What an item's icon slot shows while its icon art is missing: its name's first letter.
export function stripIconFallback(
  data: Pick<GameData, "debuffs" | "shopGear" | "upgrades" | "walkerPaces" | "walkerStyles">,
  item: StripItem,
): string {
  return stripName(data, item).slice(0, 1);
}

function stripName(
  data: Pick<GameData, "debuffs" | "shopGear" | "upgrades" | "walkerPaces" | "walkerStyles">,
  item: StripItem,
): string {
  switch (item.kind) {
    case "debuff":
      return data.debuffs[item.debuff].name;
    case "gear":
      return data.shopGear[item.gear].name;
    case "pace":
      return data.walkerPaces[item.pace].name;
    case "style":
      return data.walkerStyles[item.style].name;
    case "upgrade":
      return data.upgrades[item.upgrade].name;
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

// The strip hangs under the top bar's zone well, right-aligned with it: a plum tab
// (ui-strip-well, stretched to fit) around an ink well, the icons 2px apart and 2px inside
// it. inset is the tab's rim around the well. No well in the bar has room for five icons
// beside the zone's name and pips. The whole strip is one tap target, at least 44px square,
// reaching down over the backdrop; a tap describes every item.
export const STRIP = {
  gap: 2,
  icon: 16,
  inset: { bottom: 5, left: 3, right: 4, top: 1 },
  minHit: 44,
  padding: 2,
  right: 356,
  y: 40,
};

export interface StripLayout {
  hit: Rect;
  icons: Point[];
  tab: Rect;
  well: Rect;
}

export function stripLayout(screenWidth: number, count: number): StripLayout | undefined {
  if (count === 0) {
    return undefined;
  }
  const { gap, icon, inset, minHit, padding, right, y } = STRIP;
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
  const hitX = Math.min(tab.x, screenWidth - minHit);
  return {
    hit: { height: minHit, width: screenWidth - hitX, x: hitX, y },
    icons: Array.from({ length: count }, (_, i) => ({
      x: well.x + padding + i * (icon + gap),
      y: well.y + padding,
    })),
    tab,
    well,
  };
}

// Whether (x, y) is on the strip of count items; no items, no strip.
export function onStrip(screenWidth: number, count: number, { x, y }: Point): boolean {
  const layout = stripLayout(screenWidth, count);
  return layout !== undefined && containsPoint(layout.hit, x, y);
}

// A press that starts on the strip. It taps the strip on release only if it never left the tap
// distance; past it, the press is a drag, which the walk steers by.
export interface StripPress {
  readonly start: Point;
  readonly tapping: boolean;
}

export function moveStripPress(
  tapMaxDistance: number,
  point: Point,
  press: StripPress,
): StripPress {
  const tapping = press.tapping && !exceedsTapDistance(tapMaxDistance, press.start, point);
  return { ...press, tapping };
}

export function stripTapped(tapMaxDistance: number, point: Point, press: StripPress): boolean {
  return moveStripPress(tapMaxDistance, point, press).tapping;
}
