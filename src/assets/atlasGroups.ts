import { splitDepthKey } from "./depthSteps";
import { LOADING_ART } from "./spriteKeys";

// Pages in load order: the loading screen's art first, so it shows while the rest loads.
export const ATLAS_GROUPS = ["boot", "ui", "home", "run", "road", "cards"] as const;
export type AtlasGroup = (typeof ATLAS_GROUPS)[number];
// The groups a key belongs to by its name alone. road is split out of run by pageGroupOf.
type KeyGroup = Exclude<AtlasGroup, "road">;

// The groups boot loads before the home screen shows. The rest load behind it, and a walk or
// help waits for them.
const FIRST_ATLAS_GROUPS: readonly AtlasGroup[] = ["boot", "ui", "home"];

// The groups whose pages draw with linear filtering. A page's filter covers every frame on it,
// so the road art drawn between its depth steps packs on pages of its own.
const LINEAR_GROUPS: ReadonlySet<AtlasGroup> = new Set(["road"]);

const LOADING_KEYS: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
const GROUP_PREFIXES: readonly (readonly [KeyGroup, readonly string[]])[] = [
  ["cards", ["card-"]],
  ["ui", ["badge-", "face-", "icon-", "item-", "logo", "portrait-", "screen-", "ui-"]],
];

// Road art the home screen and its menus draw too: each dog, owner and walker at full size
// (not their depth steps), the coin, and the effects of a tap, a dog's hop and a celebration.
const HOME_PREFIXES = ["dog-", "owner-", "walker-"];
const HOME_KEYS: ReadonlySet<string> = new Set([
  "fx-confetti",
  "fx-dust",
  "fx-new-best",
  "fx-tap",
  "tip",
]);

const isHomeArt = (key: string): boolean =>
  HOME_KEYS.has(key) ||
  (HOME_PREFIXES.some((prefix) => key.startsWith(prefix)) && splitDepthKey(key).base === key);

// boot is the loading screen; ui the home screen, menus, HUD and icons; home the road art the
// home screen draws too; cards the choice cards; run everything else on the road.
export function atlasGroupOf(key: string): KeyGroup {
  if (LOADING_KEYS.has(key)) {
    return "boot";
  }
  if (isHomeArt(key)) {
    return "home";
  }
  const match = GROUP_PREFIXES.find(([, prefixes]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );
  return match?.[0] ?? "run";
}

// Whether boot loads key before the home screen shows.
export const loadsFirst = (key: string): boolean => FIRST_ATLAS_GROUPS.includes(atlasGroupOf(key));

// The sprites among keys that have a depth step variant: the road sprites drawn through their
// depth steps.
export function steppedBases(keys: Iterable<string>): Set<string> {
  const bases = new Set<string>();
  for (const key of keys) {
    const { base } = splitDepthKey(key);
    if (base !== key) {
      bases.add(base);
    }
  }
  return bases;
}

// The page group a key packs into, given steppedBases of the keys packed: atlasGroupOf's, except
// that the road art drawn between its depth steps (each depth step variant, and the full size of
// a sprite with one) is road, whose pages filter linearly so it shrinks smoothly. Home art keeps
// its group and stays nearest: the home screen draws it at 1x, and the pack stands at full size.
export function pageGroupOf(stepped: ReadonlySet<string>, key: string): AtlasGroup {
  const group = atlasGroupOf(key);
  return group === "run" && stepped.has(splitDepthKey(key).base) ? "road" : group;
}

// Whether a key's texture draws with linear filtering, given steppedBases of the keys loaded.
// At 1x on a whole pixel, as Phaser places unscaled sprites, linear filtering samples each
// texel's centre and draws the same pixels as nearest.
export function filtersLinear(stepped: ReadonlySet<string>, key: string): boolean {
  return LINEAR_GROUPS.has(pageGroupOf(stepped, key));
}
