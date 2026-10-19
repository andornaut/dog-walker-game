// CLEANUP (added 2026-10-19): the preset walkers held here until gameData.walkers carries
// this shape; then read the list from there and delete this file.
export interface PresetWalker {
  readonly name: string;
}

// All free. casey is the original walker.
export const PRESET_WALKERS = {
  ada: { name: "Ada" },
  ben: { name: "Ben" },
  casey: { name: "Casey" },
  trista: { name: "Trista" },
} as const satisfies Record<string, PresetWalker>;

export type PresetWalkerId = keyof typeof PRESET_WALKERS;

export const DEFAULT_WALKER: PresetWalkerId = "casey";

// A walker's 32x48 road sprite, with tags walk and react.
export function walkerSpriteKeyOf(walker: PresetWalkerId): string {
  return `walker-${walker}`;
}

// A walker's 32x32 portrait, with tags happy and neutral.
export function walkerPortraitKey(walker: PresetWalkerId): string {
  return `face-walker-${walker}`;
}

// The walker's sprite, or the default walker's while its own has not been exported.
export function walkerSpriteKey(
  hasSprite: (key: string) => boolean,
  walker: PresetWalkerId,
): string {
  const own = walkerSpriteKeyOf(walker);
  return hasSprite(own) ? own : walkerSpriteKeyOf(DEFAULT_WALKER);
}
